import { saveLookupTags } from '../db/tags';
import { strings } from '../i18n/index';
import { ensureNotificationPermission, libraryRoot, scanLibrary } from '../media/library';
import { withMetadata } from '../media/merge';
import { mergeSongs } from '../identity/index';
import { libraryFilesChanged } from '../library/index';
import { carried } from '../youtube/carried';
import { failureCode } from '../youtube/errors';
import { findUntil, queueChanged } from '../youtube/finder';
import { downloads } from '../youtube/native';
import type { DownloadJob } from '../youtube/types';
import { jobsNow, readerPresent, watchJobs, type QueueReading } from '../youtube/watch';
import type { Track } from '../types';
import { buildPool } from './catalogue';
import {
  KEEP_FAILED, NEEDS_BUILD, UNSORTED, initial, itemOf, reduce, unwritten, wakeAt, wanted,
  type Effect, type Event, type ProblemCode, type Song, type State,
} from './core';
import { searchTracks, trackById } from './deezer';
import { confirmed, problemOf } from './fault';
import { isPreviewAddress, pickPreview, previewQuery, shopTrackOf } from './preview';
import { createLoop } from './loop';
import { settingsFrom, songKey, type DiscoverSettings } from './policy';
import { blockArtist, blockedArtistIds, blockedArtists, unblockArtist } from './feedback';
import {
  blockedSongs, exclude, exclusions, readDiscoverSettings, readKept, saveDiscoverSettings, saveList, savePool, unblock,
} from './store';
import { findQuery } from './video';
import { viewCache, viewOf, type DiscoverEntryView, type DiscoverView } from './view';

/**
 * Discover, done.
 *
 * `core.ts` decides and this does. An event comes in — a row was tapped, the
 * queue was read, the player moved on — and is handed to the core with the
 * time; what comes back is the state as it now is, and a list of things to
 * do about it. This file holds that state, tells whoever is watching, writes
 * down the part of it that lasts, and does the things: the phone, the
 * database, the player, the catalogue. Whatever a thing done comes to goes
 * back in as another event.
 *
 * So there is no deciding here, and that is on purpose. A line in this file
 * that says "if the song is ready" is a line in the wrong file.
 *
 * One of these for the app and for the task that runs with no screen. They
 * do not run at once, and are the same module where they follow each other
 * in one process.
 */

const cache = viewCache();

/**
 * Writes down what has changed of what lasts.
 *
 * The list and the pool are written apart: see `store.ts`. Neither is
 * written for a download's percentage or for anything else that is true only
 * this second, because none of that is in them — which is the whole of why
 * this is cheap.
 */
function persist(now: State, was: State): void {
  const changed = unwritten(now, was);
  if (changed.pool) savePool(now.pool);
  if (changed.list) saveList(now);
  if (changed.settings) saveDiscoverSettings(now.settings);
}

/** The one timer: set for whenever the core says something will next be so by the clock alone. */
let timer: ReturnType<typeof setTimeout> | null = null;

function arm(state: State): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!loop.watched()) return;
  const now = Date.now();
  const at = wakeAt(state, now);
  if (at == null) return;
  // Never sooner than a moment from now, and never so far off that a phone asleep for a day wakes to a timer still running.
  timer = setTimeout(() => dispatch({ type: 'tick' }), Math.min(Math.max(at - now, 0) + 50, 6 * 3_600_000));
}

/**
 * The state, and the taking of events one at a time: see `loop.ts`, which is
 * where an exception anywhere in it is kept from stopping everything after.
 */
const loop = createLoop<State, Event, Effect>({
  boot: () => initial(readKept(), readDiscoverSettings(), exclusions(), blockedArtistIds()),
  // Read before anybody here was listening, as like as not: the provider reads the queue the moment the app opens.
  first: () => {
    const reading = jobsNow();
    return reading ? [jobsEvent(reading)] : [];
  },
  reduce,
  persist,
  run,
  now: Date.now,
  settled: arm,
});

const dispatch = loop.dispatch;
const boot = loop.state;

/** Work under way that will come back as an event. The task with no screen waits for it; nothing else does. */
const outstanding = new Set<Promise<unknown>>();

function going(work: Promise<unknown>): void {
  const tracked = work.catch(console.warn).finally(() => outstanding.delete(tracked));
  outstanding.add(tracked);
}

