import { splitCredit } from '../metadata/credit.ts';
import { foldForMatch } from '../metadata/text.ts';

/**
 * Turning several lists of "people like this" into one list worth reading.
 *
 * Nothing here talks to a catalogue or to the database. The recommendations
 * arrive from one service and the library from another, and what has to be got
 * right is the arithmetic between them: which names are already owned, which
 * suggestion came up under more than one thing listened to, and in what order
 * the survivors should be read. All of that can be checked without a network.
 */

/** An artist some service thinks goes with something already listened to. */
export type Candidate = {
  mbid: string;
  name: string;
  /** The service's own number. Comparable within one seed, not across seeds. */
  score: number;
};

/** A seed and what came back for it, kept together so the weight can be used. */
export type Suggested = {
  /** What was listened to that led here, for the "because you played…" line. */
  seed: string;
  /**
   * How much that seed counts, between 0 and 1. The artist listened to most
   * should pull harder than the fifth one down, or a single run of something
   * unrepresentative decides the whole page.
   */
  weight: number;
  candidates: Candidate[];
};

export type Suggestion = {
  mbid: string;
  name: string;
  /** Every seed that led here, best first. Two is a much stronger signal. */
  because: string[];
  score: number;
};

/**
 * Within one seed, the service's scores are a long tail: the top match can be
 * ten times the tenth. Taken raw, one seed's leader would outweigh everything
 * else put together. Rank is used instead — first place is worth 1, and the
 * rest fall away gently enough that the twentieth still counts for something.
 */
function worth(rank: number): number {
  return 1 / (1 + rank * 0.35);
}

/**
 * The suggestions, best first, with what is already owned taken out.
 *
 * A candidate that several seeds agree on is scored above one that a single
 * seed loved, because the first is a direction and the second is a neighbour.
 * That is what adding the weights does — three seeds at a third each beat one
 * seed at one.
 *
 * `owned` holds folded artist names; see {@link ownedArtists}. Matching on the
 * fold rather than the name is what stops `Sigur Rós` being recommended to
 * somebody who has `Sigur Ros`.
 */
export function rankSuggestions(
  suggested: Suggested[],
  owned: Set<string>,
  limit: number
): Suggestion[] {
  const merged = new Map<string, Suggestion & { seen: { seed: string; worth: number }[] }>();

  for (const { seed, weight, candidates } of suggested) {
    candidates.forEach((candidate, rank) => {
      if (!candidate.mbid || !candidate.name.trim()) return;
      if (owned.has(foldForMatch(candidate.name))) return;

      const gain = weight * worth(rank);
      const already = merged.get(candidate.mbid);
      if (already) {
        already.score += gain;
        already.seen.push({ seed, worth: gain });
        return;
      }
      merged.set(candidate.mbid, {
        mbid: candidate.mbid,
        name: candidate.name,
        because: [],
        score: gain,
        seen: [{ seed, worth: gain }],
      });
    });
  }

  return [...merged.values()]
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map(({ seen, ...suggestion }) => ({
      ...suggestion,
      because: seen
        .sort((left, right) => right.worth - left.worth)
        .map((entry) => entry.seed)
        // One seed can only lead here once, but two seeds spelled differently
        // are two reasons and both are worth saying.
        .filter((name, index, all) => all.indexOf(name) === index),
    }));
}

/**
 * Every artist name the library already has, folded for comparison.
 *
 * Built from the library rather than from the listening history on purpose: a
 * record owned and never played is still owned, and recommending it would be
 * the app telling somebody to go and find what is already on their phone.
 */
export function ownedArtists(tracks: { artist?: string | null }[]): Set<string> {
  const owned = new Set<string>();
  for (const track of tracks) {
    // The credit as written, and each name in it: somebody who is only ever a
    // guest in this library is still somebody whose music is already here.
    for (const name of [track.artist ?? '', ...splitCredit(track.artist)]) {
      const folded = foldForMatch(name);
      if (folded) owned.add(folded);
    }
  }
  return owned;
}

/**
 * How much each seed counts, from how much it was listened to.
 *
 * Shares of the total rather than the raw seconds, so the numbers mean the
 * same thing for somebody who listens for an hour a week and somebody who
 * listens for thirty. The square root flattens them: without it a favourite at
 * four times the next one down takes four times the say, and the page becomes
 * that one artist's neighbours with a few strangers at the bottom.
 */
export function weighSeeds<T extends { totalSeconds: number }>(
  seeds: T[]
): (T & { weight: number })[] {
  const top = Math.max(...seeds.map((seed) => seed.totalSeconds), 0);
  if (top <= 0) return seeds.map((seed) => ({ ...seed, weight: 1 }));
  return seeds.map((seed) => ({ ...seed, weight: Math.sqrt(seed.totalSeconds / top) }));
}
