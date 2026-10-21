import type { RepeatMode } from '../../../../modules/jukebox-audio/index.ts';

/**
 * When the queue is about to run out, what to do about it, and in what order.
 *
 * Nothing here reads the library, the history or Discover. It is told how the
 * queue stands and answers whether songs are wanted yet, how many, and how a
 * batch of two kinds is laid out — so that the part of "keep playing" which
 * decides *when* can be held to on a desk, apart from the part that decides
 * *what*.
 */

/**
 * What somebody has chosen for the end of the queue.
 *
 * `fresh` is "New songs": songs the library does not have, from Discover. It
 * is not called `new` only because that word is spoken for in the language
 * this is written in.
 */
export type AutoplayMode = 'off' | 'library' | 'fresh' | 'mixed';

export const AUTOPLAY_MODES: readonly AutoplayMode[] = ['off', 'library', 'fresh', 'mixed'];

/** The setting as it was stored, made safe to go by. Anything unreadable is off, which is where every install starts. */
export function modeFrom(stored: string | null | undefined): AutoplayMode {
  return (AUTOPLAY_MODES as readonly (string | null | undefined)[]).includes(stored) ? (stored as AutoplayMode) : 'off';
}

/**
 * How many songs are left after the one playing when the next ones are added.
 *
 * From the library a batch is a moment's arithmetic, so two left is enough
 * warning: the songs are in the player's queue several minutes before they are
 * needed, which is what lets the crossfade, the notification and the lock
 * screen treat them as they treat anything else. New songs have to be found
 * and downloaded first, so they are asked for with a song more in hand.
 */
export const LOW_WATER: Record<Exclude<AutoplayMode, 'off'>, number> = { library: 2, fresh: 3, mixed: 3 };

/**
 * How much further ahead of that Discover is asked to get new songs ready.
 *
 * Asking is cheap — it marks songs as wanted, and Discover downloads them one
 * at a time behind anything somebody asked for themselves — and a download is
 * a minute or so where the connection is good. Three songs ahead of the top-up
 * is ten minutes or more of listening, which is usually enough for the songs
 * to be in by the time they are reached.
 */
export const PREPARE_AHEAD = 3;

/**
 * How many songs one top-up adds.
 *
 * Library songs come in eights: enough that the queue does not need seeing to
 * again for half an hour, few enough that a batch that turns out wrong — a
 * seed that was a mood and not a taste — is soon behind. New songs come in
 * fewer, because each is a download. A mixed batch is laid out as two from the
 * library and then one new song (see `interleave`), three times over.
 */
export const BATCH: Record<Exclude<AutoplayMode, 'off'>, { library: number; fresh: number }> = {
  library: { library: 8, fresh: 0 },
  fresh: { library: 0, fresh: 4 },
  mixed: { library: 6, fresh: 3 },
};

/**
 * Library songs that fill in, in the New songs mode, where no new song is
 * ready by the time the queue is down to its last song. Two: enough to give
 * Discover another few minutes, and few enough that the songs that follow are
 * the new ones that were asked for.
 */
export const BRIDGE = 2;

export type QueueStanding = {
  mode: AutoplayMode;
  repeat: RepeatMode;
  /** The songs that were picked were taken out by hand, and this queue is not to be given more. */
  dismissed: boolean;
  /** The player is lent to the game: see `lend` in `PlayerProvider`. */
  onLoan: boolean;
  length: number;
  currentIndex: number;
  /** The player ran off the end of the queue and is standing there. */
  ended: boolean;
  /**
   * The song after the one playing is a picked one. Only then does a player
   * standing at the end play on by itself: songs somebody queued onto a
   * stopped player are theirs to start.
   */
  nextIsPicked: boolean;
};

