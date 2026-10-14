import type { Discovery } from '../db/discover.ts';
import type { Track } from '../types.ts';
import type { DownloadJob } from '../youtube/types.ts';
import { DAY, NO_MATCH_CODE, WAITING_WIFI, previewsOn, selectSongs, songKey, type DiscoverSettings } from './policy.ts';

/**
 * Discover's list, and everything that happens to it, with nothing done.
 *
 * This file is the whole of what Discover decides: which songs are on the
 * list and in what order, what each of them is doing, what a tap means, when
 * a new list takes the old one's place, which songs are fetched ahead. It
 * decides and does nothing. Every function here is handed what is so and
 * what has just happened, and answers what is so now and what is to be done
 * about it — ask the phone for a song, start the player, write down that a
 * song is not wanted. The doing is `engine.ts`'s.
 *
 * It is written this way because of what it replaced: one file in which the
 * deciding was done between calls to the phone, the database and the player,
 * so that none of it could be run without all three. What went wrong there
 * went wrong in the deciding — a tap that froze every row, a list that
 * shuffled under the finger, a song that failed and was never tried again —
 * and those are the things a test can hold to here, on a desk, with a clock
 * moved by hand.
 *
 * NOTHING IS CHANGED IN PLACE. A song on the list is an object that is never
 * written to. When something about it changes it is replaced by a new one,
 * and a song nothing happened to is the same object it was. That is what
 * lets a row on the screen be drawn again only when its own song changed,
 * and what lets the list be written down only when it is a different list.
 *
 * What is true of a song is kept in two places, for that reason. An `Item`
 * holds what lasts: the song, the job it was given, its file once it has
 * one, why it failed. That is written down, and changes a handful of times
 * in a song's life. `Live` holds what is true this second — waiting, being
 * looked for, so many percent fetched — which is read off the queue of
 * downloads, changes every second while a download runs, and is not written
 * down anywhere: the queue is where it is kept.
 */

/** A song as the catalogue recommends it. Whatever else the catalogue adds travels with it untouched. */
export type Song = Discovery & {
  familiar: boolean;
  score: number;
  tags?: string[];
  durationSec?: number | null;
};

/**
 * Why a song has no file, as a name for it and never as a sentence.
 *
 * The codes are the phone's (`Failure.kt`) where the phone said it, and the
 * ones below where this side did. `detail` is only ever the extractor's own
 * last line, for the one failure that has no name; it is English because the
 * extractor is. The words somebody reads are made from the code when they
 * are read, in the language of that moment.
 */
export type ItemFailure = { code: string; detail?: string | null; at: number; job?: string };

/** Somebody stopped its download from the queue's own screen. Said on the row, and not tried again behind their back. */
export const STOPPED = 'ERR_DISCOVER_STOPPED';
/** The file a finished job pointed at is not there. */
export const FILE_MISSING = 'ERR_DISCOVER_FILE_MISSING';
/** This build's phone half cannot be asked for a song by name. */
export const NEEDS_BUILD = 'ERR_DISCOVER_NEEDS_BUILD';
/** The song was in but could not be put in the library. */
export const KEEP_FAILED = 'ERR_DISCOVER_KEEP_FAILED';
/** The phone's name for anything it has no name for. */
export const UNSORTED = 'ERR_DOWNLOAD_FAILED';

/** The video chosen for it is not one that can be fetched as a song: a live stream, or hours long. The phone's name for it. */
export const NOT_A_SONG = 'ERR_YOUTUBE_NOT_A_SONG';

/**
 * Failures that will be the same however often the song is asked for again,
 * and one that is not to be mended behind anybody's back: a download
 * somebody stopped is theirs to start again.
 */
const LASTING: ReadonlySet<string> = new Set([
  NO_MATCH_CODE, NEEDS_BUILD, STOPPED, NOT_A_SONG,
  'ERR_YOUTUBE_UNAVAILABLE', 'ERR_YOUTUBE_LIVE', 'ERR_YOUTUBE_TOO_LONG', 'ERR_YOUTUBE_INVALID_VIDEO',
  'ERR_YOUTUBE_OUTDATED', 'ERR_YOUTUBE_ENGINE',
]);

export type Item = {
  /** The recording's id in the catalogue. What a row is known by for as long as it is on the list. */
  id: string;
  song: Song;
  addedAt: number;
  /** The download it was last given, and when: see `GRACE_MS`. */
  jobId?: string;
  jobAt?: number;
  /** Its file, as the player takes it. Having one is what ready means. */
  track?: Track;
  /** Somebody tapped it. Its download is theirs and not Discover's own. */
  asked?: boolean;
  /** To be put in the library as soon as its file is in. */
  keep?: boolean;
  failure?: ItemFailure;
  /** When the songs kept ready last tried it again after it failed. Once a day, no more. */
  retriedAt?: number;
  /** When it was first what the player was playing. A song that was heard stays away longer. */
  heardAt?: number;
  /** No recording of it could be found: the row says so until then, and then goes. */
  goneAt?: number;
  /**
   * Its video is being looked for ahead of anybody wanting it, or has been
   * found and is held: see `findAhead`. Nothing is shown for either. The
   * song has a job, and the job is doing nothing that a download does.
   */
  ahead?: 'seeking' | 'found';
  /** When looking for it ahead last came to nothing for a reason that may pass. Not tried again that day. */
  soughtAt?: number;
  /**
   * It is known to be fetchable — its video has been found, or its file is
   * here — and so it is on the screen: see WHAT IS SHOWN, by `reveal`. Once
   * so, always so, for as long as it is on the list. A song without this is
   * in the list and in nobody's sight.
   */
  seen?: true;
};

export type Live = {
  phase: 'waiting' | 'finding' | 'fetching';
  /** What a waiting song is waiting for: to be asked of the phone at all, to be looked for, to be fetched, to be tried again. */
  waitingFor?: 'queue' | 'find' | 'download' | 'retry';
  stage?: 'preparing' | 'downloading' | 'converting' | 'saving';
  progress?: number;
  /** Asked of the phone, which has not yet answered with a job. What the queue says of the song meanwhile is about an older one. */
  pending?: boolean;
};

export type Staged = { items: readonly Item[]; since: number };

/** Why there is no list, or not a whole one: something that is so until it stops being so. */
export type ProblemCode =
  /** The phone has no connection. */
  | 'offline'
  /** There is a connection, and the services the songs come from did not answer. */
  | 'unreachable'
  /** They answered, and what they said was "not so fast". */
  | 'slowDown'
  /** They answered everything, and none of it was a song to recommend. */
  | 'nothing'
  | 'noLibrary' | 'noTaste' | 'exhausted' | 'timedOut'
  /** Asked by hand again too soon after the last asking: Discover's own restraint, not the services'. */
  | 'throttled'
  | 'failed';
export type Problem = { code: ProblemCode; at: number; retryAt?: number };

export type Building = { refresh: boolean; done: number; total: number | null; label: string };

/** The last thing done that somebody may want to know of, or take back. */
export type Notice =
  | { kind: 'kept' | 'restored' | 'refreshed'; id?: string; title?: string; until: number }
  | { kind: 'excluded'; id: string; title: string; artist: string | null; until: number }
  | { kind: 'keepFailed'; id: string; title: string; code: string; until: number };

export type Network = { connected: boolean; wifi: boolean };
export type Player = { currentId: string | null; queue: readonly string[]; key: string; playing: boolean };

export type State = {
  // Written down: see `store.ts`.
  settings: DiscoverSettings;
  list: readonly Item[];
  /** A new list being got ready behind the one on show. */
  staged: Staged | null;
  /** Every song the catalogue came back with, to draw replacements from. */
  pool: readonly Song[];
  refreshedAt: number;
  /** Jobs whose files are no longer anybody's, to be removed when the player is done with them. */
  retired: readonly string[];
  /** When the catalogue was last asked for a pool. Kept, so that closing the app does not earn another go. */
  attemptAt: number;
  problem: Problem | null;
  /**
   * When the catalogue last answered that there is not enough to make a list
   * of, or nothing to go on. Kept apart from `problem`, which somebody can
   * dismiss: dismissed or not, the same question has the same answer for a
   * day, and is not asked again by itself before then.
   */
  fruitlessAt: number;

  // True of this run of the app only.
  live: ReadonlyMap<string, Live>;
  /** Every song that is not to be recommended, by id and by name: what the database holds, and what was added since. */
  away: ReadonlySet<string>;
  /** Artists nobody wants more of, by their catalogue id. */
  hidden: ReadonlySet<string>;
  building: Building | null;
  /** The song to play when it is ready, and what the player's queue was when it was tapped. */
  intent: { id: string; queueKey: string } | null;
  /**
   * The song whose thirty seconds are being heard while it is fetched, or
   * are being looked for to be: see `beginPreview`. Only ever the song that
   * `intent` is waiting for — a preview is the sound of that song arriving,
   * and whatever ends the waiting ends it.
   */
  preview: { id: string; phase: 'finding' | 'playing' } | null;
  player: Player;
  /** Files already handed to the player in this sitting, so that one taken out of its queue by hand is not put back. */
  offered: ReadonlySet<string>;
  network: Network | null;
  paused: boolean;
  /** Why the songs kept ready are not being fetched, when they would be. */
  held: 'wifi' | 'connection' | null;
  /**
   * When the connection is next to be looked at, while something waits on
   * it. A time and not "in half a minute": everything that happens sets the
   * one timer again, and half a minute from the last thing that happened
   * never comes while things go on happening.
   */
  networkAt: number | null;
  /**
   * Jobs that have been told to stop and have not yet been read as stopped,
   * each with the song it was for. Such a song is not asked for until its
   * job is seen to be over. The phone answers two calls in whichever order
   * it gets to them, and a song asked for while its old job is still there
   * is answered with that job — which is then stopped under it, and reads
   * as a download somebody cancelled.
   */
  stopping: ReadonlyMap<string, string>;
  notice: Notice | null;
  undo: { item: Item; index: number; artist: boolean; filler: string | null; until: number } | null;
  /** Discover's own jobs as last read, and whether they have been read at all. */
  jobs: readonly DownloadJob[];
  /** That reading as a word, so that one which says the same as the last changes nothing and nobody is told. */
  jobsKey: string;
  jobsRead: boolean;
  /** Songs asked to be looked for ahead, the phone not having answered yet. What the queue says of them meanwhile is not listened to. */
  seeking: ReadonlySet<string>;
  /** Jobs whose file was read again for a sleeve that came after the song: once each. */
  repictured: ReadonlySet<string>;
  /** Jobs whose file has been asked for, and songs being put in the library: asked once, not at every reading. */
  asking: ReadonlySet<string>;
  keeping: ReadonlySet<string>;
  /** The pool and the list as they were when the pool last had nothing to add: not asked again until one changes. */
  dry: { pool: readonly Song[]; away: ReadonlySet<string>; have: number; staged: number } | null;
};

