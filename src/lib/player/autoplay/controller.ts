import { AppState } from 'react-native';

import type { RepeatMode } from '../../../../modules/jukebox-audio/index.ts';
import {
  autoplaySource, callForAutoplay, discoverReadyCount, growForAutoplay, lendToAutoplay,
} from '../../discover/engine';
import { libraryState } from '../../library/index';
import { splitCredit } from '../../metadata/credit';
import { artistKey, spreadShuffle } from '../../media/shuffle';
import type { Track } from '../../types';
import { candidateOf, contextNow, foldName, KEPT_FOR_MS, libraryIndex, playedSince } from './data';
import { CALL_AT_ONCE, chooseFresh, freshTrouble, type FreshSeed } from './fresh';
import { drawBatch, scoreLibrary, seedsOf, type Candidate } from './library';
import { apart, batchFor, BRIDGE, interleave, isFreshId, LOW_WATER, PREPARE_AHEAD, topUp, type AutoplayMode } from './plan';
import { autoplayMode, autoplaySizes, setAutoplayNote, watchAutoplayMode, type AutoplayNote } from './setting';
import { tapChoice, watchTapChoice } from '../tapSetting';

/**
 * Keeping the music going when the queue runs out, done.
 *
 * `plan.ts` says when, `library.ts` and `fresh.ts` say what, `data.ts` reads
 * what they go on. This holds the little that is true of the moment — what
 * the player is doing, whether it ran off the end, what was picked last — and
 * does the work, off to one side of everything else.
 *
 * Like Discover's engine it is not a component. The player's provider tells
 * it what the queue is (through `Autoplay`, which is nothing but that), and it
 * hands songs back through the port it is given. That is also why it goes on
 * working with the screen off: the player's service keeps the JavaScript
 * running, the provider goes on being told of every change, and this goes on
 * being told by it — the same road Discover's queue is topped up by while the
 * phone is locked.
 *
 * NOTHING HERE IS DONE WHEN A SONG CHANGES. A change is noted, and a look is
 * taken a moment later, after whatever else the change set off has been
 * drawn. The look is a few comparisons unless songs are due; then the
 * library-wide figures are read from where `data.ts` keeps them, and only the
 * scoring itself is done there and then.
 *
 * "A moment later" is a timer only while the app is in front. Behind the lock
 * screen React Native's timers do not run at all — on Android they are driven
 * by the screen's frames, and with no screen there are none — so a look put
 * off by a timer would wait for the phone to be unlocked, long after the
 * queue had run out. There is nothing on screen to keep smooth then either,
 * so behind the screen a look is taken as soon as the work in hand is done,
 * on the back of a promise, the way Discover's queue is topped up there.
 */

/** What the player's provider says of the queue. */
export type PlayerView = {
  queue: readonly Track[];
  /** Which queue it is: see `queueId` in the player's provider. */
  queueId: number;
  currentIndex: number;
  repeat: RepeatMode;
  /** Where the songs picked here begin, or -1: see `section.ts`. */
  autoFrom: number;
  dismissed: boolean;
  /** Begun as similar songs to a track, and kept going with them: see `player/tap.ts`. */
  similar: boolean;
  onLoan: boolean;
};

export type AppendResult = 'added' | 'stale' | 'failed';

/** What this asks of the player. */
export type AutoplayPort = {
  /**
   * Adds [tracks] after everything, as picked songs; with [start], plays the
   * first of them. Only onto [basis], the queue they were picked for: answers
   * `stale`, adding nothing, where the queue has changed since, and `failed`
   * where the player would not take them.
   */
  append: (tracks: Track[], start: boolean, basis: readonly Track[]) => Promise<AppendResult>;
  /** Plays on from the row at [index], for a player that stopped at an end that is no longer the end. */
  playFrom: (index: number) => Promise<void>;
};

let view: PlayerView | null = null;
let port: AutoplayPort | null = null;
/** The player ran off the end of the queue and has not moved since. */
let ended = false;
/** The look that is waiting to be taken, and whether one is being taken now. */
let timer: ReturnType<typeof setTimeout> | null = null;
let looking = false;
let lookAgain = false;
/**
 * What the last look was about. A look about the same queue, at the same
 * place in it, with as many Discover songs ready as before, would come to the
 * same answer, and is not taken twice: the queue may well be read many times
 * a minute while a download runs.
 */
let lastAbout = '';
/** The songs picked last time, which are not picked again straight away. */
let lastBatch: ReadonlySet<string> = new Set();

