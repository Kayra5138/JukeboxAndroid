import { NEEDS_BUILD } from '../../lib/discover/core.ts';
import type {
  DiscoverEntryView, DiscoverNotice, DiscoverProblem, DiscoverStatus,
} from '../../lib/discover/view.ts';
import { nearnessWord } from '../../lib/discover/why.ts';
import { strings, type Strings } from '../../lib/i18n/languages.ts';

/**
 * What the Discover screen shows, worked out apart from the drawing of it.
 *
 * The view the engine hands over says everything about a song as data and as
 * one ready sentence. A row has room for neither: it is two lines and a mark,
 * the height of a row in the Library. So which of the things known about a
 * song goes on its second line, which becomes a mark at its right and which
 * is left for the sheet a long press opens is decided here, where it can be
 * tested without a phone, and the components only draw what they are told.
 */

/**
 * The mark at the right of a row, in place of a sentence about its state.
 *
 *  - `none`: nothing to say. The song is there to be tapped.
 *  - `queued`: an empty ring. It is waiting its turn, or for Wi-Fi.
 *  - `working`: something is being done that has no measure: the recording
 *    is being looked for, or the download is starting or finishing.
 *  - `progress`: a ring that fills, for a download that knows how far it is.
 *  - `ready`: a tick. A tap plays at once.
 *  - `playing`: it is what the player has on.
 *  - `alert`: it failed, and a tap tries again.
 */
export type RowMark = 'none' | 'queued' | 'working' | 'progress' | 'ready' | 'playing' | 'alert';

export type RowShows = {
  /** Under the title: whose the song is and why it is here, or what has become of it. */
  line: string;
  tone: 'plain' | 'accent' | 'muted' | 'danger';
  mark: RowMark;
  /** For `progress`: nought to a hundred. */
  progress: number;
  /** Under the mark: the percentage while there is one, and otherwise how long the song is. */
  caption: string;
  /** Somebody tapped it and it is the one that will start. */
  chosen: boolean;
  /** Thirty seconds of it are being heard while it is fetched. The mark is still the fetching's. */
  preview: boolean;
  /** Being put in the library, or to be as soon as it is in. */
  keeping: boolean;
  /** Nothing can be done with it: it is only saying that its song could not be found. */
  gone: boolean;
};

