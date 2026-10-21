/**
 * What the history and Discover's lists have to say about which songs go
 * together, worked out from rows already read.
 *
 * Pure, and run seldom: `data.ts` keeps what comes of it and asks again only
 * when it has grown old, so that none of this is done when a song changes.
 */

/** A listen as it is read for this: which track, when it began, and for how long. */
export type ListenRow = { track_id: string; started_at: number; seconds_played: number };

/**
 * How long a gap between one listen ending and the next beginning still makes
 * them one sitting. A song paused for a phone call is still followed by the
 * next one in the same mood; the next morning's first song is not.
 */
export const SITTING_GAP_MS = 15 * 60_000;

/**
 * For each track, how often each other track was played straight after it or
 * straight before it in one sitting.
 *
 * Both ways round, since "goes with" is: somebody who plays B after A has said
 * as much about B's neighbours as about A's. The same track twice in a row is
 * not counted — that is somebody listening to it again, not a pairing. Rows
 * may come in any order; they are put in time order first.
 */
export function listenedTogether(rows: readonly ListenRow[], gapMs = SITTING_GAP_MS): Map<string, Map<string, number>> {
  const ordered = [...rows].sort((a, b) => a.started_at - b.started_at);
  const pairs = new Map<string, Map<string, number>>();
  const count = (from: string, to: string) => {
    let row = pairs.get(from);
    if (!row) pairs.set(from, (row = new Map()));
    row.set(to, (row.get(to) ?? 0) + 1);
  };
  for (let i = 1; i < ordered.length; i++) {
    const before = ordered[i - 1]!;
    const after = ordered[i]!;
    if (before.track_id === after.track_id) continue;
    const ended = before.started_at + Math.max(0, before.seconds_played) * 1000;
    if (after.started_at - ended > gapMs) continue;
    count(before.track_id, after.track_id);
    count(after.track_id, before.track_id);
  }
  return pairs;
}

/** Fewer than this many endings — heard through, or walked out on — and nothing is said about a track's habit. */
export const HABIT = 3;

/**
 * How reliably each track is walked out on, from nought to one: its skips over
 * its skips and its listens heard to the end.
 *
 * A skip is any listen that was ended by moving on, however long it ran
 * (`recordSkip`); a listen heard through is a play with `completed`. A listen
 * cut short by anything else — the app closing, a new queue — is neither, as
 * it is not an opinion. Below [HABIT] endings a track has no rate at all.
 */
export function skipRates(
  completed: ReadonlyMap<string, number>,
  skipped: ReadonlyMap<string, number>
): Map<string, number> {
  const rates = new Map<string, number>();
  for (const [id, skips] of skipped) {
    const ends = skips + (completed.get(id) ?? 0);
    if (ends >= HABIT) rates.set(id, skips / ends);
  }
  return rates;
}

/** As a pool song carries why it is there: only what is read of it here. See `discover/why.ts`. */
export type WhySong = {
  artist: string;
  why?: { kind: string; seeds: readonly string[]; via?: readonly string[]; similarity: number | null };
};

/**
 * How near Discover found artists to be, by folded name, both ways round.
 *
 * Read off the songs of its pool. A song by a neighbour of somebody's artist X
 * says the two are near, by as much as it says; a song by an artist somebody
 * has, that was reached by way of X, says the same of two artists both in the
 * library — which is what the library's similar songs can use. Where it does
 * not say how near, it is taken as middling. The nearest reading of any pair
 * is the one kept.
 */
export function artistNearness(
  songs: readonly WhySong[],
  fold: (name: string) => string
): Map<string, Map<string, number>> {
  const near = new Map<string, Map<string, number>>();
  const note = (a: string, b: string, value: number) => {
    if (!a || !b || a === b) return;
    for (const [from, to] of [[a, b], [b, a]] as const) {
      let row = near.get(from);
      if (!row) near.set(from, (row = new Map()));
      if ((row.get(to) ?? 0) < value) row.set(to, value);
    }
  };
  for (const song of songs) {
    const why = song.why;
    if (!why) continue;
    const value = Math.min(1, Math.max(0, why.similarity ?? 0.5));
    const artist = fold(song.artist);
    const others = why.kind === 'yours' ? (why.via ?? []) : why.kind === 'near' ? why.seeds : [];
    for (const other of others) note(artist, fold(other), value);
  }
  return near;
}