export type Event =
  | { type: 'jobs'; jobs: readonly DownloadJob[]; paused: boolean }
  | { type: 'track'; id: string; jobId: string; track: Track | null }
  | { type: 'asked'; id: string; jobId: string; hold?: boolean }
  | { type: 'askFailed'; id: string; code: string; detail?: string | null; hold?: boolean }
  | { type: 'play'; id: string }
  /**
   * What became of a preview, from whoever was playing it: `playing` once
   * there is sound, `ended` at its thirty seconds, `none` where there was no
   * preview of that song to be had, `failed`, or `stopped` because something
   * else took the speaker.
   */
  | { type: 'previewed'; id: string; state: 'playing' | 'ended' | 'none' | 'failed' | 'stopped' }
  /** The app is no longer in front. */
  | { type: 'background' }
  | { type: 'keep'; id: string }
  | { type: 'kept'; id: string }
  | { type: 'keepFailed'; id: string; code: string }
  | { type: 'exclude'; id: string; artist?: boolean }
  | { type: 'undo' }
  | { type: 'allow'; id: string; key: string }
  | { type: 'refresh' }
  | { type: 'findMore' }
  | { type: 'dismiss'; what: 'problem' | 'notice' }
  | { type: 'maintain'; network: Network | null; away: ReadonlySet<string>; hidden: ReadonlySet<string> }
  | { type: 'network'; network: Network | null }
  | { type: 'cleaned'; removed: readonly string[] }
  | { type: 'buildProgress'; label: string; done?: number; total?: number }
  | { type: 'built'; refresh: boolean; pool: readonly Song[] }
  | { type: 'buildFailed'; code: ProblemCode }
  | { type: 'settings'; value: DiscoverSettings }
  | { type: 'player'; currentId: string | null; queue: readonly string[]; playing: boolean }
  | { type: 'tick' };

/** Why a song is put away, which is also for how long: see `store.ts`. */
export type AwayReason = 'blocked' | 'saved' | 'played' | 'unplayed' | 'unmatched';

export type Effect =
  /**
   * Ask the phone for the song. `front` is somebody's tap; otherwise it is
   * one of Discover's own. `hold` is only to have its video looked for and
   * kept: nothing is fetched until it is asked for again without.
   */
  | { kind: 'ask'; id: string; song: Song; front: boolean; wifiOnly: boolean; hold: boolean }
  /** Read the finished job's file. */
  | { kind: 'track'; id: string; jobId: string; tags: readonly string[] }
  | { kind: 'play'; tracks: readonly Track[] }
  /** Find thirty seconds of the song and play them, apart from the player and its queue. */
  | { kind: 'preview'; id: string; song: Song }
  | { kind: 'stopPreview' }
  | { kind: 'append'; tracks: readonly Track[] }
  /** Take these files out of the player's queue. Taking out the one that is playing moves on to the next. */
  | { kind: 'dequeue'; trackIds: readonly string[] }
  | { kind: 'away'; song: Song; reason: AwayReason }
  | { kind: 'allow'; id: string }
  | { kind: 'hideArtist'; song: Song }
  | { kind: 'showArtist'; artistMbid: string }
  | { kind: 'keep'; id: string; jobId: string; tags: readonly string[] }
  | { kind: 'cancel'; jobId: string }
  | { kind: 'clean'; ids: readonly string[] }
  | { kind: 'build'; refresh: boolean }
  | { kind: 'network' };

/**
 * How long a row says no recording was found before the next song has its
 * place: not at all.
 *
 * It said so for four seconds, in red, on a song the list itself had offered
 * a moment before, and what it said was nearly always untrue: the song was
 * there and the search had not known it for what it was. The search is
 * looser now (see `chooseVideo`), and where it still comes back with nothing
 * the song gives up its place without a word, as one looked for ahead of a
 * tap always has.
 */
export const NO_MATCH_SHOWN_MS = 0;
/** How long an exclusion can be taken back, and how long any other notice stands. */
export const UNDO_MS = 10_000;
export const NOTICE_MS = 6_000;
/**
 * How long a new list is waited for before it is shown as far as it has got.
 *
 * A new list takes the old one's place when its first few songs are ready,
 * so that the first tap on it plays. But the wait has to end: on a slow
 * connection, or behind a queue of somebody's own downloads, those few songs
 * are many minutes away, and a refresh that seems to have done nothing is
 * worse than a list whose songs take a moment each.
 */
export const STAGE_WAIT_MS = 4 * 60_000;
/** How often the catalogue may be asked for a pool by itself, and how soon again by somebody pressing. */
export const BUILD_EVERY_MS = 15 * 60_000;
export const BUILD_AGAIN_MS = 60_000;
/** How long after a failure the songs kept ready leave a song before the one more try a day it gets. */
export const RETRY_AFTER_MS = 10 * 60_000;
/**
 * How long a job just asked for may be missing from a reading of the queue
 * without the song being taken to have lost it. A reading under way when the
 * job was made does not have it, and arrives after the answer that does.
 */
export const GRACE_MS = 5_000;
/**
 * How many songs are being looked for ahead at a time.
 *
 * The phone makes the searches one after another with a gap between them
 * whatever is asked of it, so this is not a pace. It is how far ahead of the
 * answers the asking runs: enough that the phone always has the next one to
 * go on with, and few enough that a list which changes — a refresh, a song
 * taken off — leaves little asked for in vain.
 */
export const FIND_AHEAD_AT_ONCE = 3;
/**
 * Whether songs are looked for ahead on mobile data when the songs kept
 * ready are held to Wi-Fi. They are. "Wi-Fi only" is about megabytes, and a
 * search is a few kilobytes that fetches nothing; what it buys is that a tap
 * — which is allowed mobile data — is half as long a wait. The one place
 * this is decided: the phone only does as each job says.
 */
export const FIND_AHEAD_ON_MOBILE_DATA = true;
/** How often the connection is looked at again while songs wait for one. */
export const NETWORK_EVERY_MS = 30_000;

const NO_LIVE: ReadonlyMap<string, Live> = new Map();
const NONE: ReadonlySet<string> = new Set();
const NO_STOPPING: ReadonlyMap<string, string> = new Map();
const NO_PLAYER: Player = { currentId: null, queue: [], key: '', playing: false };

/** What is written down, as it is read back: see `store.ts`. */
export type Kept = Pick<State, 'list' | 'staged' | 'pool' | 'refreshedAt' | 'retired' | 'attemptAt' | 'problem' | 'fruitlessAt'>;

export function initial(
  kept: Kept,
  settings: DiscoverSettings,
  away: ReadonlySet<string> = NONE,
  hidden: ReadonlySet<string> = NONE
): State {
  return {
    ...kept,
    settings,
    live: NO_LIVE,
    away,
    hidden,
    building: null,
    intent: null,
    preview: null,
    player: NO_PLAYER,
    offered: NONE,
    network: null,
    paused: false,
    held: null,
    networkAt: null,
    stopping: NO_STOPPING,
    notice: null,
    undo: null,
    jobs: [],
    jobsKey: '',
    jobsRead: false,
    seeking: NONE,
    repictured: NONE,
    asking: NONE,
    keeping: NONE,
    dry: null,
  };
}

export const EMPTY: Kept = {
  list: [], staged: null, pool: [], refreshedAt: 0, retired: [], attemptAt: 0, problem: null, fruitlessAt: 0,
};

/** A state being worked on: the one function's worth of it that is allowed to be put together piece by piece. */
type Draft = { s: State; fx: Effect[]; now: number };

/** Changes the state, by making another. A change that changes nothing leaves the one there is: being the same object is how "nothing happened" is told. */
function set(d: Draft, patch: Partial<State>): void {
  const keys = Object.keys(patch) as (keyof State)[];
  if (keys.every((key) => d.s[key] === patch[key])) return;
  d.s = { ...d.s, ...patch };
}

function added<T>(all: ReadonlySet<T>, ...values: T[]): ReadonlySet<T> {
  if (values.every((value) => all.has(value))) return all;
  return new Set([...all, ...values]);
}

function without<T>(all: ReadonlySet<T>, ...values: T[]): ReadonlySet<T> {
  if (!values.some((value) => all.has(value))) return all;
  const next = new Set(all);
  for (const value of values) next.delete(value);
  return next;
}

/** Every song there is a row for, the list's and then the new list's. */
function everyItem(s: State): readonly Item[] {
  return s.staged ? [...s.list, ...s.staged.items] : s.list;
}

export function itemOf(s: State, id: string): Item | undefined {
  return s.list.find((item) => item.id === id) ?? s.staged?.items.find((item) => item.id === id);
}

/** Puts [next] where the item of the same id is, in whichever list that is. Nothing else in either list is touched. */
function replace(d: Draft, next: Item): void {
  const swap = (items: readonly Item[]) => {
    const at = items.findIndex((item) => item.id === next.id);
    if (at < 0 || items[at] === next) return items;
    const copy = [...items];
    copy[at] = next;
    return copy;
  };
  const list = swap(d.s.list);
  if (list !== d.s.list) return set(d, { list });
  if (!d.s.staged) return;
  const items = swap(d.s.staged.items);
  if (items !== d.s.staged.items) set(d, { staged: { ...d.s.staged, items } });
}