/** `3:07`, or nothing for a length nobody knows. */
export function durationLabel(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * A failure as a few words.
 *
 * The view's own sentence for it is the right thing to read out and to put
 * on a sheet, and is twice the width of a row. Which failure it was hardly
 * matters there: what a row can usefully say is that it failed and that a tap
 * tries again. The one that a tap cannot mend says what would.
 */
function failureLine(entry: DiscoverEntryView, t: Strings): string {
  const said = t.discover.row;
  if (entry.state === 'waitingWifi') return said.waitingWifi;
  return entry.failure?.code === NEEDS_BUILD ? said.needsBuild : said.failed;
}

export function rowShows(entry: DiscoverEntryView, t: Strings = strings()): RowShows {
  const said = t.discover.row;
  const length = durationLabel(entry.durationSec);
  const busy = entry.state === 'waiting' || entry.state === 'finding' || entry.state === 'fetching';
  const about = (note: string) => [entry.artist, note].filter(Boolean).join(' · ');
  const shows: RowShows = {
    line: about(entry.why.text),
    tone: 'plain',
    mark: 'none',
    progress: 0,
    caption: length,
    chosen: entry.willPlay && busy,
    preview: entry.previewing && busy,
    keeping: entry.keeping,
    gone: !entry.canPlay,
  };

  switch (entry.state) {
    case 'idle':
      break;
    case 'waiting':
      shows.mark = 'queued';
      break;
    case 'finding':
      shows.mark = 'working';
      break;
    case 'fetching':
      if (entry.stage === 'downloading') {
        shows.mark = 'progress';
        shows.progress = Math.min(Math.max(Math.round(entry.progress ?? 0), 0), 100);
        shows.caption = said.percent(shows.progress);
      } else {
        shows.mark = 'working';
      }
      break;
    case 'ready':
      shows.mark = entry.isPlaying ? 'playing' : 'ready';
      break;
    case 'waitingWifi':
      shows.mark = 'queued';
      shows.line = failureLine(entry, t);
      shows.tone = 'muted';
      break;
    case 'failed':
      shows.mark = 'alert';
      shows.line = failureLine(entry, t);
      shows.tone = 'danger';
      break;
  }

  /*
    What was asked of the song is said in place of why it is here, which
    whoever asked has already read: that a tap was taken, and that a keep was.
    A failure is not written over. It is the answer to what was asked.
  */
  if (shows.tone === 'plain') {
    if (entry.keeping) {
      shows.line = about(entry.state === 'ready' ? said.keeping : said.willKeep);
      shows.tone = 'accent';
    } else if (shows.preview) {
      // Said plainly, and first: what is coming out of the speaker is not the song yet.
      shows.line = said.preview;
      shows.tone = 'accent';
    } else if (shows.chosen) {
      shows.line = about(said.willPlay);
      shows.tone = 'accent';
    }
  }
  return shows;
}

/** The state as a screen reader is told it: the view's own sentence, without the percentage that changes each second. */
function stateSaid(entry: DiscoverEntryView, t: Strings): string {
  if (entry.failure) return entry.failure.text;
  if (entry.state === 'waiting' || entry.state === 'finding' || entry.state === 'fetching') {
    const said = t.discover.row;
    if (entry.previewing && !entry.keeping) return [said.preview, said.previewStop].join('. ');
    return [said.gettingReady, entry.keeping ? said.willKeep : entry.willPlay ? said.willPlay : ''].filter(Boolean).join('. ');
  }
  return entry.said;
}

/**
 * A row as one thing said: the song, whose it is, why it is here and what
 * state it is in. The row is one button, and a button's label is all a
 * screen reader says of it; left to the title alone, nothing else on the row
 * was ever heard.
 */
export function rowLabel(entry: DiscoverEntryView, t: Strings = strings()): string {
  return [entry.title, entry.artist, entry.why.text, stateSaid(entry, t)]
    .map((part) => part.trim().replace(/[.…]+$/, ''))
    .filter(Boolean)
    .join('. ');
}

/** What of a row is remembered from one drawing to the next, to tell what has happened to it. */
export type RowWatch = {
  state: DiscoverEntryView['state'];
  isPlaying: boolean;
  /** Somebody tapped it, and how that came out has not been said yet. */
  tapped: boolean;
};

/**
 * What to say aloud when a row changes, or null for nothing, and what to
 * remember of it for the next time.
 *
 * Only of the song somebody tapped, and only how that came out: it has
 * started, or it failed. A screen reader told each percentage of each song
 * being fetched would say nothing else.
 *
 * The tap is remembered here and not read off the song, because the song
 * stops saying it was tapped a moment before the player says it is on. It is
 * forgotten when another song is tapped in its place, which is the one way
 * a song still being fetched stops being the one that will play.
 */
export function watchRow(
  before: RowWatch | null,
  now: DiscoverEntryView,
  t: Strings = strings()
): { watch: RowWatch; say: string | null } {
  const busy = now.state === 'waiting' || now.state === 'finding' || now.state === 'fetching';
  const failed = now.state === 'failed';
  let tapped = now.willPlay || (!!before?.tapped && !(busy && !now.willPlay));
  let say: string | null = null;
  if (before?.tapped) {
    if (now.isPlaying && !before.isPlaying) {
      say = t.discover.row.nowPlaying(now.title);
      tapped = false;
    } else if (failed && before.state !== now.state) {
      say = `${now.title}. ${now.failure?.text ?? t.discover.failure.generic}`;
      tapped = false;
    }
  }
  if (now.state === 'idle' || now.state === 'waitingWifi') tapped = now.willPlay;
  return { watch: { state: now.state, isPlaying: now.isPlaying, tapped }, say };
}

/**
 * Why the song is here, at length, for the sheet a long press opens: the
 * line the row has, then whatever more the catalogue kept of it, each as a
 * line of its own. A song kept from before any of that was kept has the one
 * line and no more.
 */
export function whyLines(entry: DiscoverEntryView, t: Strings = strings()): string[] {
  const said = t.discover.menu;
  const lines = [entry.why.text];
  const detail = entry.why.detail;
  // Named in full here, where the row's line stops at two.
  if (entry.why.seeds.length > 2) lines.push(said.seeds(entry.why.seeds.join(', ')));
  const near = detail && detail.kind === 'near' ? nearnessWord(detail.similarity, t) : null;
  if (near) lines.push(near);
  const tags = entry.why.tags ?? [];
  if (tags.length) lines.push(said.tags(tags.slice(0, 4).join(', ')));
  if (detail?.fresh) lines.push(said.freshArtist);
  return lines;
}

/** What the line under the header is saying, by what matters most. */
export type StatusLine =
  | { kind: 'none' }
  | { kind: 'problem'; text: string; action: 'refresh' | 'findMore' | null }
  | { kind: 'building'; text: string; fraction: number | null }
  | { kind: 'preparing'; text: string; fraction: number }
  | { kind: 'waiting'; text: string };

/**
 * The problems that pressing a button would only be told again: there is no
 * music to go by, or nothing new to find, or the catalogue has just been
 * asked or has asked to be left alone a while. By name and not by the
 * engine's own list of them, so that one it comes to have later is simply a
 * problem that can be retried.
 */
const NOTHING_TO_PRESS: ReadonlySet<string> = new Set(['noLibrary', 'noTaste', 'exhausted', 'throttled', 'slowDown']);

/**
 * What can be done about a problem from where it is said: nothing, for
 * those above. Otherwise a list that is short is filled, and one that is
 * whole or missing is asked for anew.
 */
export function problemAction(problem: DiscoverProblem, status: DiscoverStatus): 'refresh' | 'findMore' | null {
  if (NOTHING_TO_PRESS.has(problem.code)) return null;
  const shown = status.count - status.vacancies;
  return shown > 0 && status.vacancies > 0 ? 'findMore' : 'refresh';
}

/**
 * One thing at a time, and the one that most needs saying: what is wrong,
 * before what is being done, before what is being waited for.
 *
 * With no list there is nothing for a problem to stand over. It is then said
 * where the list would be, in full and with room, and not here as well.
 */
export function statusLine(status: DiscoverStatus): StatusLine {
  if (status.problem && status.shown > 0) {
    return { kind: 'problem', text: status.problem.text, action: problemAction(status.problem, status) };
  }
  if (status.building) {
    const { done, total } = status.building;
    return { kind: 'building', text: status.building.text, fraction: total ? Math.min(done / total, 1) : null };
  }
  if (status.preparing) {
    const { ready, target } = status.preparing;
    return { kind: 'preparing', text: status.preparing.text, fraction: target ? Math.min(ready / target, 1) : 0 };
  }
  /*
    The list filling in, song by song as each is confirmed: the same line a
    build has, and its bar, because to whoever is watching it is the same
    thing still going on — the list being put together.
  */
  if (status.filling) {
    const { known, total } = status.filling;
    return { kind: 'building', text: status.filling.text, fraction: total ? Math.min(known / total, 1) : null };
  }
  if (status.waiting) return { kind: 'waiting', text: status.waiting.text };
  return { kind: 'none' };
}

/** What stands at the foot of a list that has songs on it. */
export type ListFoot = 'none' | 'finding' | 'findMore';

/** A short list is being filled, or can be asked to be. A whole one has nothing under it. */
export function listFoot(status: DiscoverStatus, shown: number): ListFoot {
  if (shown === 0 || status.vacancies <= 0) return 'none';
  return status.building || status.filling ? 'finding' : 'findMore';
}

/**
 * What is drawn where the list would be, when it has no songs: rows that are
 * not there yet while one is being made, what went wrong if that is why
 * there is none, and otherwise how to come by one.
 */
export type EmptyShows =
  | { kind: 'skeleton' }
  | { kind: 'problem'; text: string; action: 'refresh' | 'findMore' | null }
  | { kind: 'none' };

export function emptyShows(status: DiscoverStatus): EmptyShows {
  /*
    Songs are chosen and being confirmed, and none has been yet: that is a
    list on its way, drawn as one, and not "there is no list". Said before
    any problem, since whatever went wrong the songs are coming.
  */
  if (status.filling) return { kind: 'skeleton' };
  if (status.problem) return { kind: 'problem', text: status.problem.text, action: problemAction(status.problem, status) };
  if (status.building || status.preparing) return { kind: 'skeleton' };
  // Chosen, and not able to be confirmed now. Why, and for the one a press can mend, the press.
  if (status.unconfirmed > 0 && status.waiting && status.waiting.reason !== 'wifi') {
    return { kind: 'problem', text: status.waiting.text, action: status.waiting.reason === 'later' ? 'findMore' : null };
  }
  return { kind: 'none' };
}

/** A track of Discover's own, not yet anybody's: its file is the app's and its id is not one the library knows. */
export function isDiscoverTrack(trackId: string | null | undefined): boolean {
  return !!trackId && trackId.startsWith('discover:');
}

/**
 * What of the track menu cannot be done to a song of Discover's.
 *
 * Such a song is a file of the app's own with an id the phone's library has
 * never heard of, and everything here goes by that library: a list keeps
 * ids of it, the details and the game look a track up in it by id, an album
 * is the library's tracks of that name, and erasing is asked of it. Each
 * would have opened on nothing, or failed. Playing next and queueing take
 * the track as it is and are left.
 */
export const NOT_FOR_DISCOVER = ['album', 'addToPlaylist', 'tiles', 'details', 'delete'] as const;

/**
 * The notice, for a player that has `trackId` on: whether it is about this
 * song. A notice names the song by the list's id for it, which is not the
 * file's, so it is matched through the song last seen for the file.
 */
export function noticeAbout(notice: DiscoverNotice | null, entryId: string | null): DiscoverNotice | null {
  return notice && entryId && notice.id === entryId ? notice : null;
}