async function idle(): Promise<void> {
  while (outstanding.size) await Promise.all([...outstanding]);
}

function jobsEvent(reading: QueueReading): Event {
  return { type: 'jobs', jobs: reading.jobs.filter((job) => job.discoverKey), paused: reading.paused };
}

/**
 * Reads the queue from here, for when nobody else does: the task with no
 * screen has no provider. One reading, and no going through the files for it.
 */
async function readJobs(): Promise<DownloadJob[]> {
  if (!downloads) return [];
  const newest = await downloads.getJobsAsync(false);
  const held = await downloads.queueStateAsync?.();
  // The phone hands them over newest first, and keeps them the other way round.
  const jobs = [...newest].reverse();
  dispatch(jobsEvent({ jobs, paused: held?.paused ?? false }));
  return jobs;
}

/** The queue was changed from here. Whoever reads it reads it again; with nobody to, it is read from here. */
function nudge(): void {
  if (readerPresent()) queueChanged();
  else going(readJobs());
}

/**
 * What the player is asked to do, by whoever has a player to ask: the
 * provider, while there is a screen. With none nothing is played, which is
 * right — the task with no screen fetches songs and does not start them.
 */
export type PlayerPort = {
  play: (tracks: Track[]) => Promise<void>;
  add: (track: Track) => Promise<void>;
  /** Takes a file out of the queue wherever it is in it. By what it is and not by its row: only the player knows the rows as they are now. */
  remove: (trackId: string) => Promise<void>;
};
let port: PlayerPort | null = null;

export function attachPlayer(player: PlayerPort): () => void {
  port = player;
  return () => {
    if (port === player) port = null;
  };
}

async function ask(effect: Extract<Effect, { kind: 'ask' }>): Promise<void> {
  const { id, song, front, hold } = effect;
  if (!downloads?.enqueueFindAsync) return dispatch({ type: 'askFailed', id, code: NEEDS_BUILD, hold });
  try {
    // Somebody is waiting to hear it, and the download's notification is how they see it coming.
    if (front) await ensureNotificationPermission();
    const video = {
      id: '', url: '', title: song.title, channel: song.artist, thumbnail: null, duration: song.durationSec ?? null,
      find: { query: findQuery(song.artist, song.title), artist: song.artist, title: song.title, durationSec: song.durationSec ?? null, loose: true },
      discoveryTitle: song.title, discoveryArtist: song.artist, discoveryAlbum: song.release, discoverCover: song.coverUrl,
      discoverAutomatic: !front, discoverWifiOnly: effect.wifiOnly,
    };
    // [hold]: only its video is looked for, and kept. Asked again without, the same call lets it go — to the front for a tap.
    // The audio as YouTube has it: nothing is converted, which was most of the wait. The folder is only a form filled in —
    // Discover's files are its own until one is kept.
    const jobId = await downloads.enqueueFindAsync(carried(video), 'original', 'Music', song.recordingMbid, front, hold);
    dispatch({ type: 'asked', id, jobId, hold });
    nudge();
  } catch (error) {
    const detail = error instanceof Error ? error.message : null;
    dispatch({ type: 'askFailed', id, code: failureCode(error) ?? UNSORTED, detail, hold });
  }
}

/**
 * A song's track as the player is to be given it.
 *
 * The phone stores a song the moment its file is in and does not wait for
 * its sleeve, which is usually there by then and sometimes is not. Where it
 * is not, the track is given the address the list has been showing the same
 * sleeve from all along, so that the player has a picture from the first
 * second either way. The file the phone keeps takes its place the next time
 * the track is read.
 */
function pictured(track: Track, songId: string): Track {
  if (track.artworkUri) return track;
  const cover = itemOf(boot(), songId)?.song.coverUrl;
  return cover ? { ...track, artworkUri: cover } : track;
}

async function readTrack(effect: Extract<Effect, { kind: 'track' }>): Promise<void> {
  let track: Track | null = null;
  try {
    track = (await downloads?.discoverTrackAsync(effect.jobId)) ?? null;
    if (track && effect.tags.length) saveLookupTags(track.id, [...effect.tags], 'musicbrainz');
  } catch (error) {
    console.warn(error);
  }
  dispatch({ type: 'track', id: effect.id, jobId: effect.jobId, track: track && pictured(track, effect.id) });
}