/** How long after a change the look is taken: past the redraw the change itself set off. */
const SETTLE_MS = 400;
/** How long a song played is not offered again. */
const DAY_MS = 24 * 3_600_000;

/** Whether the app is in front, where a timer runs and there is a screen to keep smooth. */
const inFront = () => AppState.currentState === 'active';

/** When the look already put off is due. */
let dueAt = 0;

/**
 * Has a look taken in [delay], or sooner if one is already due sooner. Never
 * later: Discover changes every second while a song downloads, and a look
 * pushed back by each change would never be taken at all.
 */
function soon(delay = SETTLE_MS): void {
  if (!inFront()) {
    if (timer) clearTimeout(timer);
    timer = null;
    void Promise.resolve().then(look);
    return;
  }
  const at = Date.now() + delay;
  if (timer && dueAt <= at) return;
  if (timer) clearTimeout(timer);
  dueAt = at;
  timer = setTimeout(() => {
    timer = null;
    void look();
  }, delay);
}

/** Waits that a timer is keeping, to be let go at once if the app goes behind the screen and the timer stops. */
const pauses = new Set<() => void>();

/** Lets whatever is waiting to be drawn be drawn first, where there is anything to draw. */
function breathe(): Promise<void> {
  if (!inFront()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(wait);
      pauses.delete(done);
      resolve();
    };
    const wait = setTimeout(done, 0);
    pauses.add(done);
  });
}

/* Gone behind the screen with a look still put off by a timer: taken now, since the timer will not run. */
AppState.addEventListener('change', (state) => {
  if (state === 'active') return;
  for (const done of [...pauses]) done();
  if (timer) soon();
});

/** The player is doing something else now. */
export function autoplayPlayerChanged(next: PlayerView): void {
  const was = view;
  view = next;
  // Somewhere other than the row it ended on is not standing at the end. Songs added after that row still are.
  if (was && was.currentIndex !== next.currentIndex) ended = false;
  soon();
}

/** The sleep timer is waiting for a song to end, and when it last stopped the music at one. */
let sleepWaits = false;
let sleptAt = 0;
/**
 * How long after the sleep timer stopped the music its stopping is still
 * taken to be what ended the queue. The two are told across the bridge
 * separately, in whichever order they come.
 */
const SLEEP_GRACE_MS = 5_000;

/** What the sleep timer is doing now. */
export function autoplaySleepChanged(timer: { kind: string; finishing: boolean }): void {
  if (sleepWaits && timer.kind === 'off') sleptAt = Date.now();
  sleepWaits = timer.kind === 'endOfTrack' || timer.finishing;
}

/**
 * The player ran off the end of the queue. Seen to at once: there is silence
 * until it is.
 *
 * Unless it was the sleep timer, set to stop at the end of a song, that the
 * last song of the queue ended for: that is somebody going to sleep, and the
 * music is not to start again under them. Songs may still be added after it;
 * they are not started.
 */
export function autoplayQueueEnded(): void {
  if (sleepWaits || Date.now() - sleptAt < SLEEP_GRACE_MS) return;
  ended = true;
  soon(0);
}

/** A song began. Whatever it is, the player is not standing at the end. */
export function autoplayTrackChanged(): void {
  ended = false;
}

/** Discover has changed: a song asked for may be in. Only looked at where new songs are wanted. */
export function autoplayDiscoverChanged(): void {
  const mode = view ? modeFor(view) : autoplayMode();
  if (mode === 'fresh' || mode === 'mixed') soon(1_000);
}

