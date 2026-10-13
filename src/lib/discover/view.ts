import { strings, type Strings } from '../i18n/languages.ts';
import { youtubeError } from '../youtube/errors.ts';
import {
  FILE_MISSING, KEEP_FAILED, NEEDS_BUILD, NOT_A_SONG, STOPPED, UNSORTED, stagedProgress,
  type Item, type Live, type ProblemCode, type State,
} from './core.ts';
import { NO_MATCH_CODE, WAITING_WIFI, type DiscoverSettings } from './policy.ts';
import { explainEntry, type Why } from './why.ts';

/**
 * Discover as a screen is to show it.
 *
 * Everything a screen needs and nothing it has to work out: each song with
 * the one state it is in, and the list's own state beside them. The words
 * are put in here, from codes, in the language the app is speaking when the
 * view is read — nothing that is kept is a sentence, so a list built in one
 * language reads in another.
 *
 * A song's view is the same object for as long as nothing shown of it has
 * changed, and the array of them is the same array for as long as none of
 * them has and none has moved. A row can be remembered by its song and is
 * then drawn again only when that song is.
 */

export type DiscoverEntryState =
  | 'idle' | 'waiting' | 'finding' | 'fetching' | 'ready' | 'noMatch' | 'waitingWifi' | 'failed';

export type DiscoverEntryView = {
  /** The recording's id. The same for as long as the song is on the list, and the key to draw its row by. */
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationSec: number | null;
  /**
   * Why it is on the list. `seeds` are the artists of the listener's that
   * led to it; `text` is that as one line, already in words. `detail` is
   * whatever more the catalogue kept, for a screen that wants to say more.
   */
  why: { kind: 'familiar' | 'new'; seeds: string[]; tags?: string[]; text: string; detail?: Why };
  state: DiscoverEntryState;
  /** For `waiting`: to be asked of the phone, to be looked for, to be fetched, or to be tried again after a failure. */
  waitingFor?: 'queue' | 'find' | 'download' | 'retry';
  /** For `fetching`: how far along, and for `downloading` the percentage. */
  stage?: 'preparing' | 'downloading' | 'converting' | 'saving';
  progress?: number;
  /** For `failed`, `noMatch` and `waitingWifi`: which failure, and what to say of it. */
  failure?: { code: string; text: string };
  /** The state as one line for under the title, whatever the state. */
  said: string;
  /** The file's id in the player, once there is a file. */
  trackId?: string;
  /** It is what the player has on now, playing or paused. */
  isPlaying: boolean;
  /** Somebody tapped it and it will start by itself when it is in. */
  willPlay: boolean;
  /**
   * Thirty seconds of it are being heard now, while the song itself is
   * fetched: `state` is still whatever the fetching has got to. A tap stops
   * the preview and leaves the song coming.
   */
  previewing: boolean;
  /** Somebody pressed keep, and it is on its way into the library. */
  keeping: boolean;
  /** Whether a tap does anything: not on a row that is only saying its song could not be found. */
  canPlay: boolean;
};

export type DiscoverProblem = {
  code: ProblemCode;
  text: string;
  /** For `throttled`: when asking again will be answered. */
  retryAt?: number;
};

export type DiscoverStatus = {
  /** The catalogue is being asked for songs. `total` is null until it is known how many artists there are to ask about. */
  building: { refresh: boolean; done: number; total: number | null; label: string; text: string } | null;
  /** A new list is being got ready behind the one on show: how many of the songs it is waited for are in. */
  preparing: { ready: number; target: number; count: number; since: number; text: string } | null;
  /** Why there is no list, or not a whole one. Stands until it is no longer so, or is dismissed. */
  problem: DiscoverProblem | null;
  /** Why the songs kept ready are not being fetched, when they would be. */
  waiting: { reason: 'wifi' | 'connection' | 'paused'; text: string } | null;
  /** When the list on show was made, or null for none yet. */
  updatedAt: number | null;
  /** How many songs the list is meant to have, and how many places are empty. */
  count: number;
  vacancies: number;
};

