import type { Track } from '../../types.ts';

/**
 * New songs like the ones just listened to, out of what Discover has.
 *
 * Pure. Discover's list and pool are handed in as they are, with the seed
 * already read; what comes back is which of its songs that are ready to play
 * are nearest, in order, and which that are not ready are near enough to be
 * worth having Discover get ready now. Nothing is asked of Discover from here.
 *
 * Near is said of a song the way Discover itself says why a song is on its
 * list (`discover/why.ts`): it is by an artist the seed is by ("More from X"),
 * or Discover came to it from that artist ("Like X"), or — more faintly — it
 * is tagged as the seed is.
 */

/** A song as Discover keeps it: only what is read of it here. */
export type FreshSong = {
  recordingMbid: string;
  title: string;
  artist: string;
  artistMbid: string;
  /** The line Discover wrote before it kept its reasons apart, naming who led here. */
  because: string;
  tags?: readonly string[];
  why?: { seeds: readonly string[]; via?: readonly string[]; tags?: readonly string[]; similarity: number | null };
};

/** One song of Discover's list, as far as this needs it. */
export type FreshItem<S extends FreshSong = FreshSong> = {
  song: S;
  /** Its file, once it is ready to play. */
  track: Track | null;
  /** Already played from the list once. A new song heard is not new any more. */
  heard: boolean;
  /** It can never be made ready: no recording of it, or a failure that will not mend by itself. */
  lost: boolean;
};

/** A seed as this reads it: who it is by, folded, how it is tagged, and how much it counts. */
export type FreshSeed = { names: readonly string[]; tags: readonly string[]; weight: number };

/** By an artist the seed is by. */
export const SAME_ARTIST = 3;
/** Reached from an artist the seed is by, at Discover's nearness; middling where it did not say. */
export const LED_HERE = 2;
/** Each tag shared with a seed, up to [TAGS_COUNTED] of them. */
export const SHARED_TAG = 0.5;
export const TAGS_COUNTED = 3;

/** How near one song is to the seeds. Nought is not near at all. */
export function nearness(song: FreshSong, seeds: readonly FreshSeed[], fold: (name: string) => string): number {
  const artist = fold(song.artist);
  const led = new Set([...(song.why?.seeds ?? []), ...(song.why?.via ?? [])].map(fold));
  // A song kept from before the reasons were kept apart names its seeds in one line.
  if (!song.why) for (const name of song.because.split(' · ')) led.add(fold(name));
  const tags = new Set([...(song.tags ?? []), ...(song.why?.tags ?? [])].map((tag) => tag.toLowerCase()));
  const similarity = Math.min(1, Math.max(0.2, song.why?.similarity ?? 0.5));

  let score = 0;
  for (const seed of seeds) {
    if (!(seed.weight > 0)) continue;
    let mine = 0;
    if (artist && seed.names.includes(artist)) mine += SAME_ARTIST;
    else if (seed.names.some((name) => name && led.has(name))) mine += LED_HERE * similarity;
    const shared = seed.tags.filter((tag) => tags.has(tag.toLowerCase())).length;
    mine += SHARED_TAG * Math.min(TAGS_COUNTED, shared);
    score += seed.weight * mine;
  }
  return score;
}

/** How many songs Discover is asked to get ready at once for the player. One download after another, so a few is plenty. */
export const CALL_AT_ONCE = 4;

export type FreshChoice<S extends FreshSong = FreshSong> = {
  /** Ready to play, the nearest first; songs that are not near at all after them, in the list's own order. */
  ready: Track[];
  /** Near, not ready, and worth having Discover get ready: on its list or still in its pool. */
  call: S[];
  /** How many songs Discover has that are near at all, ready or not: none is the time to look further afield. */
  near: number;
};

/**
 * Which of Discover's songs to play next, and which to have it get ready.
 *
 * Never a song already played from the list, one already in the queue
 * ([queued], by file), one played lately ([played], by file), nor one that
 * cannot be had. Songs excluded or blocked in Discover never reach here: they
 * leave its list and pool the moment they are excluded.
 */
export function chooseFresh<S extends FreshSong>(
  items: readonly FreshItem<S>[],
  pool: readonly S[],
  seeds: readonly FreshSeed[],
  queued: ReadonlySet<string>,
  played: ReadonlySet<string>,
  fold: (name: string) => string
): FreshChoice<S> {
  const listed = new Set(items.map((item) => item.song.recordingMbid));
  const usable = items.filter((item) => !item.heard && !item.lost && !(item.track && (queued.has(item.track.id) || played.has(item.track.id))));
  const rated = usable.map((item, order) => ({ item, order, score: nearness(item.song, seeds, fold) }));
  const best = (a: { score: number; order: number }, b: { score: number; order: number }) => b.score - a.score || a.order - b.order;

  const ready = rated.filter((entry) => entry.item.track).sort(best).map((entry) => entry.item.track!);
  const unready = rated.filter((entry) => !entry.item.track && entry.score > 0).sort(best);
  const fromPool = pool
    .filter((song) => !listed.has(song.recordingMbid))
    .map((song, order) => ({ song, order, score: nearness(song, seeds, fold) }))
    .filter((entry) => entry.score > 0)
    .sort(best);

  // The list's own songs first among equals: Discover has looked for them already, and a song on the list is a row somebody may have seen.
  const call = [...unready.map((entry) => ({ song: entry.item.song, score: entry.score, listed: 1 })), ...fromPool.map((entry) => ({ song: entry.song, score: entry.score, listed: 0 }))]
    .sort((a, b) => b.score - a.score || b.listed - a.listed)
    .slice(0, CALL_AT_ONCE)
    .map((entry) => entry.song);

  const nearReady = rated.filter((entry) => entry.item.track && entry.score > 0).length;
  return { ready, call, near: nearReady + unready.length + fromPool.length };
}

/** Why new songs cannot be had now, where they cannot: for the line over the picked songs. */
export type FreshTrouble = 'unavailable' | 'offline' | 'wifi';

/**
 * Whether Discover can fetch anything now, and if not, why.
 *
 * `unavailable` is a build with no downloader in it. With no connection, or
 * with Discover's songs kept to Wi-Fi and none about, the songs already ready
 * still play; only fetching more waits.
 */
export function freshTrouble(source: {
  usable: boolean;
  network: { connected: boolean; wifi: boolean } | null;
  wifiOnly: boolean;
}): FreshTrouble | null {
  if (!source.usable) return 'unavailable';
  if (source.network && !source.network.connected) return 'offline';
  if (source.wifiOnly && source.network && !source.network.wifi) return 'wifi';
  return null;
}