function sameLive(a: Live | undefined, b: Live | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.phase === b.phase && a.waitingFor === b.waitingFor && a.stage === b.stage &&
    a.progress === b.progress && !!a.pending === !!b.pending;
}

function setLive(d: Draft, id: string, live: Live | undefined): void {
  if (sameLive(d.s.live.get(id), live)) return;
  const next = new Map(d.s.live);
  if (live) next.set(id, live);
  else next.delete(id);
  set(d, { live: next });
}

function retire(d: Draft, ...jobIds: (string | undefined)[]): void {
  const fresh = jobIds.filter((id): id is string => !!id && !d.s.retired.includes(id));
  if (fresh.length) set(d, { retired: [...d.s.retired, ...fresh] });
}

/** A row that is no longer a song: no recording of it was found, and it is only there to say so before it leaves. */
function gone(item: Item): boolean {
  return item.goneAt != null;
}

function isWaitingWifi(item: Item): boolean {
  return item.failure?.code === WAITING_WIFI;
}

/**
 * Whether the songs kept ready may ask again for a song that failed.
 *
 * The queue has already tried it twice by the time it says failed, so the
 * fault is not a moment's. It gets one more go a day and not at once: a song
 * that fails every time would otherwise be asked for at every pass, forever,
 * with a search of YouTube each time. A failure that will be the same
 * tomorrow is left for somebody to tap, or to take off the list.
 */
function retryable(item: Item, now: number): boolean {
  const failure = item.failure;
  if (!failure || LASTING.has(failure.code)) return false;
  if (now - failure.at < RETRY_AFTER_MS) return false;
  return item.retriedAt == null || now - item.retriedAt >= DAY;
}

/**
 * Songs to add to [retained] to bring it up to [count], best first.
 *
 * Which songs is `selectSongs`'s to say, and it says it by handing back the
 * whole list it would make. Only what it added is taken from that, and where
 * it goes is not asked of it: at the end, after everything that is already
 * on show. A row that somebody is about to tap does not move because another
 * song joined the list.
 */
function picks(s: State, retained: readonly Item[], count: number, others: readonly Item[]): Song[] {
  if (retained.length >= count || !s.pool.length) return [];
  const excluded = new Set(s.away);
  for (const item of others) {
    excluded.add(item.id);
    excluded.add(songKey(item.song));
  }
  const have = new Set(retained.map((item) => item.id));
  const chosen = selectSongs([...s.pool], retained.map((item) => item.song), count, excluded);
  return chosen.filter((song) => !have.has(song.recordingMbid)).slice(0, count - retained.length);
}

function fresh(song: Song, now: number): Item {
  return { id: song.recordingMbid, song, addedAt: now };
}

/** A song is put away, here and in the database, so that nothing chosen from now on is it. */
function putAway(d: Draft, song: Song, reason: AwayReason): void {
  d.fx.push({ kind: 'away', song, reason });
  set(d, { away: added(d.s.away, song.recordingMbid, songKey(song)) });
}

/** Tells a job to stop, and notes that it has been told: see `stopping`. */
function stop(d: Draft, jobId: string, songId: string): void {
  d.fx.push({ kind: 'cancel', jobId });
  if (d.s.stopping.get(jobId) !== songId) set(d, { stopping: new Map(d.s.stopping).set(jobId, songId) });
}

/** Whether the song's last job is still on its way out, so that asking for the song now would be answered with it. */
function beingStopped(s: State, id: string): boolean {
  for (const song of s.stopping.values()) if (song === id) return true;
  return false;
}

/** Stops whatever the song's job is doing, where it is doing anything, and gives its file up. */
function release(d: Draft, item: Item): void {
  // Being fetched, being looked for ahead, or found and held: whichever it is, it is nobody's now.
  if (item.jobId && (d.s.live.has(item.id) || item.ahead)) stop(d, item.jobId, item.id);
  if (d.s.seeking.has(item.id)) set(d, { seeking: without(d.s.seeking, item.id) });
  retire(d, item.jobId);
  setLive(d, item.id, undefined);
  if (d.s.intent?.id === item.id) set(d, { intent: null });
  if (d.s.keeping.has(item.id)) set(d, { keeping: without(d.s.keeping, item.id) });
}

/**
 * Asks the phone for a song.
 *
 * From the moment of asking the song is waiting, and says so, before the
 * phone has answered: the row somebody tapped changes under their finger and
 * not a bridge call later. What the queue says of the song until the answer
 * comes is about whatever job it had before, and is not listened to.
 */
function ask(d: Draft, item: Item, front: boolean): void {
  let next = item;
  if (item.failure || item.ahead || (front && !item.asked)) {
    // Wanted in earnest now: whatever was held for it is let go by the asking, and it is no longer "ahead".
    const { failure: _failure, ahead: _ahead, ...rest } = item;
    next = front ? { ...rest, asked: true } : rest;
  }
  if (next !== item) replace(d, next);
  // Its old job is still being stopped. Marked as asked for, it is asked for when that is over: see `askTapped`.
  if (beingStopped(d.s, item.id)) return;
  const was = d.s.live.get(item.id);
  setLive(d, item.id, was ? { ...was, pending: true } : { phase: 'waiting', waitingFor: 'queue', pending: true });
  d.fx.push({ kind: 'ask', id: item.id, song: item.song, front, wifiOnly: !front && d.s.settings.wifiOnly, hold: false });
}

/** The files that follow [from] in the order of the list, round to the row before it: what the player is given to go on with. */
function following(list: readonly Item[], from: number): Item[] {
  return [...list.slice(from + 1), ...list.slice(0, Math.max(from, 0))];
}

/** Where on the list the player is, or -1 where what it is playing is not one of the list's. */
function playingAt(s: State): number {
  const current = s.player.currentId;
  if (!current || !current.startsWith('discover:')) return -1;
  return s.list.findIndex((item) => item.track?.id === current);
}

/**
 * The songs that are to be ready, in the order they are wanted.
 *
 * "The next few" is the next few after what is playing, when Discover is
 * what is playing, and the first few of the list when it is not. Either way
 * it is a window of so many rows and not a count of files: once the rows in
 * it are ready nothing more is fetched, until somebody plays on, or takes a
 * song off the list and another moves into the window. That is the
 * difference from what this replaced, which went on until the whole list was
 * on the phone because one song had been tapped.
 *
 * A row that can never be made ready — no recording, a video that is not a
 * song, a download somebody stopped — does not use up a place: the window
 * reaches one further. A row that failed for a reason that may pass does
 * use its place, tried again or not. Otherwise a bad quarter of an hour —
 * YouTube refusing, a connection that drops — would walk the window down
 * the whole list, each song searched for and tried twice and failed, which
 * is the very thing being refused for.
 */
export function wanted(s: State, now: number): Item[] {
  const count = s.settings.ready;
  if (count <= 0) return [];
  const window = (items: readonly Item[]) => {
    const taken: Item[] = [];
    for (const item of items) {
      if (taken.length >= count) break;
      // Only songs that are on the screen. One not yet confirmed is looked for first, and taken up here when it is found.
      if (gone(item) || !item.seen) continue;
      if (!item.track && !s.live.has(item.id) && item.failure && LASTING.has(item.failure.code)) continue;
      taken.push(item);
    }
    return taken;
  };
  const askable = (item: Item) =>
    !item.track && !s.live.has(item.id) && !beingStopped(s, item.id) &&
    (!item.failure || isWaitingWifi(item) || retryable(item, now));
  const at = playingAt(s);
  // A new list in the making is what is wanted next; the one on show only while it is being played from.
  const rows = s.staged
    ? [...window(s.staged.items), ...(at >= 0 ? window(following(s.list, at)) : [])]
    : window(at >= 0 ? following(s.list, at) : s.list);
  return rows.filter(askable);
}

/** How many confirmed songs a new list has to have before it is worth showing in the old one's place, where none are fetched ahead. */
export const STAGE_SHOWS = 5;

/** The songs of [items] that are on the screen, or would be: the confirmed ones, in their order. */
export function seenOf(items: readonly Item[]): Item[] {
  return items.filter((item) => item.seen && !gone(item));
}

/**
 * How far a new list has got towards being worth showing.
 *
 * A list is worth showing for the songs in it that are known to be there,
 * not for the ones that were chosen. So what is counted is confirmed songs:
 * where songs are kept ready, the first so-many of them with their files in,
 * as before; where none are, the first [STAGE_SHOWS] confirmed and nothing
 * more — never fewer than one, and no more than the list could ever have.
 */
export function stagedProgress(s: State): { ready: number; target: number } | null {
  if (!s.staged) return null;
  const all = s.staged.items.filter((item) => !gone(item));
  const seen = seenOf(all);
  if (s.settings.ready > 0) {
    const target = Math.max(1, Math.min(s.settings.ready, all.length));
    return { ready: seen.slice(0, target).filter((item) => item.track).length, target };
  }
  const target = Math.max(1, Math.min(STAGE_SHOWS, all.length));
  return { ready: Math.min(seen.length, target), target };
}

/**
 * The new list takes the old one's place.
 *
 * Every song of the old list is put away: for a season if it was heard, a
 * fortnight if it never was. One that was only ever a title in a list has
 * not been turned down, and a season is a long time to hide a song from
 * somebody who never tried it. Their files are given up, and are removed
 * once the player has no more use for them — the old list may be what is
 * playing, and goes on playing.
 */