export type DiscoverNotice = {
  kind: 'kept' | 'excluded' | 'restored' | 'refreshed' | 'keepFailed';
  text: string;
  /** The song it is about, where it is about one. */
  id?: string;
  /** Whether `undo()` takes it back, and until when it is offered. */
  canUndo: boolean;
  until: number;
};

/** The preview that is being heard, for whatever shows what is playing: it is not in the player and the player does not know of it. */
export type DiscoverPreview = { id: string; title: string; artist: string; coverUrl: string | null };

export type DiscoverView = {
  entries: readonly DiscoverEntryView[];
  /** Null unless a preview has sound coming out of it now. */
  preview: DiscoverPreview | null;
  status: DiscoverStatus;
  notice: DiscoverNotice | null;
  settings: DiscoverSettings;
};

/** What a song's view was made from, kept so that the same things make the same object. */
type Made = {
  item: Item;
  live: Live | undefined;
  isPlaying: boolean;
  willPlay: boolean;
  previewing: boolean;
  keeping: boolean;
  t: Strings;
  view: DiscoverEntryView;
};

export type ViewCache = {
  made: Map<string, Made>;
  entries: readonly DiscoverEntryView[];
  byTrack: Map<string, DiscoverEntryView>;
  state: State | null;
  t: Strings | null;
  view: DiscoverView | null;
  /** The list's own state and the notice as last made, in words: remade the same, they are the same objects. */
  statusWord: string;
  noticeWord: string;
};

export function viewCache(): ViewCache {
  return { made: new Map(), entries: [], byTrack: new Map(), state: null, t: null, view: null, statusWord: '', noticeWord: '' };
}

/** A failure in words. The phone's own are answered with the sentences the search screen has for them. */
export function failureText(failure: { code: string; detail?: string | null }, t: Strings = strings()): string {
  const said = t.discover;
  switch (failure.code) {
    case NO_MATCH_CODE:
    // The only video found for it was not a song at all. To whoever is looking at the list that is the same thing.
    case NOT_A_SONG:
      return said.state.noMatch;
    case WAITING_WIFI:
      return said.state.waitingWifi;
    case NEEDS_BUILD:
      return said.failure.needsBuild;
    case FILE_MISSING:
      return said.failure.retry(said.failure.fileMissing);
    case STOPPED:
      return said.failure.retry(said.failure.stopped);
    case KEEP_FAILED:
      return said.failure.generic;
  }
  // The one failure with no name is known by the extractor's last line, which `youtubeError` reads as it always has.
  const error = Object.assign(new Error(failure.code === UNSORTED ? failure.detail ?? '' : ''), { code: failure.code });
  return said.failure.retry(youtubeError(error, said.failure.generic, t));
}

function stateOf(item: Item, live: Live | undefined): DiscoverEntryState {
  if (item.goneAt != null) return 'noMatch';
  if (live) return live.phase;
  if (item.track) return 'ready';
  if (item.failure) return item.failure.code === WAITING_WIFI ? 'waitingWifi' : 'failed';
  return 'idle';
}

function doing(state: DiscoverEntryState, live: Live | undefined, t: Strings): string {
  const said = t.discover.state;
  if (state === 'finding') return said.finding;
  if (state === 'waiting') {
    return live?.waitingFor === 'find' ? said.waitingFind
      : live?.waitingFor === 'download' ? said.waitingDownload
        : live?.waitingFor === 'retry' ? said.waitingRetry : said.starting;
  }
  if (live?.stage === 'downloading') return said.downloading(live.progress ?? 0);
  if (live?.stage === 'converting') return said.converting;
  if (live?.stage === 'saving') return said.saving;
  return said.preparing;
}