/**
 * The phone says a song is stored, and hands over the track.
 *
 * This is the short way from a download ending to the song starting. The
 * long way still works and is what happens if this is never heard: the queue
 * is read, the job is seen to have finished, its track is asked for. That is
 * three trips to the phone, each behind whatever reading was already under
 * way, for something the phone had in its hand when it began.
 */
function stored(song: { id: string; key: string; track: Track }): void {
  if (!song?.track || !song.key || !song.id) return;
  const item = itemOf(boot(), song.key);
  dispatch({ type: 'track', id: song.key, jobId: song.id, track: pictured(song.track, song.key) });
  const tags = item?.song.tags;
  if (tags?.length) {
    try {
      saveLookupTags(song.track.id, [...tags], 'musicbrainz');
    } catch (error) {
      console.warn(error);
    }
  }
}

async function keep(effect: Extract<Effect, { kind: 'keep' }>): Promise<void> {
  try {
    if (!downloads) throw new Error('No downloads module');
    const trackId = await downloads.keepDiscoverAsync(effect.jobId, libraryRoot());
    /*
      Until now the song was `discover:<job>`, and that is what its plays,
      its skips and its tags were written under. Kept, it is a file in the
      library with a number of its own, and all of that goes with it — by
      the same road a file's history takes when the media store gives it a
      new number, all or nothing. Otherwise the song somebody liked enough
      to keep arrives in the library never having been played.
    */
    try {
      mergeSongs(`discover:${effect.jobId}`, trackId);
    } catch (error) {
      // The song is kept all the same. Its history stays under the old id, where nothing is lost and nothing reads it.
      console.warn(error);
    }
    if (effect.tags.length) saveLookupTags(trackId, [...effect.tags], 'musicbrainz');
    dispatch({ type: 'kept', id: effect.id });
    // The library has a new song, and whoever reads the queue is how the screens hear of it.
    nudge();
    // And the library itself is read again, for a screen showing it at this moment.
    libraryFilesChanged();
  } catch (error) {
    dispatch({ type: 'keepFailed', id: effect.id, code: failureCode(error) ?? KEEP_FAILED });
  }
}

/**
 * Takes files out of the player's queue, by what they are.
 *
 * Not by row. The queue as it is held here is whatever the player last said,
 * or for a moment after a song is started what it is about to say, and
 * neither is the queue the player has at this instant.
 */
async function dequeue(trackIds: readonly string[]): Promise<void> {
  for (const trackId of trackIds) await port?.remove(trackId);
}

/** How long the catalogue is given to answer before the asking is stopped. */
const BUILD_MS = 2 * 60_000;

/** Why the catalogue came back with nothing: see `fault.ts`. The phone is asked only where the answer turns on it. */
async function fault(error: unknown, timedOut: boolean): Promise<ProblemCode> {
  const code = problemOf(error, timedOut);
  if (code !== 'offline') return code;
  const network = await downloads?.discoverNetworkAsync().catch(() => null);
  return confirmed(code, network ? network.connected : null);
}

/** [work], or a refusal if it has not come back by the time [signal] is raised. For work that cannot itself be told to stop. */
function within<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (signal.aborted) return stop();
    signal.addEventListener('abort', stop, { once: true });
    work.then(resolve, reject);
  });
}

async function build(refresh: boolean): Promise<void> {
  const controller = new AbortController();
  let timedOut = false;
  const stop = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, BUILD_MS);
  try {
    // A permission refused must not pass for an empty library: this throws, and is said as a failure.
    // Under the same deadline as the rest: a scan that never comes back would otherwise leave Discover
    // "looking for songs" until the app was closed, with refresh refused for as long.
    const library = withMetadata(await within(scanLibrary(), controller.signal));
    if (!library.length) {
      dispatch({ type: 'buildFailed', code: 'noLibrary' });
      return;
    }
    // What it is doing is said in words, and how far it has got in numbers; the two come separately and are shown together.
    let label = '';
    const said = (text: string) => {
      label = text;
      dispatch({ type: 'buildProgress', label });
    };
    const onStep = (step: { done: number; total: number }) =>
      dispatch({ type: 'buildProgress', label, done: step.done, total: step.total });
    const pool: Song[] = await buildPool(library, Date.now(), said, controller.signal, strings(), { onStep });
    // What is already owned is not recommended, by whichever of its spellings it is owned under.
    const owned = new Set(library.map(songKey));
    dispatch({ type: 'built', refresh, pool: pool.filter((song) => !owned.has(songKey(song))) });
  } catch (error) {
    dispatch({ type: 'buildFailed', code: await fault(error, timedOut) });
  } finally {
    clearTimeout(stop);
  }
}