function swap(d: Draft): void {
  const staged = d.s.staged;
  if (!staged) return;
  // A new list with no song left in it is no list. The old one stays, and why is said.
  if (!shown(staged.items).length) {
    for (const item of staged.items) release(d, item);
    set(d, { staged: null, problem: { code: 'exhausted', at: d.now }, fruitlessAt: d.now });
    return;
  }
  /*
    A song somebody pressed keep on is not the old list's to take away with
    it. Still coming down, or being copied into the library this moment, it
    goes with the new list, at the end, and leaves from there when it is in.
  */
  const carried = d.s.list.filter((item) => !gone(item) && (item.keep || d.s.keeping.has(item.id)));
  for (const item of d.s.list) {
    if (carried.includes(item)) continue;
    // Only what was ever on the screen is put away. A song that was never confirmed was never offered.
    if (!gone(item) && item.seen) putAway(d, item.song, item.heardAt ? 'played' : 'unplayed');
    release(d, item);
  }
  set(d, {
    // What is confirmed of the new list first, in its order, so that what follows joins at the end: see `reveal`.
    list: [...seenOf(staged.items), ...carried, ...staged.items.filter((item) => !item.seen)],
    staged: null,
    refreshedAt: d.now,
    undo: null,
    notice: { kind: 'refreshed', until: d.now + NOTICE_MS },
    dry: null,
  });
}

/** The rows that are songs, as against rows saying a song could not be found. */
function shown(items: readonly Item[]): Item[] {
  return items.filter((item) => !gone(item));
}

/** Puts one song on the screen now, after every song already there. See WHAT IS SHOWN. */
function show(d: Draft, id: string): void {
  const place = (items: readonly Item[]): readonly Item[] => {
    const item = items.find((other) => other.id === id);
    if (!item || item.seen) return items;
    const rest = items.filter((other) => other !== item);
    const after = rest.reduce((last, other, at) => (other.seen ? at : last), -1);
    return [...rest.slice(0, after + 1), { ...item, seen: true as const }, ...rest.slice(after + 1)];
  };
  const list = place(d.s.list);
  if (list !== d.s.list) return set(d, { list });
  if (!d.s.staged) return;
  const items = place(d.s.staged.items);
  if (items !== d.s.staged.items) set(d, { staged: { ...d.s.staged, items } });
}

/**
 * WHAT IS SHOWN.
 *
 * A song is on the screen only once it is known that it can be fetched: its
 * video has been found, or its file is here. Until then it is in the list —
 * chosen, in its place, being looked for — and drawn nowhere, counted
 * nowhere, and reachable by nothing a person can do. The list used to show
 * every song the moment it was chosen and find out afterwards which of them
 * YouTube had; the ones it had not were a row that turned red, or vanished,
 * under whoever was reading it. A row that would have done that now never
 * comes.
 *
 * So a new list fills in, a song at a time, as each is confirmed. And since
 * the promise of this screen is that no row moves under a finger, a song is
 * given its place when it is first seen and not before: AFTER every song
 * already on the screen. The songs are looked for in the order of the list,
 * one at a time, so that is nearly always where it stood anyway. Where it
 * is not — the third was looked for again a day later, after the fourth and
 * fifth had been found — it is the unseen song that moves, which nobody was
 * looking at. What is on the screen only ever grows at the end.
 */
function reveal(d: Draft): void {
  const arrange = (items: readonly Item[]): readonly Item[] => {
    if (!items.some((item) => !item.seen && !gone(item) && (item.track || item.ahead === 'found'))) return items;
    const seen: Item[] = [];
    const fresh: Item[] = [];
    const unseen: Item[] = [];
    for (const item of items) {
      if (item.seen) seen.push(item);
      else if (!gone(item) && (item.track || item.ahead === 'found')) fresh.push({ ...item, seen: true });
      else unseen.push(item);
    }
    return [...seen, ...fresh, ...unseen];
  };
  const list = arrange(d.s.list);
  if (list !== d.s.list) set(d, { list });
  if (d.s.staged) {
    const items = arrange(d.s.staged.items);
    if (items !== d.s.staged.items) set(d, { staged: { ...d.s.staged, items } });
  }
}

/** Whether a song nobody can see yet may still come to be seen without anybody doing anything: it is being looked for, or will be today. */
export function confirmable(s: State, item: Item, now: number): boolean {
  if (item.seen || gone(item)) return false;
  if (item.jobId || s.seeking.has(item.id) || s.live.has(item.id)) return true;
  return item.soughtAt == null || now - item.soughtAt >= DAY || now < item.soughtAt;
}

/**
 * Everything that follows from what is now so.
 *
 * Run after every event, whatever it was, and written so that running it
 * twice does nothing the second time. An event only records the fact it
 * brings — this job finished, that row was tapped — and what is to be done
 * about the facts taken together is worked out here, in one place and one
 * order. So "the tapped song is ready, play it" is said once, and is true
 * whether the file came in after the tap or was there all along.
 */
function settle(d: Draft): void {
  const now = d.now;

  // A row that said no recording was found has said it for long enough.
  for (const item of everyItem(d.s)) {
    if (item.goneAt != null && item.goneAt <= now) remove(d, item.id);
  }
  if (d.s.notice && d.s.notice.until <= now) set(d, { notice: null });
  if (d.s.undo && d.s.undo.until <= now) set(d, { undo: null });
  if (d.s.problem?.retryAt != null && d.s.problem.retryAt <= now) set(d, { problem: null });

  fill(d);

  reveal(d);

  /*
    The new list is shown once it is worth showing, or it has been waited
    for long enough — and in neither case with nothing in it. A list is
    worth showing for its confirmed songs: with none yet, the old one stays
    up however long that has been, because an empty screen in place of a
    list of songs is the one thing a refresh must not do. It is given up
    only when it has no song left that could still be confirmed.
  */
  if (d.s.staged) {
    const progress = stagedProgress(d.s)!;
    const some = seenOf(d.s.staged.items).length > 0;
    const waited = now - d.s.staged.since >= STAGE_WAIT_MS;
    // With the songs kept ready held for want of Wi-Fi there are no files to wait for: confirmed is as far as it gets.
    const enough = progress.ready >= progress.target ||
      (d.s.held != null && seenOf(d.s.staged.items).length >= Math.min(STAGE_SHOWS, shown(d.s.staged.items).length));
    if (some && (enough || waited)) swap(d);
    else if (!shown(d.s.staged.items).length) swap(d);
    else if (!some && waited && !d.s.staged.items.some((item) => confirmable(d.s, item, now))) {
      for (const item of d.s.staged.items) release(d, item);
      set(d, { staged: null, problem: { code: 'exhausted', at: now }, fruitlessAt: now });
    }
  }

  for (const item of d.s.list) {
    if (!item.keep || !item.track || !item.jobId || d.s.keeping.has(item.id)) continue;
    set(d, { keeping: added(d.s.keeping, item.id) });
    d.fx.push({ kind: 'keep', id: item.id, jobId: item.jobId, tags: item.song.tags ?? [] });
  }

  playIntended(d);
  // A preview is of the song that is being waited for. No longer waited for — failed, gone, something else put on — it is over.
  if (d.s.preview && d.s.intent?.id !== d.s.preview.id) endPreview(d);
  appendReady(d);
  /*
    Nothing is asked for in the same breath as something is stopped. The
    stopping is a call to the phone and so is the asking, the phone gets to
    them in whichever order it likes, and the reading of the queue that
    follows the stop is one event away: the asking is done then.
  */
  if (!d.fx.some((effect) => effect.kind === 'cancel')) {
    askTapped(d);
    keepReady(d);
    findAhead(d);
  }

  // The connection is looked at again, at a time that is kept, for as long as anything waits on it.
  const watching = d.s.held != null || d.s.problem?.code === 'offline';
  if (!watching) set(d, { networkAt: null });
  else if (d.s.networkAt == null) set(d, { networkAt: now + NETWORK_EVERY_MS });
}

/**
 * Asks for a song somebody tapped or pressed keep on while its last job was
 * still being stopped, now that it has stopped. Theirs, and so at the front.
 */
function askTapped(d: Draft): void {
  for (const item of d.s.list) {
    if (!item.asked || item.track || item.jobId || item.failure || gone(item)) continue;
    if (d.s.live.has(item.id) || beingStopped(d.s, item.id)) continue;
    ask(d, item, true);
  }
}

/** Takes a row out, and whatever was being done for it with it. */
function remove(d: Draft, id: string): void {
  const item = itemOf(d.s, id);
  if (!item) return;
  release(d, item);
  if (d.s.list.includes(item)) set(d, { list: d.s.list.filter((other) => other !== item) });
  else if (d.s.staged) set(d, { staged: { ...d.s.staged, items: d.s.staged.items.filter((other) => other !== item) } });
}

/**
 * Brings both lists up to their number from the pool, at the end of each.
 *
 * Asked of the pool once for each state of things. A pool with nothing more
 * to give is remembered as dry for the lists as they stand, and is not gone
 * through again at every reading of the queue.
 */
function fill(d: Draft): void {
  const s = d.s;
  const count = s.settings.count;
  const have = shown(s.list).length;
  const staged = s.staged ? shown(s.staged.items).length : count;
  if (have >= count && staged >= count) return;
  if (s.dry && s.dry.pool === s.pool && s.dry.away === s.away && s.dry.have === have && s.dry.staged === staged) return;

  let grew = false;
  if (have < count) {
    const more = picks(s, shown(s.list), count, s.staged?.items ?? []);
    if (more.length) {
      set(d, { list: [...d.s.list, ...more.map((song) => fresh(song, d.now))] });
      grew = true;
      // Short for want of songs, and no longer short.
      if (d.s.problem?.code === 'exhausted' && have + more.length >= count) set(d, { problem: null });
    }
  }
  if (d.s.staged && staged < count) {
    const more = picks(d.s, shown(d.s.staged.items), count, d.s.list);
    if (more.length) {
      set(d, { staged: { ...d.s.staged, items: [...d.s.staged.items, ...more.map((song) => fresh(song, d.now))] } });
      grew = true;
    }
  }
  if (!grew) set(d, { dry: { pool: s.pool, away: s.away, have, staged } });
}