export type TopUp =
  /** Nothing to do yet, or nothing to be done at all. */
  | { kind: 'none' }
  /** The player stopped at the end of a queue that has picked songs after it now: play on from the next one. */
  | { kind: 'resume'; index: number }
  /** Not yet, but soon enough that Discover should be getting new songs ready. */
  | { kind: 'prepare' }
  /**
   * Add songs now. `urgent` is the queue down to its last song, or past it:
   * whatever can be had at once is better than waiting for what is wanted.
   */
  | { kind: 'add'; urgent: boolean };

/**
 * Whether the end of the queue wants seeing to, and how.
 *
 * Never with repeat on: a queue that goes round again does not run out, and
 * one that repeats a single song is somebody listening to that song. Never on
 * a queue whose picks were taken out, nor while the game has the player. And
 * never with nothing played to go on from.
 */
export function topUp(q: QueueStanding): TopUp {
  if (q.mode === 'off' || q.repeat !== 'off' || q.dismissed || q.onLoan) return { kind: 'none' };
  if (q.length === 0 || q.currentIndex < 0 || q.currentIndex >= q.length) return { kind: 'none' };
  const remaining = q.length - 1 - q.currentIndex;
  if (q.ended && remaining > 0) return q.nextIsPicked ? { kind: 'resume', index: q.currentIndex + 1 } : { kind: 'none' };
  if (q.ended) return { kind: 'add', urgent: true };
  const low = LOW_WATER[q.mode];
  if (remaining <= low) return { kind: 'add', urgent: remaining <= 1 };
  if (q.mode !== 'library' && remaining <= low + PREPARE_AHEAD) return { kind: 'prepare' };
  return { kind: 'none' };
}

/**
 * Two kinds of song laid out as one batch: [every]−1 from the first, then one
 * from the second, and round again.
 *
 * Two from the library to one new song, by default. More new than that and a
 * mixed queue is mostly strangers, which is the New songs mode; fewer and the
 * new ones are so far apart that the mix is not felt. Two to one also means a
 * new song is never followed by another, so each comes between two known ones.
 *
 * Where one kind runs out the other fills its places: a new song that was not
 * ready is a library song in its slot, not a gap.
 */
export function interleave<T>(familiar: readonly T[], fresh: readonly T[], every = 3): T[] {
  const out: T[] = [];
  let a = 0;
  let b = 0;
  while (a < familiar.length || b < fresh.length) {
    const freshTurn = out.length % every === every - 1;
    if ((freshTurn && b < fresh.length) || a >= familiar.length) out.push(fresh[b++]!);
    else out.push(familiar[a++]!);
  }
  return out;
}

/**
 * Moves songs about so that no artist follows themself, where that can be done.
 *
 * Taken in their order, each time the first song whose artist is not the one
 * just before it. Where every song left is by that artist, the next of them
 * goes anyway: nothing is dropped, and the order is otherwise kept, since it is
 * the order of preference. [before] is the artist of the song the batch
 * follows.
 */
export function apart<T>(items: readonly T[], artistOf: (item: T) => string, before: string | null = null): T[] {
  const waiting = [...items];
  const out: T[] = [];
  let last = before;
  while (waiting.length) {
    const at = waiting.findIndex((item) => !last || !artistOf(item) || artistOf(item) !== last);
    const [taken] = waiting.splice(at < 0 ? 0 : at, 1);
    out.push(taken!);
    last = artistOf(taken!) || null;
  }
  return out;
}

/** What the songs that were picked are, as far as the heading over them is concerned. */
export type SectionKind = 'library' | 'fresh' | 'mixed';

/** A Discover song's file, in the player, is `discover:<job>`. Anything else is the library's. */
export const isFreshId = (id: string): boolean => id.startsWith('discover:');

/**
 * Which heading the picked songs go under: said of what they are, not of what
 * was asked for, so that the heading is right however the setting was changed
 * since and whatever had to fill in.
 */
export function sectionKind(ids: readonly string[]): SectionKind {
  const fresh = ids.filter(isFreshId).length;
  if (fresh === 0) return 'library';
  return fresh === ids.length ? 'fresh' : 'mixed';
}