async function clean(ids: readonly string[]): Promise<void> {
  if (!downloads) return;
  // What the player has queued is named as well, though the phone looks at its own record of the queue too.
  const removed = await downloads.cleanDiscoverAsync([...ids], [...boot().player.queue]);
  if (removed.length) dispatch({ type: 'cleaned', removed });
}

/** The looking-up of a preview that is under way, so that it can be given up when the preview is no longer wanted. */
let seekingPreview: AbortController | null = null;

/**
 * Finds thirty seconds of a song and has the phone play them.
 *
 * A song that came from Deezer is asked for by its number there, and is that
 * track with no question. Any other is searched for by its name, and taken
 * only where a track is certainly the same recording (`preview.ts`). The
 * address is good for a short while and is used as soon as it is read;
 * nothing of it is kept.
 *
 * Whatever goes wrong here goes wrong quietly: no preview, and the song on
 * its way as if none had been asked for. Looked at again before the phone
 * is told to play — the song may have arrived, or another row been tapped,
 * in the half second this took.
 */
async function preview(effect: Extract<Effect, { kind: 'preview' }>): Promise<void> {
  const { id, song } = effect;
  const none = () => dispatch({ type: 'previewed', id, state: 'none' });
  const wanted = () => boot().preview?.id === id;
  const native = downloads;
  if (!native?.previewStartAsync) return none();
  seekingPreview?.abort();
  const seeking = new AbortController();
  seekingPreview = seeking;
  try {
    const number = shopTrackOf(song.recordingMbid);
    const track = number != null
      ? await trackById(number, seeking.signal)
      : pickPreview(song, await searchTracks(previewQuery(song), seeking.signal));
    if (!wanted()) return;
    const address = track?.preview;
    if (!isPreviewAddress(address) || !(await native.previewStartAsync(id, address))) return none();
    // Stopped in the moment it took to start: the stopping found nothing to stop, so it is done again.
    if (!wanted()) await native.previewStopAsync?.();
  } catch {
    if (wanted()) none();
  } finally {
    if (seekingPreview === seeking) seekingPreview = null;
  }
}

function stopPreview(): void {
  seekingPreview?.abort();
  seekingPreview = null;
  going(downloads?.previewStopAsync?.() ?? Promise.resolve());
}

async function readNetwork(): Promise<void> {
  const network = (await downloads?.discoverNetworkAsync().catch(() => null)) ?? null;
  dispatch({ type: 'network', network });
}

function run(effect: Effect): void {
  switch (effect.kind) {
    case 'ask':
      return going(ask(effect));
    case 'track':
      return going(readTrack(effect));
    case 'play':
      return going(port?.play([...effect.tracks]) ?? Promise.resolve());
    case 'preview':
      return going(preview(effect));
    case 'stopPreview':
      return stopPreview();
    case 'append':
      return going((async () => {
        for (const track of effect.tracks) await port?.add(track);
      })());
    case 'dequeue':
      return going(dequeue(effect.trackIds));
    case 'away':
      return exclude(effect.song, effect.reason);
    case 'allow':
      return unblock(effect.id);
    case 'hideArtist':
      return blockArtist(effect.song.artist, effect.song.artistMbid);
    case 'showArtist': {
      const row = blockedArtists().find((artist) => artist.mbid === effect.artistMbid);
      if (row) unblockArtist(row.id);
      return;
    }
    case 'keep':
      return going(keep(effect));
    case 'cancel':
      return going((downloads?.cancelAsync(effect.jobId) ?? Promise.resolve()).then(nudge));
    case 'clean':
      return going(clean(effect.ids));
    case 'build':
      return going(build(effect.refresh));
    case 'network':
      return going(readNetwork());
  }
}