/**
 * Plays the song somebody tapped, if it is ready and they are still waiting.
 *
 * They are not, if the player has been given something else since: another
 * queue started from the library while the song was on its way is what they
 * want to hear now, and the song arriving must not take it from them. A
 * queue of Discover's own songs is not "something else" — that is this list
 * playing, and tapping another row of it means play that one.
 */
function playIntended(d: Draft): void {
  const intent = d.s.intent;
  if (!intent) return;
  const at = d.s.list.findIndex((item) => item.id === intent.id);
  const item = d.s.list[at];
  if (!item || gone(item) || (item.failure && !d.s.live.has(item.id))) return set(d, { intent: null });
  const elsewhere = d.s.player.key !== intent.queueKey && !d.s.player.currentId?.startsWith('discover:');
  if (elsewhere) return set(d, { intent: null });
  if (!item.track) return;
  start(d, at);
}

/**
 * Answers a tap on a song that is not ready with thirty seconds of it, to
 * be heard while it is fetched.
 *
 * Asked for and not waited for. Where there turns out to be no preview of
 * the song — none that is certainly the same recording — nothing is said
 * and the tap is what it always was: a row that is on its way. The preview
 * belongs to the tap, and so to `intent`; `settle` ends it whenever the
 * intent is over, which is once for every way that can come about: the song
 * starts, the song fails, the row goes, something else is put on.
 *
 * Never with no connection known: there is nothing to play it from.
 */
function beginPreview(d: Draft, item: Item): void {
  if (!previewsOn(d.s.settings) || (d.s.network && !d.s.network.connected)) return;
  set(d, { preview: { id: item.id, phase: 'finding' } });
  d.fx.push({ kind: 'preview', id: item.id, song: item.song });
}

/** Stops the preview there is, if there is one. */
function endPreview(d: Draft): void {
  if (!d.s.preview) return;
  set(d, { preview: null });
  d.fx.push({ kind: 'stopPreview' });
}

/** Hands the player the song at [at] and every ready song after it. */
function start(d: Draft, at: number): void {
  // The song itself, from its start: whatever preview was playing stops first, this song's or another's.
  endPreview(d);
  const tracks = [d.s.list[at], ...following(d.s.list, at)]
    .map((item) => item.track)
    .filter((track): track is Track => !!track);
  d.fx.push({ kind: 'play', tracks });
  const ids = tracks.map((track) => track.id);
  set(d, {
    intent: null,
    offered: new Set(ids),
    // As the player will say it is, a moment from now. Said here so that nothing decided before it answers is decided on the old queue.
    player: { currentId: ids[0], queue: ids, key: ids.join('|'), playing: true },
  });
}

/**
 * Adds songs that have become ready to the queue Discover is playing from.
 *
 * In the order of the list, from the one that is playing. Each file is
 * offered once: one somebody then took out of the queue by hand stays out.
 */
function appendReady(d: Draft): void {
  const at = playingAt(d.s);
  if (at < 0) return;
  const queued = new Set(d.s.player.queue);
  const tracks = following(d.s.list, at)
    .map((item) => item.track)
    .filter((track): track is Track => !!track && !queued.has(track.id) && !d.s.offered.has(track.id));
  if (!tracks.length) return;
  d.fx.push({ kind: 'append', tracks });
  set(d, { offered: added(d.s.offered, ...tracks.map((track) => track.id)) });
}

/**
 * Asks for the songs that are to be ready and are not.
 *
 * As Discover's own: behind anything a person asked for, after the quiet the
 * queue keeps between its own. And only on the connection the settings
 * allow. Where that is what stops them the reason is kept, to be said once
 * over the list and not on each row, and nothing is asked for: a job that
 * would only fail for want of Wi-Fi is a failure made on purpose.
 */
function keepReady(d: Draft): void {
  if (d.s.paused || !d.s.jobsRead) return;
  const rows = wanted(d.s, d.now);
  if (!rows.length) return set(d, { held: null });
  const network = d.s.network;
  if (!network) return;
  const held = !network.connected ? 'connection' : d.s.settings.wifiOnly && !network.wifi ? 'wifi' : null;
  if (held !== d.s.held) set(d, { held });
  if (held) return;
  for (const row of rows) {
    // The one more try a failed song gets is noted, so that it is the one.
    if (row.failure && !isWaitingWifi(row)) replace(d, { ...row, retriedAt: d.now });
    ask(d, itemOf(d.s, row.id)!, false);
  }
}

/** Whether a song is one to look for ahead: nothing has been done about it, and nothing is being. */
function seekable(s: State, item: Item, now: number): boolean {
  if (item.seen || gone(item) || item.track || item.jobId || item.failure || item.ahead || item.asked || item.keep) return false;
  if (s.live.has(item.id) || s.seeking.has(item.id) || beingStopped(s, item.id)) return false;
  return item.soughtAt == null || now - item.soughtAt >= DAY || now < item.soughtAt;
}

/**
 * Has the videos of the songs nobody has asked for looked for, ahead of
 * anybody asking.
 *
 * A tap on a song that is not ready used to begin with a search of YouTube,
 * three seconds of the ten before sound — and now and then ended with "no
 * recording was found" after the wait. Neither need happen at the tap. The
 * search fetches nothing and can be made beforehand: every song on the list
 * that is not ready, not being fetched and not already found is looked for,
 * in the order of the list, and what is found is held. A tap then asks for
 * a download and nothing else, and a song with no recording has been off the
 * list since before anybody tried it.
 *
 * After the songs kept ready have been asked for, which are wanted more. A
 * few at a time. The list on show first and a new list in the making after
 * it. Never a song twice: one that has a job of any kind, held or finished
 * or failed, is not looked for, and one whose search came to nothing for a
 * passing reason waits a day. So the whole of it is at most one search for
 * each song that is ever on a list — fewer than the taps it saves would have
 * made, since a tap searched too.
 */
function findAhead(d: Draft): void {
  if (d.s.paused || !d.s.jobsRead) return;
  const network = d.s.network;
  if (!network?.connected) return;
  if (!FIND_AHEAD_ON_MOBILE_DATA && d.s.settings.wifiOnly && !network.wifi) return;
  const rows = everyItem(d.s);
  let under = rows.filter((item) => item.ahead === 'seeking' || d.s.seeking.has(item.id)).length;
  for (const item of rows) {
    if (under >= FIND_AHEAD_AT_ONCE) return;
    if (!seekable(d.s, item, d.now)) continue;
    set(d, { seeking: added(d.s.seeking, item.id) });
    // Being looked for again: that it came to nothing before is no longer what is so of it.
    if (item.soughtAt != null) {
      const { soughtAt: _sought, ...rest } = item;
      replace(d, rest);
    }
    d.fx.push({ kind: 'ask', id: item.id, song: item.song, front: false, wifiOnly: false, hold: true });
    under += 1;
  }
}

/**
 * What the queue says of a song that is being looked for ahead, or is held.
 *
 * Nothing that shows. Waiting, being looked for and found are all the same
 * row to look at: a song nobody has asked for. What it comes to is noted on
 * the song. No recording to be found takes the song off the list at once,
 * with none of the moment a tapped song is given to say so — nobody asked
 * for it, and a row that turned red and vanished by itself would be the list
 * fidgeting. A search that failed for a passing reason, or was stopped, is
 * forgotten until tomorrow, and the song is as it was: tapped, it is looked
 * for then.
 */
function heldJob(d: Draft, item: Item, job: DownloadJob): Item {
  switch (job.status) {
    case 'found':
      return item.ahead === 'found' ? item : { ...item, ahead: 'found' };
    case 'failed':
      if ((job.errorCode === NO_MATCH_CODE || job.errorCode === NOT_A_SONG) && !item.seen) {
        putAway(d, item.song, 'unmatched');
        // No longer being looked for: its job is over, and there is nothing of it to stop.
        const { ahead: _ahead, ...rest } = item;
        return { ...rest, failure: { code: job.errorCode, at: d.now, job: job.id }, goneAt: d.now };
      }
    // Any other failure goes the way of one that was stopped.
    // falls through
    case 'cancelled':
    case 'missing':
    case 'done': {
      retire(d, job.id);
      const { jobId: _job, jobAt: _at, ahead: _ahead, ...rest } = item;
      return { ...rest, soughtAt: d.now };
    }
    default:
      return item.ahead === 'seeking' ? item : { ...item, ahead: 'seeking' };
  }
}

/**
 * What the queue says of each song.
 *
 * A song's job is the one it was given, or failing that the one the queue
 * has for its recording — which is how a job asked for the moment before the
 * app was closed is found again, never having been written down here. What
 * the job is doing is put in `live`; what it came to is put on the song.
 */