/** Joins this to the player, while there is a player to join it to. */
export function attachAutoplay(player: AutoplayPort): () => void {
  port = player;
  const changed = () => {
    lastAbout = '';
    soon();
  };
  const unwatch = watchAutoplayMode(changed);
  const unwatchTap = watchTapChoice(changed);
  return () => {
    unwatch();
    unwatchTap();
    if (port === player) port = null;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}

/** One look at a time; a change during one is looked at again after it. */
async function look(): Promise<void> {
  if (looking) {
    lookAgain = true;
    return;
  }
  looking = true;
  try {
    await see();
  } catch (error) {
    console.warn('Could not keep the music going', error);
  } finally {
    looking = false;
    if (lookAgain) {
      lookAgain = false;
      soon();
    }
  }
}

/**
 * What the end of [v] is kept going with: what was chosen for the end of
 * every queue, or, for the first batch of a queue begun as similar songs to a
 * track, what was chosen for those — apart from the other, and never nothing.
 * Once that batch is in, the player takes the mark off and the queue goes on
 * by the first choice, as any queue does: the tap's choice is how a queue
 * begins, not how it carries on.
 */
function modeFor(v: PlayerView): AutoplayMode {
  return v.similar ? tapChoice().source : autoplayMode();
}

/**
 * Repeat as it bears on keeping [v] going. A queue begun as similar songs is
 * one song until its batch comes, and repeat all on it would play that song
 * again and again on its own: so it is taken as off until then. Repeat one
 * is somebody wanting that one song, and holds.
 */
function repeatFor(v: PlayerView): RepeatMode {
  return v.similar && v.repeat === 'all' ? 'off' : v.repeat;
}

async function see(): Promise<void> {
  const v = view;
  const player = port;
  if (!v || !player) return;
  const mode = modeFor(v);
  const decision = topUp({
    mode,
    repeat: repeatFor(v),
    dismissed: v.dismissed,
    onLoan: v.onLoan,
    length: v.queue.length,
    currentIndex: v.currentIndex,
    ended,
    nextIsPicked: v.autoFrom >= 0 && v.autoFrom <= v.currentIndex + 1 && v.currentIndex + 1 < v.queue.length,
  });
  // No picked songs left in the queue, and so nothing for a line over them to be about.
  if (v.autoFrom < 0) setAutoplayNote(null);
  if (mode === 'off') return;
  if (decision.kind === 'none') {
    await warm(v, mode);
    return;
  }
  if (decision.kind === 'resume') {
    ended = false;
    await player.playFrom(decision.index);
    return;
  }

  /*
    With which queue it is. Without it, every queue of one song begun as
    similar songs was the same as the last — one song, at its start — and a
    look that found nothing for the first was taken to be the answer for
    every one after it, until the app was closed.
  */
  const about = [v.queueId, decision.kind, mode, v.queue.length, v.currentIndex, ended, mode === 'library' ? 0 : discoverReadyCount()].join(':');
  if (about === lastAbout) return;
  lastAbout = about;

  // Out of the way of the change that brought this about: the figures below are the library's.
  await breathe();
  if (view !== v) {
    lastAbout = '';
    lookAgain = true;
    return;
  }

  const adding = decision.kind === 'add';
  const picked = pick(v, mode, adding, adding && decision.urgent);
  if (!adding || !picked.tracks.length) return;

  const start = ended;
  const went = await player.append(picked.tracks, start, v.queue);
  if (went === 'stale') {
    // The queue changed under the picking. Picked again for the queue as it is now.
    lastAbout = '';
    lookAgain = true;
    return;
  }
  // Refused, and said so where refusals are. Not tried again for this same queue: it would only be refused again.
  if (went === 'failed') return;
  if (start) ended = false;
  const fresh = picked.tracks.filter((track) => isFreshId(track.id)).map((track) => track.id);
  if (fresh.length) lendToAutoplay(fresh);
  lastBatch = new Set(picked.tracks.map((track) => track.id));
  setAutoplayNote(picked.note);
}

/** When the figures were last read ahead of a top-up. */
let warmedAt = 0;

/**
 * Reads the library-wide figures a few songs before they are wanted, so that
 * the top-up itself is only the scoring. They are kept for half an hour (see
 * `data.ts`), so this is a read at most that often, and then nothing.
 */
async function warm(v: PlayerView, mode: Exclude<AutoplayMode, 'off'>): Promise<void> {
  if (repeatFor(v) !== 'off' || v.dismissed || v.onLoan || v.currentIndex < 0) return;
  const remaining = v.queue.length - 1 - v.currentIndex;
  if (remaining > LOW_WATER[mode] + PREPARE_AHEAD + 1) return;
  const now = Date.now();
  if (now - warmedAt < KEPT_FOR_MS && now >= warmedAt) return;
  warmedAt = now;
  await breathe();
  const library = libraryState();
  const idx = libraryIndex(library.kind === 'library' ? library.tracks : []);
  contextNow(idx.idf, autoplaySource().pool, now);
}

/**
 * The songs to add now — or, where it is only time to `prepare`, nothing but
 * the asking of Discover.
 *
 * Library songs are picked afresh every time. New songs are whichever of
 * Discover's are ready now, the nearest first, and Discover is asked to get
 * the next few near ones ready for the top-up after; where it has nothing near
 * at all, it is asked to look around the artists playing. Where new songs were
 * wanted and cannot be had — no downloader, no connection, Wi-Fi only — the
 * library stands in for them, and the line over the songs says why.
 */
function pick(v: PlayerView, mode: Exclude<AutoplayMode, 'off'>, adding: boolean, urgent: boolean): { tracks: Track[]; note: AutoplayNote | null } {
  const now = Date.now();
  const library = libraryState();
  const tracks = library.kind === 'library' ? library.tracks : [];
  const idx = libraryIndex(tracks);
  const discover = autoplaySource();
  const queued = new Set(v.queue.map((track) => track.id));
  const played = playedSince(now - DAY_MS);
  const seedTracks = seedsOf(v.queue, v.currentIndex);
  const seeds = seedTracks.map(({ track, weight }) => ({ candidate: idx.byId.get(track.id) ?? candidateOf(track), weight }));
  const last = v.queue[v.queue.length - 1];
  const after = last ? (idx.byId.get(last.id) ?? candidateOf(last)).lead || null : null;
  // As many of each as somebody chose: see `batchFor`.
  const sizes = autoplaySizes();
  const plan = batchFor(mode, sizes);

  let fresh: Track[] = [];
  let trouble: AutoplayNote | null = null;
  if (plan.fresh > 0) {
    const freshSeeds: FreshSeed[] = seeds.map(({ candidate, weight }) => ({ names: candidate.names, tags: candidate.tags, weight }));
    // Asked to get ready at least as many as a batch takes, so that a batch of ten is not waiting on four at a time.
    const choice = chooseFresh(discover.items, discover.pool, freshSeeds, queued, played, foldName, Math.max(CALL_AT_ONCE, plan.fresh));
    const problem = freshTrouble(discover);
    if (problem !== 'unavailable') {
      // Asked for even with no connection to fetch them on: Discover waits for the one its settings allow, and fetches them then.
      if (choice.call.length) callForAutoplay(choice.call);
      if (choice.near === 0) {
        const artists = seedTracks.slice(0, 2).map(({ track }) => splitCredit(track.artist)[0]).filter((name): name is string => !!name);
        void growForAutoplay([...new Set(artists)]);
      }
    }
    fresh = choice.ready.slice(0, plan.fresh);
    if (fresh.length < plan.fresh) trouble = problem ?? 'waiting';
  }
  if (!adding) return { tracks: [], note: null };

  /*
    What the library is asked for: its own share, and in a mixed batch the
    places new songs could not fill. In the New songs mode, with no new song
    ready, a full batch where they cannot be had at all — and where they are
    only not in yet, nothing until the queue is down to its last song, and
    then a couple to bridge the gap.
  */
  let wanted = plan.library;
  if (mode === 'mixed') wanted += plan.fresh - fresh.length;
  if (mode === 'fresh' && !fresh.length) wanted = trouble === 'waiting' ? (urgent ? BRIDGE : 0) : sizes.library;
  let familiar: Candidate[] = [];
  if (wanted > 0) {
    const scored = scoreLibrary(idx.candidates, seeds, contextNow(idx.idf, discover.pool, now), new Set([...queued, ...played]), lastBatch);
    familiar = drawBatch(scored, wanted, after, Math.random);
  }
  const byId = new Map<string, Track>(tracks.map((track) => [track.id, track]));
  const known = familiar.map((candidate) => byId.get(candidate.id)).filter((track): track is Track => !!track);
  /*
    A queue somebody began as similar songs, and too little known about them
    to find enough: the rest from the library at random, spread so that no
    artist follows themself, and said so over them. Asked for in so many
    words, it is not to stand empty because a song has no tags and no artist;
    the end of an ordinary queue, which nobody asked for, may come out short.
  */
  let guessed = false;
  if (v.similar && known.length < wanted) {
    const taken = new Set([...queued, ...played, ...known.map((track) => track.id)]);
    const rest = spreadShuffle(tracks.filter((track) => !taken.has(track.id)), artistKey).slice(0, wanted - known.length);
    known.push(...rest);
    guessed = rest.length > 0;
  }
  /*
    A mixed batch keeps its two-and-one: the library's songs were drawn with
    no artist twice running, and a new song between two of them is not moved.
    Otherwise the batch is spread so that no artist follows themself, which
    new songs nearest a seed, often "more from" one artist, would otherwise do.
  */
  const leads = new Map(familiar.map((candidate) => [candidate.id, candidate.lead]));
  const ordered = mode === 'mixed'
    ? interleave(known, fresh)
    : apart([...fresh, ...known], (track) => leads.get(track.id) ?? foldName(splitCredit(track.artist)[0]), after);
  // Said only where the library stood in for every new song: one new song in three not being ready is nothing to remark on.
  if (guessed) return { tracks: ordered, note: 'random' };
  return { tracks: ordered, note: mode !== 'library' && !fresh.length && known.length ? trouble : null };
}