function entry(made: Omit<Made, 'view'>): DiscoverEntryView {
  const { item, live, isPlaying, willPlay, previewing, keeping, t } = made;
  const song = item.song;
  const state = stateOf(item, live);
  const said = t.discover.state;
  const failure = (state === 'failed' || state === 'noMatch' || state === 'waitingWifi') && item.failure
    ? { code: item.failure.code, text: failureText(item.failure, t) }
    : undefined;
  const busy = state === 'waiting' || state === 'finding' || state === 'fetching';
  const line = busy ? doing(state, live, t) : '';
  const detail = (song as { why?: Why }).why;
  return {
    id: item.id,
    title: song.title,
    artist: song.artist,
    coverUrl: song.coverUrl,
    durationSec: song.durationSec ?? item.track?.durationSec ?? null,
    why: {
      kind: song.familiar ? 'familiar' : 'new',
      seeds: detail?.seeds ?? (song.because ? song.because.split(' · ') : []),
      tags: detail?.tags ?? song.tags,
      text: explainEntry({ why: detail, because: song.because, familiar: song.familiar }, t),
      detail,
    },
    state,
    waitingFor: state === 'waiting' ? live?.waitingFor ?? 'queue' : undefined,
    stage: state === 'fetching' ? live?.stage ?? 'preparing' : undefined,
    progress: state === 'fetching' ? live?.progress : undefined,
    failure,
    said: failure ? failure.text
      : keeping && state === 'ready' ? said.keeping
        : busy ? (item.keep ? said.willKeep(line) : previewing ? said.preview(line) : willPlay ? said.willPlay(line) : line)
          : state === 'ready' ? (isPlaying ? said.playing : said.ready) : said.idle,
    trackId: item.track?.id,
    isPlaying,
    willPlay,
    previewing,
    keeping: keeping || !!item.keep,
    canPlay: state !== 'noMatch',
  };
}

const PROBLEM_TEXT: Record<ProblemCode, (t: Strings, hasList: boolean) => string> = {
  offline: (t, has) => (has ? t.discover.status.offline : t.discover.status.offlineEmpty),
  noLibrary: (t) => t.discover.status.noLibrary,
  noTaste: (t) => t.discover.status.noTaste,
  unreachable: (t, has) => (has ? t.discover.status.unreachable : t.discover.status.unreachableEmpty),
  // Said by the part of Discover that asks the services, in its own words for what they answered.
  slowDown: (t) => t.discover.gathering.throttled,
  nothing: (t) => t.discover.gathering.nothing,
  exhausted: (t, has) => (has ? t.discover.status.exhausted : t.discover.status.exhaustedEmpty),
  timedOut: (t) => t.discover.status.timedOut,
  throttled: (t) => t.discover.status.throttled,
  failed: (t) => t.discover.status.failed,
};

function statusOf(s: State, t: Strings): DiscoverStatus {
  const said = t.discover.status;
  const shown = s.list.filter((item) => item.goneAt == null).length;
  const progress = stagedProgress(s);
  const building = s.building;
  const someoneWaits = s.list.some((item) => s.live.get(item.id)?.phase === 'waiting');
  const reason = s.paused && someoneWaits ? 'paused' : s.held;
  return {
    building: building && {
      ...building,
      text: building.label || (building.total ? said.buildingArtists(building.done, building.total) : said.building),
    },
    preparing: s.staged && progress && {
      ...progress,
      count: s.staged.items.length,
      since: s.staged.since,
      text: said.preparing(progress.ready, progress.target),
    },
    problem: s.problem && {
      code: s.problem.code,
      text: PROBLEM_TEXT[s.problem.code](t, shown > 0),
      retryAt: s.problem.retryAt,
    },
    waiting: reason && {
      reason,
      text: reason === 'paused' ? said.paused : reason === 'wifi' ? said.waitingWifi : said.waitingConnection,
    },
    updatedAt: s.refreshedAt || null,
    count: s.settings.count,
    vacancies: Math.max(0, s.settings.count - shown),
  };
}