function readJobs(d: Draft, jobs: readonly DownloadJob[], paused: boolean): void {
  const byId = new Map<string, DownloadJob>();
  const byKey = new Map<string, DownloadJob>();
  const retired = new Set(d.s.retired);
  const word: string[] = [];
  for (const job of jobs) {
    byId.set(job.id, job);
    word.push(`${job.id}:${job.status}:${job.progress}:${job.retrying ? 1 : 0}:${job.errorCode ?? ''}`);
    const key = job.discoverKey;
    if (!key || retired.has(job.id) || !(job.status === 'done' || isLive(job))) continue;
    // The phone's order is oldest first; the newest job for a recording is the one that counts.
    byKey.set(key, job);
  }
  /*
    The queue is read every second while anything at all is being fetched,
    Discover's or not, and most readings say what the last one said. Such a
    reading is still gone through below — a job that has been missing for
    long enough is noticed by the time passing, not by the reading changing —
    but it is not kept, so that if nothing comes of it the state is the
    object it was and nobody is told there is anything new.
  */
  const jobsKey = word.join('|');
  if (jobsKey !== d.s.jobsKey || paused !== d.s.paused || !d.s.jobsRead) set(d, { jobs, jobsKey, paused, jobsRead: true });

  // A job told to stop that is no longer in the queue, or no longer doing anything, has stopped.
  if (d.s.stopping.size) {
    const still = new Map([...d.s.stopping].filter(([id]) => { const job = byId.get(id); return !!job && isLive(job); }));
    if (still.size !== d.s.stopping.size) set(d, { stopping: still.size ? still : NO_STOPPING });
  }

  for (const before of everyItem(d.s)) {
    const was = d.s.live.get(before.id);
    if (was?.pending || d.s.seeking.has(before.id)) continue;
    let item = before;
    let job = item.jobId ? byId.get(item.jobId) : undefined;
    if (!job) {
      const found = byKey.get(item.id);
      if (found) {
        job = found;
        item = { ...item, jobId: found.id, jobAt: d.now };
      }
    }
    if (!job) {
      /*
        Asked for a moment ago, and this reading was begun before the phone
        had made the job. It says nothing about the song, and the song is
        left exactly as it is — still waiting, to the screen and to the
        songs kept ready, which would otherwise ask for it a second time.
      */
      if (item.jobId && d.now - (item.jobAt ?? 0) <= GRACE_MS) continue;
      // Its job is gone from the queue, and so is the file that went with it.
      if (item.jobId) {
        const { jobId: _job, track: _track, jobAt: _at, ...rest } = item;
        item = rest;
      }
      if (item !== before) replace(d, item);
      setLive(d, item.id, undefined);
      continue;
    }

    if (job.hold || job.status === 'found') {
      item = heldJob(d, item, job);
      if (item !== before) replace(d, item);
      setLive(d, item.id, undefined);
      // Found: on the screen from now, in its turn among the songs this reading has to show.
      if (item.ahead === 'found' && !item.seen && !gone(item)) show(d, item.id);
      continue;
    }
    // Let go since it was last read: an ordinary download from here on.
    if (item.ahead) {
      const { ahead: _ahead, ...rest } = item;
      item = rest;
    }
    // Its file is here already, told of by the phone ahead of the queue's own record of it.
    const have = item.track?.id === `discover:${job.id}`;
    // Past the search: its video is known, whatever becomes of the fetching. That is a song that can be shown.
    const found = !job.video.find && !!job.video.id;

    let live: Live | undefined;
    switch (job.status) {
      case 'queued':
        live = { phase: 'waiting', waitingFor: job.retrying ? 'retry' : job.video.find ? 'find' : 'download' };
        break;
      case 'finding':
        live = { phase: 'finding' };
        break;
      case 'preparing':
      case 'downloading':
      case 'converting':
      case 'saving':
        if (!have) live = { phase: 'fetching', stage: job.status, progress: job.status === 'downloading' ? job.progress : undefined };
        break;
      case 'cancelling':
        live = was;
        break;
      case 'done':
        // Asked for once. A file that was not there is not asked for again at every reading.
        if (item.track?.id !== `discover:${job.id}` && item.failure?.job !== job.id) {
          // In, and its file not yet read: the last moment of being fetched.
          live = { phase: 'fetching', stage: 'saving' };
          if (!d.s.asking.has(job.id)) {
            set(d, { asking: added(d.s.asking, job.id) });
            d.fx.push({ kind: 'track', id: item.id, jobId: job.id, tags: item.song.tags ?? [] });
          }
        } else if (have && job.artworkUri?.startsWith('file://') && item.track?.artworkUri !== job.artworkUri && !d.s.repictured.has(job.id)) {
          // Its sleeve came after the song did. The track is read again, once, to have it.
          set(d, { repictured: added(d.s.repictured, job.id) });
          d.fx.push({ kind: 'track', id: item.id, jobId: job.id, tags: [] });
        }
        break;
      case 'missing':
        if (item.failure?.job !== job.id) {
          const { track: _track, ...rest } = item;
          item = { ...rest, failure: { code: FILE_MISSING, at: d.now, job: job.id } };
        }
        break;
      case 'cancelled': {
        /*
          Stopped by somebody, from the queue's own screen. The row says so
          and waits to be tapped, for as long as that takes: it is never
          asked for again by the songs kept ready, which would put back what
          somebody had taken out.
        */
        const { jobId: _job, jobAt: _at, asked: _asked, keep: _keep, ...rest } = item;
        item = { ...rest, failure: { code: STOPPED, at: d.now } };
        retire(d, job.id);
        break;
      }
      case 'failed':
        if (item.failure?.job !== job.id) item = failed(d, item, job, found);
        break;
    }
    // Under way again, so whatever it failed of before is over.
    if (live && item.failure) {
      const { failure: _failure, ...rest } = item;
      item = rest;
    }
    if (item !== before) replace(d, item);
    // Not for a song still being looked for and not yet seen: there is no row for it to be said on.
    setLive(d, item.id, item.seen || found ? live : undefined);
    if (found && !item.seen && !gone(item) && itemOf(d.s, item.id)) show(d, item.id);
  }
}

function isLive(job: DownloadJob): boolean {
  return job.status !== 'done' && job.status !== 'failed' && job.status !== 'cancelled' && job.status !== 'missing';
}

/**
 * A song's job has failed, for the last time: the queue tries twice itself
 * before it says so, and a job on its second try is `queued` and is not here.
 *
 * No recording to be found is not a failure of the download and is not left
 * on the list to be tapped again: the song is put away for a month, the row
 * says so for a moment, and the next best song is at the end of the list
 * already by the time it goes. Waiting for Wi-Fi is not the song's fault
 * either, and is tried again when there is some. Anything else stays on its
 * row, to be tapped or taken off.
 */
function failed(d: Draft, item: Item, job: DownloadJob, found: boolean): Item {
  const code = job.errorCode ?? UNSORTED;
  const failure: ItemFailure = { code, at: d.now, job: job.id };
  if (code === UNSORTED) failure.detail = job.error;
  /*
    The phone would not fetch it on mobile data, so that is what there is,
    whatever was read of the connection a while ago. Believed at once: the
    song is wanted again the moment it fails, and asking for it on the
    strength of a stale reading would fail it again, as fast as the phone
    could answer.
  */
  if (code === WAITING_WIFI) set(d, { network: { connected: d.s.network?.connected ?? true, wifi: false } });
  /*
    A song on the screen that fails stays on the screen and says so, whatever
    it failed of. That includes the two failures that mean "this is not a
    recording of the song after all" — its video turned out to be a live
    stream, or was looked for again and not found — which used to take the
    row away: somebody tapped it, and a row that disappears under a tap is
    worse than one that says it could not be fetched.
  */
  if (item.seen || found) return { ...item, failure };
  // Nobody has seen it. With no recording it gives its place up, unseen, and the next song is looked for in its stead.
  if (code === NO_MATCH_CODE || code === NOT_A_SONG) {
    putAway(d, item.song, 'unmatched');
    return { ...item, failure, goneAt: d.now + NO_MATCH_SHOWN_MS };
  }
  // Failed while it was still being looked for, for a reason that may pass: forgotten until tomorrow, as a search ahead is.
  retire(d, job.id);
  const { jobId: _job, jobAt: _at, ahead: _ahead, asked: _asked, ...rest } = item;
  return { ...rest, soughtAt: d.now };
}

/** Forgets that looking for the unseen songs came to nothing earlier today, so that they are looked for again now. Answers whether there were any. */
function seekAgain(d: Draft): boolean {
  let any = false;
  for (const item of everyItem(d.s)) {
    if (item.seen || item.soughtAt == null) continue;
    const { soughtAt: _sought, ...rest } = item;
    replace(d, rest);
    any = true;
  }
  return any;
}

/** Whether the catalogue may be asked now, and if not, what stands in the way. */
function mayBuild(d: Draft, byHand: boolean): boolean {
  if (d.s.building) return false;
  if (d.s.network && !d.s.network.connected) {
    set(d, { problem: { code: 'offline', at: d.now } });
    // What is known of the connection may be old. Asked by hand, it is looked at again now, and not in half a minute.
    if (byHand) d.fx.push({ kind: 'network' });
    return false;
  }
  const since = d.now - d.s.attemptAt;
  // A clock put back does not hold it up.
  if (since >= 0 && since < (byHand ? BUILD_AGAIN_MS : BUILD_EVERY_MS)) {
    if (byHand) set(d, { problem: { code: 'throttled', at: d.now, retryAt: d.s.attemptAt + BUILD_AGAIN_MS } });
    return false;
  }
  return true;
}

function build(d: Draft, refresh: boolean): void {
  set(d, { building: { refresh, done: 0, total: null, label: '' }, attemptAt: d.now, problem: null });
  d.fx.push({ kind: 'build', refresh });
}

/** Problems that asking again would only meet again, until something about the listener has changed. */
const SAME_AGAIN: ReadonlySet<ProblemCode> = new Set(['exhausted', 'nothing', 'noTaste', 'noLibrary']);

/** A refresh is due on its day, and only for a list there is: an empty one is filled, which is not the same thing. */
function refreshDue(s: State, now: number): boolean {
  const days = s.settings.refreshDays;
  return days > 0 && s.list.length > 0 && !s.staged && now - s.refreshedAt >= days * DAY;
}

/** What needs the catalogue, if anything does: looked at whenever the app comes to the front, and when the day comes. */
function upkeep(d: Draft): void {
  if (d.s.building || d.s.staged) return;
  const due = refreshDue(d.s, d.now);
  const short = shown(d.s.list).length < d.s.settings.count;
  if (!due && !short) return;
  /*
    A catalogue that came back with too little, or with nothing to go on, is
    not asked again that day by itself: the same question has the same
    answer. That holds for a refresh that is due as much as for a list that
    is short — a due refresh that cannot be made stays due, and without this
    was asked for every quarter of an hour for as long as the app was open,
    and once more by every run of the task with no screen.
  */
  const since = d.now - d.s.fruitlessAt;
  if (since >= 0 && since < DAY) return;
  if (mayBuild(d, false)) build(d, due);
}

/**
 * Jobs of Discover's that no song on either list answers for are stopped,
 * and their files and every other given-up file removed. The player's queue
 * is the phone's to protect: a file still in it is left until it is not.
 */