/* ------------------------------------------------------------------------ */
/* What a screen, the player and the task are given.                        */
/* ------------------------------------------------------------------------ */

let unwatch: (() => void) | null = null;
let unhear: { remove: () => void } | null = null;
let unpreview: { remove: () => void } | null = null;

/**
 * Told of every change, for as long as it listens. While anybody does, the
 * engine listens to the queue in its turn and keeps its one timer; with
 * nobody it does neither, and costs nothing.
 */
export function subscribeDiscover(listener: () => void): () => void {
  const stop = loop.subscribe(listener);
  if (!unwatch) unwatch = watchJobs((reading) => dispatch(jobsEvent(reading)));
  // A build from before the phone said so says nothing, and the reading of the queue does it all, as it did.
  if (!unhear) unhear = downloads?.addListener?.('onDiscoverReady', stored) ?? null;
  if (!unpreview) {
    unpreview = downloads?.addListener?.('onPreview', (said) => {
      if (said?.id && said.state) dispatch({ type: 'previewed', id: said.id, state: said.state });
    }) ?? null;
  }
  return () => {
    stop();
    if (loop.watched()) return;
    unwatch?.();
    unwatch = null;
    unhear?.remove();
    unhear = null;
    unpreview?.remove();
    unpreview = null;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}

/** Discover as it is to be shown, in the language of the moment. The same object for as long as nothing shown has changed. */
export function discoverView(): DiscoverView {
  return viewOf(boot(), cache, strings());
}

/** One song of the list by its id, or null where it is no longer on it. */
export function discoverEntry(id: string): DiscoverEntryView | null {
  discoverView();
  return cache.made.get(id)?.view ?? null;
}

/**
 * The song of the list a file in the player is, or null for a file that is
 * not one of the list's: something from the library, or a Discover song
 * whose list has since been replaced. What the player offers keep and
 * exclude by, on a track whose id begins `discover:`.
 */
export function entryForTrack(trackId: string | null | undefined): DiscoverEntryView | null {
  if (!trackId || !trackId.startsWith('discover:')) return null;
  discoverView();
  return cache.byTrack.get(trackId) ?? null;
}

/** The app has gone behind another, or the screen is off. A preview does not outlive that: see `core.ts`. */
export function discoverBackgrounded(): void {
  dispatch({ type: 'background' });
}

/** What the player is doing, told by whoever can see it. */
export function playerChanged(currentId: string | null, queue: readonly string[], playing: boolean): void {
  dispatch({ type: 'player', currentId, queue, playing });
}

let maintaining: Promise<void> | null = null;

/**
 * Looks over the list: is a refresh due, is it short, are there files nobody
 * needs. Asked when the app is opened or comes back to the front.
 *
 * It reads two things first, since both may have changed while nobody was
 * looking — the connection, and what is being kept away, which a restored
 * backup rewrites — and hands them to the core with the question. Nothing is
 * shown as busy for it and nothing on the screen waits for it.
 */
export function maintainDiscover(): Promise<void> {
  if (maintaining) return maintaining;
  const pass = (async () => {
    boot();
    const network = (await downloads?.discoverNetworkAsync().catch(() => null)) ?? null;
    if (!readerPresent()) await readJobs().catch(console.warn);
    dispatch({ type: 'maintain', network, away: exclusions(), hidden: blockedArtistIds() });
  })().finally(() => {
    maintaining = null;
  });
  maintaining = pass;
  return pass;
}

/**
 * How long the task with no screen goes on asking for one song's turn to be
 * looked for. Longer than the queue makes Discover's own wait after anything
 * else ended, and a search on top of that; short enough that two of them and
 * their downloads fit the window the system allows.
 */
const BACKGROUND_FIND_MS = 75_000;
/** How many songs one run of the task fetches. The next run goes on from there. */
const BACKGROUND_SONGS = 2;
/** How many songs it then looks for ahead, and how long it gives each: a search is a few seconds, and the window is not long. */
const BACKGROUND_FINDS = 3;
const BACKGROUND_SEEK_MS = 15_000;

/**
 * The whole of what the task with no screen does: the same looking-over, and
 * then the fetching itself, which with the app open is the queue's worker's.
 *
 * Android will not let that worker be started from behind the screen, so the
 * songs that are to be kept ready are fetched from here, one at a time, each
 * looked for first — there is no finder running either. Each is taken only
 * when the queue's own rules say it is that job's turn.
 */
export async function maintainDiscoverInBackground(): Promise<boolean> {
  await maintainDiscover();
  await idle();
  const native = downloads;
  if (!native) return true;
  const tried = new Set<string>();
  for (let fetched = 0; fetched < BACKGROUND_SONGS; fetched++) {
    const jobs = await readJobs();
    await idle();
    const waitingJobs = new Set(jobs.filter((job) => job.status === 'queued' && job.discoverKey).map((job) => job.id));
    const state = boot();
    const next = [...(state.staged?.items ?? []), ...state.list]
      .map((item) => item.jobId)
      .find((id): id is string => !!id && waitingJobs.has(id) && !tried.has(id));
    if (!next) break;
    tried.add(next);
    await findUntil(native, next, Date.now() + BACKGROUND_FIND_MS);
    await native.downloadDiscoverBackgroundAsync(next);
    await readJobs();
    await idle();
  }
  /*
    And with what is left of the window, a few of the songs nobody has asked
    for are looked for ahead, as they are while the app is open: the core has
    asked for them already, and with no app there is nobody but this to do
    the looking. Whatever is not got to waits as it is.
  */
  const sought = new Set<string>();
  for (let found = 0; found < BACKGROUND_FINDS; found++) {
    const jobs = await readJobs();
    await idle();
    const next = jobs.find((job) => job.hold && job.status === 'queued' && !!job.video.find && !sought.has(job.id));
    if (!next) break;
    sought.add(next.id);
    await findUntil(native, next.id, Date.now() + BACKGROUND_SEEK_MS);
  }
  await readJobs();
  await idle();
  const problem = boot().problem;
  return problem == null || problem.code === 'offline';
}

/** The songs that would be fetched ahead now, by id. For whoever wants to say so; nothing is asked for by reading it. */
export function discoverWanted(): string[] {
  return wanted(boot(), Date.now()).map((item) => item.id);
}

export type DiscoverActions = {
  /** Plays the song: at once if it is ready, and as soon as it is if not. Tapping another meanwhile is asking for that one instead. */
  play: (id: string) => void;
  /** Puts the song in the library and takes it off the list. One that is not ready is fetched first. */
  keep: (id: string) => void;
  /** Never this song again. It leaves the list, and the player's queue if it is in it. Can be undone for ten seconds. */
  exclude: (id: string) => void;
  /** The same, and nothing more by its artist either. */
  excludeArtist: (id: string) => void;
  /** Takes back the last exclusion, while the notice still offers it. */
  undo: () => void;
  /** A new list. Pressed while one is being got ready, shows that one as far as it has got. */
  refresh: () => void;
  /** Fills the empty places of a short list. */
  findMore: () => void;
  /** Takes down the problem or the notice on show. A problem that is still so comes back the next time it is run into. */
  dismiss: (what: 'problem' | 'notice') => void;
  /** Changes the settings. Unknown fields are kept as they are given. */
  configure: (settings: DiscoverSettings) => void;
  /** Lets a song that was excluded be recommended again: for the list of excluded songs in Settings. */
  allowAgain: (id: string) => void;
};

export const discoverActions: DiscoverActions = {
  play: (id) => dispatch({ type: 'play', id }),
  keep: (id) => dispatch({ type: 'keep', id }),
  exclude: (id) => dispatch({ type: 'exclude', id }),
  excludeArtist: (id) => dispatch({ type: 'exclude', id, artist: true }),
  undo: () => dispatch({ type: 'undo' }),
  refresh: () => dispatch({ type: 'refresh' }),
  findMore: () => dispatch({ type: 'findMore' }),
  dismiss: (what) => dispatch({ type: 'dismiss', what }),
  configure: (settings) => dispatch({ type: 'settings', value: settingsFrom(settings) }),
  allowAgain: (id) => {
    const song = blockedSongs().find((row) => row.id === id);
    dispatch({ type: 'allow', id, key: song ? songKey(song) : '' });
  },
};

/** Whether [id] is a song on the list now. */
export function onDiscoverList(id: string): boolean {
  return !!itemOf(boot(), id);
}