function noticeOf(s: State, t: Strings): DiscoverNotice | null {
  const notice = s.notice;
  if (!notice) return null;
  const said = t.discover.notice;
  let text: string;
  switch (notice.kind) {
    case 'kept':
      text = said.kept(notice.title ?? '');
      break;
    case 'restored':
      text = said.restored(notice.title ?? '');
      break;
    case 'refreshed':
      text = said.refreshed;
      break;
    case 'keepFailed':
      text = said.keepFailed(notice.title);
      break;
    case 'excluded':
      text = notice.artist ? said.excludedArtist(notice.artist) : said.excluded(notice.title);
      break;
  }
  return {
    kind: notice.kind,
    text,
    id: notice.id,
    canUndo: notice.kind === 'excluded' && !!s.undo,
    until: notice.until,
  };
}

/**
 * The view of [s], in [t]'s language.
 *
 * [cache] is what the last view was made from. Handing the same one each
 * time is what keeps a song's view the same object while nothing shown of it
 * changed; it is written to here and belongs to whoever holds it.
 */
export function viewOf(s: State, cache: ViewCache, t: Strings = strings()): DiscoverView {
  if (cache.view && cache.state === s && cache.t === t) return cache.view;

  const current = s.player.currentId;
  const made = new Map<string, Made>();
  const entries: DiscoverEntryView[] = [];
  for (const item of s.list) {
    const inputs = {
      item,
      live: s.live.get(item.id),
      isPlaying: !!current && item.track?.id === current,
      willPlay: s.intent?.id === item.id,
      previewing: s.preview?.phase === 'playing' && s.preview.id === item.id,
      keeping: s.keeping.has(item.id),
      t,
    };
    const was = cache.made.get(item.id);
    const same = was && was.item === item && was.live === inputs.live && was.isPlaying === inputs.isPlaying &&
      was.willPlay === inputs.willPlay && was.previewing === inputs.previewing && was.keeping === inputs.keeping && was.t === t;
    const kept: Made = same ? was : { ...inputs, view: entry(inputs) };
    made.set(item.id, kept);
    entries.push(kept.view);
  }
  const unchanged = entries.length === cache.entries.length && entries.every((view, at) => view === cache.entries[at]);
  cache.made = made;
  if (!unchanged) {
    cache.entries = entries;
    cache.byTrack = new Map(entries.filter((view) => view.trackId).map((view) => [view.trackId!, view]));
  }
  cache.state = s;
  cache.t = t;
  /*
    The state changes for things no screen shows — a reading of the queue
    noted, a file given up — and a header that was drawn again for each would
    be drawn for nothing. Both of these are a handful of words and numbers,
    so they are compared as that, and kept when they say what they said.
  */
  const was = cache.view;
  let status = statusOf(s, t);
  const statusWord = JSON.stringify(status);
  if (was && statusWord === cache.statusWord) status = was.status;
  cache.statusWord = statusWord;
  let notice = noticeOf(s, t);
  const noticeWord = JSON.stringify(notice);
  if (was && noticeWord === cache.noticeWord) notice = was.notice;
  cache.noticeWord = noticeWord;
  // The same object for as long as it is the same song's preview, so that what shows it is drawn once.
  const heard = s.preview?.phase === 'playing' ? made.get(s.preview.id)?.view : undefined;
  const preview: DiscoverPreview | null = !heard ? null
    : was?.preview && was.preview.id === heard.id && was.preview.title === heard.title ? was.preview
      : { id: heard.id, title: heard.title, artist: heard.artist, coverUrl: heard.coverUrl };
  if (was && was.entries === cache.entries && was.status === status && was.notice === notice &&
      was.settings === s.settings && was.preview === preview) {
    return was;
  }
  cache.view = { entries: cache.entries, preview, status, notice, settings: s.settings };
  return cache.view;
}