function tidy(d: Draft): void {
  if (!d.s.jobsRead) return;
  const items = everyItem(d.s);
  const mine = new Set(items.map((item) => item.jobId).filter((id): id is string => !!id));
  const ids = new Set(items.map((item) => item.id));
  const retired = new Set(d.s.retired.filter((id) => !mine.has(id)));
  for (const job of d.s.jobs) {
    if (!job.discoverKey || mine.has(job.id)) continue;
    // Asked for a moment ago and not yet answered: its song is on the list and will claim it.
    if (ids.has(job.discoverKey) && (job.status === 'done' || isLive(job)) && !retired.has(job.id)) continue;
    retired.add(job.id);
    if (isLive(job)) stop(d, job.id, job.discoverKey);
  }
  const next = [...retired];
  if (next.length !== d.s.retired.length || next.some((id, at) => d.s.retired[at] !== id)) set(d, { retired: next });
  if (next.length) d.fx.push({ kind: 'clean', ids: next });
}

/**
 * Drops every song that has been put away, and from what has not been shown
 * yet — the pool, a list in the making — everything by an artist nobody
 * wants more of.
 *
 * A song of such an artist that is already on show stays where it is until
 * it is taken off or the list is refreshed. Taking an artist out is said of
 * one row, and can be taken back for that row; rows vanishing from elsewhere
 * on the list for it would be neither expected nor undone.
 */
function prune(d: Draft): void {
  const put = (song: Song) => d.s.away.has(song.recordingMbid) || d.s.away.has(songKey(song));
  const unwanted = (song: Song) => d.s.hidden.has(song.artistMbid) || put(song);
  if (d.s.pool.some(unwanted)) set(d, { pool: d.s.pool.filter((song) => !unwanted(song)) });
  // A row saying its song could not be found was put away by that, and has its moment.
  for (const item of d.s.list) if (!gone(item) && put(item.song)) remove(d, item.id);
  for (const item of d.s.staged?.items ?? []) if (!gone(item) && unwanted(item.song)) remove(d, item.id);
}

/**
 * A reading of the connection, just made.
 *
 * This is the one place a problem of having no connection is taken down:
 * by a reading that says there is one, made after the problem was raised.
 * It used to be taken down by whatever was last known, at the end of every
 * event — and what was last known was nearly always "connected", read when
 * the app came to the front, so the problem was erased in the same breath
 * that raised it and pressing refresh with no connection did nothing at all.
 */
function connection(d: Draft, network: Network | null): void {
  if (!network) return;
  const was = d.s.network;
  if (!was || was.connected !== network.connected || was.wifi !== network.wifi) set(d, { network });
  if (network.connected && d.s.problem?.code === 'offline') set(d, { problem: null });
}

function take(d: Draft, event: Event): void {
  const s = d.s;
  switch (event.type) {
    case 'jobs':
      return readJobs(d, event.jobs, event.paused);

    case 'track': {
      set(d, { asking: without(s.asking, event.jobId) });
      const item = itemOf(d.s, event.id);
      if (!item || item.jobId !== event.jobId) return;
      // In, and so no longer a download of anybody's: `asked` is about a job, and this one is over.
      const { failure: _failure, track: _track, asked: _asked, ahead: _ahead, ...rest } = item;
      replace(d, event.track ? { ...rest, track: event.track } : { ...rest, failure: { code: FILE_MISSING, at: d.now, job: event.jobId } });
      return setLive(d, item.id, undefined);
    }

    case 'asked': {
      const item = itemOf(s, event.id);
      if (event.hold) {
        set(d, { seeking: without(s.seeking, event.id) });
        // Asked for in earnest while this was on its way: the answer to that asking is the one that counts.
        if (item && (item.asked || s.live.has(item.id) || item.track)) return;
      }
      if (!item) {
        // Taken off the list while the phone was being asked: the job is nobody's.
        stop(d, event.jobId, event.id);
        return retire(d, event.jobId);
      }
      if (item.jobId && item.jobId !== event.jobId) retire(d, item.jobId);
      const { track: _track, ...rest } = item;
      // The same job is a song that was ready all along and is answered with what it has.
      const answered = item.jobId === event.jobId ? { ...item, jobAt: d.now } : { ...rest, jobId: event.jobId, jobAt: d.now };
      replace(d, event.hold ? { ...answered, ahead: answered.ahead ?? 'seeking' } : answered);
      const live = d.s.live.get(item.id);
      if (live) setLive(d, item.id, { ...live, pending: false });
      return;
    }

    case 'askFailed': {
      const item = itemOf(s, event.id);
      if (event.hold) {
        // Nobody asked for it, so there is nothing to say on its row. Not tried again today.
        set(d, { seeking: without(s.seeking, event.id) });
        if (item && !item.asked && !s.live.has(item.id)) replace(d, { ...item, soughtAt: d.now });
        return;
      }
      if (!item) return;
      setLive(d, item.id, undefined);
      replace(d, { ...item, failure: { code: event.code, detail: event.detail, at: d.now } });
      return;
    }

    case 'play': {
      const at = s.list.findIndex((item) => item.id === event.id);
      const item = s.list[at];
      // Nor a song that is not on the screen: there is no row to have tapped.
      if (!item || gone(item) || !item.seen) return;
      // Ready: sound, and nothing asked of anybody first.
      if (item.track) return start(d, at);
      /*
        Tapped again while its preview is playing: that is "stop this". The
        preview stops; the song goes on being fetched and starts when it is
        in, as it would have. (Tapped once more, it is previewed again.)
      */
      if (s.preview?.id === item.id) return endPreview(d);
      set(d, { intent: { id: item.id, queueKey: s.player.key } });
      ask(d, item, true);
      // Another row's preview, if there was one, is replaced by this one: the phone plays one at a time.
      if (s.preview) endPreview(d);
      return beginPreview(d, itemOf(d.s, item.id) ?? item);
    }

    case 'previewed': {
      // About a preview that has been stopped or replaced since: nothing to do with the one there is now.
      if (s.preview?.id !== event.id) return;
      if (event.state === 'playing') set(d, { preview: { id: event.id, phase: 'playing' } });
      // Over by itself, or never there. The song is still on its way and the row says so.
      else set(d, { preview: null });
      return;
    }

    case 'background':
      // Nothing shows a preview outside the app, so nothing could stop one there: it does not outlive the screen.
      return endPreview(d);

    case 'keep': {
      const item = s.list.find((other) => other.id === event.id);
      if (!item || gone(item) || !item.seen || item.keep) return;
      replace(d, { ...item, keep: true });
      if (!item.track) ask(d, itemOf(d.s, item.id)!, true);
      return;
    }

    case 'kept': {
      const item = itemOf(s, event.id);
      set(d, { keeping: without(s.keeping, event.id) });
      if (!item) return;
      putAway(d, item.song, 'saved');
      // The file stays for as long as the player has it queued: a kept song may finish playing.
      remove(d, item.id);
      set(d, { notice: { kind: 'kept', id: item.id, title: item.song.title, until: d.now + NOTICE_MS }, undo: null });
      return;
    }

    case 'keepFailed': {
      const item = itemOf(s, event.id);
      set(d, { keeping: without(s.keeping, event.id) });
      if (!item) return;
      const { keep: _keep, ...rest } = item;
      replace(d, rest);
      set(d, { notice: { kind: 'keepFailed', id: item.id, title: item.song.title, code: event.code, until: d.now + NOTICE_MS } });
      return;
    }

    case 'exclude': {
      const index = s.list.findIndex((item) => item.id === event.id);
      const item = s.list[index];
      if (!item || gone(item) || !item.seen) return;
      putAway(d, item.song, 'blocked');
      if (event.artist) {
        d.fx.push({ kind: 'hideArtist', song: item.song });
        set(d, { hidden: added(d.s.hidden, item.song.artistMbid) });
      }
      if (item.track) d.fx.push({ kind: 'dequeue', trackIds: [item.track.id] });
      const before = new Set(d.s.list.map((other) => other.id));
      remove(d, item.id);
      if (event.artist) prune(d);
      fill(d);
      const filler = d.s.list.find((other) => !before.has(other.id))?.id ?? null;
      set(d, {
        undo: { item, index, artist: !!event.artist, filler, until: d.now + UNDO_MS },
        notice: {
          kind: 'excluded', id: item.id, title: item.song.title,
          artist: event.artist ? item.song.artist : null, until: d.now + UNDO_MS,
        },
      });
      return;
    }

    case 'undo': {
      const undo = s.undo;
      if (!undo) return;
      const song = undo.item.song;
      d.fx.push({ kind: 'allow', id: song.recordingMbid });
      set(d, { away: without(d.s.away, song.recordingMbid, songKey(song)), undo: null, dry: null });
      if (undo.artist) {
        d.fx.push({ kind: 'showArtist', artistMbid: song.artistMbid });
        set(d, { hidden: without(d.s.hidden, song.artistMbid) });
      }
      // Its file is still there if nothing has been tidied since, and then it is ready as it was.
      let back = undo.item;
      if (back.jobId && back.track && d.s.retired.includes(back.jobId)) {
        set(d, { retired: d.s.retired.filter((id) => id !== back.jobId) });
      } else {
        const { jobId: _job, jobAt: _at, track: _track, ahead: _ahead, ...rest } = back;
        back = rest;
      }
      const { keep: _keep, failure: _failure, ...clean } = back;
      // Back where it was. The song that took its place gives the place up, unless something has been done with it since.
      const filler = undo.filler ? d.s.list.find((item) => item.id === undo.filler) : undefined;
      if (filler && !filler.jobId && !filler.track && !d.s.live.has(filler.id) && shown(d.s.list).length >= d.s.settings.count) {
        remove(d, filler.id);
      }
      const list = [...d.s.list];
      list.splice(Math.min(undo.index, list.length), 0, clean);
      set(d, { list, notice: { kind: 'restored', id: clean.id, title: song.title, until: d.now + NOTICE_MS } });
      return;
    }

    case 'allow':
      // Allowed again from the list of excluded songs, long after: it may be recommended, and is not put back anywhere.
      d.fx.push({ kind: 'allow', id: event.id });
      set(d, { away: without(s.away, event.id, event.key), dry: null });
      return;

    case 'refresh':
      // Pressed again while the new list is being got ready: it is wanted now, as far as it has got — if it has got anywhere.
      if (s.staged) {
        seekAgain(d);
        if (seenOf(s.staged.items).length) swap(d);
        return;
      }
      if (mayBuild(d, true)) build(d, s.list.length > 0);
      return;

    case 'findMore':
      /*
        Songs that are chosen and could not be confirmed are the first thing
        "find more" means: they are looked for again now, and the catalogue
        is only asked where the list is short of songs to look for.
      */
      if (seekAgain(d) && shown(d.s.list).length >= d.s.settings.count) return;
      if (mayBuild(d, true)) build(d, false);
      return;

    case 'dismiss':
      if (event.what === 'problem') set(d, { problem: null });
      else set(d, { notice: null, undo: null });
      return;

    case 'maintain':
      set(d, { away: event.away, hidden: event.hidden, dry: null });
      connection(d, event.network);
      prune(d);
      fill(d);
      upkeep(d);
      tidy(d);
      return;

    case 'network':
      connection(d, event.network);
      // Back, perhaps, and then whatever was waiting for it is seen to.
      fill(d);
      return upkeep(d);

    case 'cleaned': {
      const removed = new Set(event.removed);
      if (s.retired.some((id) => removed.has(id))) set(d, { retired: s.retired.filter((id) => !removed.has(id)) });
      return;
    }

    case 'buildProgress': {
      if (!s.building) return;
      set(d, {
        building: { ...s.building, label: event.label, done: event.done ?? s.building.done, total: event.total ?? s.building.total },
      });
      return;
    }

    case 'built':
      return built(d, event.refresh, event.pool);

    case 'buildFailed':
      set(d, { building: null, problem: { code: event.code, at: d.now } });
      if (SAME_AGAIN.has(event.code)) set(d, { fruitlessAt: d.now });
      /*
        No connection, whatever was read of it a while ago. Believed, as a
        download refused for want of Wi-Fi is: the next asking is then
        answered at once and truthfully, and the connection is looked at
        again until it is back.
      */
      if (event.code === 'offline') set(d, { network: { connected: false, wifi: false }, networkAt: null });
      return;

    case 'settings':
      return configure(d, event.value);

    case 'player': {
      const key = event.queue.join('|');
      const same = key === s.player.key && event.currentId === s.player.currentId && event.playing === s.player.playing;
      // The app's own player has been started by somebody. The phone takes the speaker from the preview for that; this is the same said here.
      if (event.playing && !s.player.playing && s.preview?.phase === 'playing') endPreview(d);
      if (!same) set(d, { player: { currentId: event.currentId, queue: key === s.player.key ? s.player.queue : event.queue, key, playing: event.playing } });
      if (!event.playing || !event.currentId) return;
      const item = everyItem(d.s).find((other) => other.track?.id === event.currentId);
      if (item && !item.heardAt) replace(d, { ...item, heardAt: d.now });
      return;
    }

    case 'tick':
      if (s.networkAt != null && s.networkAt <= d.now) {
        d.fx.push({ kind: 'network' });
        set(d, { networkAt: d.now + NETWORK_EVERY_MS });
      }
      // Filled from the pool first: a list is only short if the pool cannot make it up.
      fill(d);
      return upkeep(d);
  }
}

