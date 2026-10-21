import { NativeModule, requireOptionalNativeModule } from 'expo';

import { strings, type Strings } from '../i18n';
import { scheduleWith, type Scheduler } from './http';
import { bulkLookupState, stopBulkLookup, subscribeBulkLookup, type BulkState } from './bulk';

/**
 * A lookup that goes on behind the screen.
 *
 * A run over the library's details, covers or lyrics takes as long as the
 * library is long — a second or more a song — and is the kind of thing that
 * is started and left, with the phone put in a pocket. It used to stop the
 * moment it was: React Native's timers stand still while the app is behind
 * the screen, every request waits on one before it goes, and Android is free
 * to freeze an app that is showing nothing.
 *
 * So, for as long as a run is under way, the native side keeps a service in
 * front with a notification saying how far it has got, which keeps the app
 * and the processor running, and with a Stop that stops it as the screen's
 * does; and every wait the lookups make is kept natively as well as by a
 * timer, whichever ends first. A build without the native side is a build
 * where lookups stop behind the screen, as they always did.
 */

declare class WorkModule extends NativeModule<{ onStop: () => void }> {
  afterAsync(ms: number): Promise<void>;
  hold(channel: string, title: string, text: string, stop: string, done: number, total: number): boolean;
  release(): void;
}

const work = requireOptionalNativeModule<WorkModule>('JukeboxWork');

/**
 * A timer and a native wait for the same moment, whichever answers first.
 *
 * The timer, because it is what keeps time in front of the screen and costs
 * nothing; the native wait, because it is answered behind it. A wait called
 * off is let go of on this side, and the native one, when it comes, finds
 * nothing to do.
 */
function bothWays(native: WorkModule): Scheduler {
  return (ms, then) => {
    let live = true;
    const fire = () => {
      if (!live) return;
      live = false;
      clearTimeout(timer);
      then();
    };
    const timer = setTimeout(fire, ms);
    native.afterAsync(ms).then(fire, () => {});
    return () => {
      live = false;
      clearTimeout(timer);
    };
  };
}

/** How often, at most, the notification is told how far a run has got. Android drops more than a few a second. */
const SAY_EVERY_MS = 1_000;

/** The notification's words for a run under way: the same lines the Tags screen shows. */
export function lookupWords(state: BulkState, t: Strings): { title: string; text: string } | null {
  const progress = state.progress;
  if (!progress) return null;
  const said = t.details.library;
  const title = progress.offline
    ? said.nothingAnswered
    : state.album != null
      ? said.lookingUpAlbum(state.album.name, progress.done, progress.total)
      : progress.total === 0
        ? said.lookingUp
        : state.kind === 'covers'
          ? t.details.selection.coversProgress(progress.done, progress.total)
          : state.kind === 'lyrics'
            ? t.details.selection.lyricsProgress(progress.done, progress.total)
            : said.lookingUpProgress(progress.done, progress.total);
  const text =
    state.kind === 'lyrics' ? t.details.selection.lyricsSoFar(progress.matched) : said.soFar(progress.matched, progress.covers);
  return { title, text: progress.throttled ? `${text} · ${said.rateLimited}` : text };
}

/**
 * Keeps lookups going behind the screen, for as long as the app runs.
 * Answers with how to stop.
 */
export function keepLookupsGoing(): () => void {
  if (!work) return () => {};
  const native = work;
  scheduleWith(bothWays(native));

  let holding = false;
  let saidAt = 0;
  let said = '';
  const look = () => {
    const state = bulkLookupState();
    const t = strings();
    const words = lookupWords(state, t);
    if (!words) {
      if (holding) {
        holding = false;
        said = '';
        native.release();
      }
      return;
    }
    const now = Date.now();
    const line = `${words.title}\n${words.text}`;
    // The first line at once, so the notification is up as the run starts; then no oftener than Android listens.
    if (holding && (line === said || now - saidAt < SAY_EVERY_MS)) return;
    holding = true;
    saidAt = now;
    said = line;
    const progress = state.progress;
    native.hold(
      t.details.library.lookupChannel,
      words.title,
      words.text,
      t.details.library.stop,
      progress?.done ?? 0,
      progress?.total ?? 0
    );
  };

  const unsubscribe = subscribeBulkLookup(look);
  const stop = native.addListener('onStop', () => stopBulkLookup());
  look();
  return () => {
    unsubscribe();
    stop.remove();
    if (holding) native.release();
    scheduleWith(null);
  };
}