/**
 * The catalogue has come back with a pool.
 *
 * For a list being filled, that is all: the pool is kept and the list takes
 * what it lacks from it. For a refresh the pool has to be able to make a new
 * list — a whole one, or at least as long as the one it would replace — or
 * the old list stays and the reason is said. A new list that can be made is
 * shown at once where nothing is fetched ahead, or where there is no list to
 * go on showing; otherwise it is got ready behind the old one.
 */
function built(d: Draft, refresh: boolean, pool: readonly Song[]): void {
  const usable = pool.filter(
    (song) => !d.s.hidden.has(song.artistMbid) && !d.s.away.has(song.recordingMbid) && !d.s.away.has(songKey(song))
  );
  set(d, { building: null, pool: usable, dry: null, problem: null, fruitlessAt: 0 });
  const count = d.s.settings.count;
  if (!refresh) {
    fill(d);
    if (!d.s.refreshedAt && d.s.list.length) set(d, { refreshedAt: d.now });
    if (shown(d.s.list).length < count) set(d, { problem: { code: 'exhausted', at: d.now }, fruitlessAt: d.now });
    return;
  }
  const old = shown(d.s.list);
  const songs = picks(d.s, [], count, d.s.list);
  if (songs.length < Math.min(count, old.length || 1)) {
    set(d, { problem: { code: 'exhausted', at: d.now }, fruitlessAt: d.now });
    return;
  }
  set(d, { staged: { items: songs.map((song) => fresh(song, d.now)), since: d.now } });
  if (!old.length) swap(d);
}

/**
 * The settings were changed.
 *
 * A shorter list loses its last rows and a longer one is filled, at the end
 * either way. A change to what is fetched ahead, or on what connection,
 * stops Discover's own jobs that have not begun: they were asked for under
 * the old rule, and the next pass asks again under the new one for whichever
 * of them are still wanted. A job somebody tapped is theirs and is left.
 *
 * A new list in the making is kept through all of it, trimmed or filled like
 * the one on show.
 */
function configure(d: Draft, value: DiscoverSettings): void {
  const before = d.s.settings;
  set(d, { settings: value, dry: null });
  if (!previewsOn(value)) endPreview(d);
  if (value.count < before.count) {
    // Not a song somebody pressed keep on: that one stays until it is in the library, wherever on the list it is.
    const kept = (item: Item) => item.keep || d.s.keeping.has(item.id);
    for (const item of shown(d.s.list).slice(value.count)) if (!kept(item)) remove(d, item.id);
    if (d.s.staged) for (const item of shown(d.s.staged.items).slice(value.count)) remove(d, item.id);
  }
  if (value.ready !== before.ready || value.wifiOnly !== before.wifiOnly) {
    for (const item of everyItem(d.s)) {
      const live = d.s.live.get(item.id);
      if (!live || live.phase !== 'waiting' || live.pending || item.asked || !item.jobId) continue;
      stop(d, item.jobId, item.id);
      retire(d, item.jobId);
      const { jobId: _job, jobAt: _at, ...rest } = item;
      replace(d, rest);
      setLive(d, item.id, undefined);
    }
    // Songs that only waited for Wi-Fi wait for the new rule's answer instead.
    for (const item of everyItem(d.s)) {
      if (!isWaitingWifi(item)) continue;
      const { failure: _failure, ...rest } = item;
      replace(d, rest);
    }
  }
  fill(d);
  upkeep(d);
}

/**
 * Which of the three things that are written down differ between two states.
 *
 * Each is compared as the object it is, which is all it takes: nothing here
 * is changed in place. So a download's percentage writes nothing, a song
 * becoming ready writes the list and not the pool, and the pool — every song
 * the catalogue came back with — is written when the catalogue is asked and
 * at no other time.
 */
export function unwritten(now: State, was: State): { list: boolean; pool: boolean; settings: boolean } {
  return {
    pool: now.pool !== was.pool,
    list: now.list !== was.list || now.staged !== was.staged || now.refreshedAt !== was.refreshedAt ||
      now.retired !== was.retired || now.attemptAt !== was.attemptAt || now.problem !== was.problem ||
      now.fruitlessAt !== was.fruitlessAt,
    settings: now.settings !== was.settings,
  };
}

/** What is so after [event], and what is to be done about it. A state nothing happened to is handed back as it came. */
export function reduce(state: State, event: Event, now: number): { state: State; effects: Effect[] } {
  const d: Draft = { s: state, fx: [], now };
  take(d, event);
  settle(d);
  return { state: d.s, effects: d.fx };
}

/**
 * When something will next be so by the clock alone: a notice to take down,
 * a row to remove, a new list to stop waiting for, a refresh that falls due,
 * a connection to look at again. Null when nothing is waiting on the time.
 */
export function wakeAt(s: State, now: number): number | null {
  const times: number[] = [];
  if (s.notice) times.push(s.notice.until);
  if (s.undo) times.push(s.undo.until);
  if (s.problem?.retryAt != null) times.push(s.problem.retryAt);
  for (const item of everyItem(s)) if (item.goneAt != null) times.push(item.goneAt);
  if (s.staged) times.push(s.staged.since + STAGE_WAIT_MS);
  if (s.networkAt != null) times.push(s.networkAt);
  if (s.settings.refreshDays > 0 && s.list.length > 0 && !s.staged && !s.building) {
    times.push(Math.max(s.refreshedAt + s.settings.refreshDays * DAY, s.attemptAt + BUILD_EVERY_MS, s.fruitlessAt + DAY));
  }
  // A song whose search ahead came to nothing is looked for again a day on.
  for (const item of everyItem(s)) if (item.soughtAt != null && !item.jobId && !item.track) times.push(item.soughtAt + DAY);
  // A failed song's one more try, when the songs kept ready would make it.
  if (s.settings.ready > 0) {
    for (const item of everyItem(s)) {
      if (item.failure && !item.track && !LASTING.has(item.failure.code) && item.retriedAt == null) {
        times.push(item.failure.at + RETRY_AFTER_MS);
      }
    }
  }
  /*
    Only what is still to come. Whatever is past was seen to when it passed,
    or could not be, and is not asked after again and again. The one thing
    that may be past and still wanted is the look at the connection, put off
    by a phone that slept through its time: that is for now.
  */
  const ahead = times.filter((time) => time > now);
  if (s.networkAt != null && s.networkAt <= now) return now;
  return ahead.length ? Math.min(...ahead) : null;
}
