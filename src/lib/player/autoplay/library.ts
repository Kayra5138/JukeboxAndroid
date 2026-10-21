/**
 * Songs from the library like the ones just listened to.
 *
 * Pure: handed the library already read, the history already counted and the
 * seed already chosen, it answers with tracks. Where those come from, and how
 * often they are read again, is `data.ts`'s; when any of it is asked for is
 * `controller.ts`'s.
 *
 * A candidate earns its place from five things, each weighted by how much the
 * seed song it is measured against counts — the one playing most, the two
 * before it less:
 *
 *  - the tags it shares with the seed, each by how rare it is in the library
 *    (`suggest.ts`'s idea: two songs sharing `rock` have said nothing, two
 *    sharing `shoegaze` have nearly said who they are);
 *  - the people on it: the same artist, the record's own artist, somebody
 *    either credits as a guest;
 *  - having been played straight after the seed, or straight before it, in
 *    one sitting — which is what somebody's own sense of "goes with" looks like
 *    in the history;
 *  - Discover's word that the two artists are near each other, where it has
 *    one: its catalogue lists say which of somebody's artists led to which;
 *  - and, faintly, the same genre and the same few years, for a library that
 *    has no tags and no history to say anything better.
 *
 * Then less for a song that is usually skipped, and much less for one that was
 * in the last batch, so that two batches in a row are never the same batch.
 */

/** A library track as it is measured: everything about it here is folded already. */
export type Candidate = {
  id: string;
  /** The first name of its credit, folded: who it is filed under. Empty where it names nobody. */
  lead: string;
  /** Every name on it, folded: the credit's, the record's own artist, the guests its title names. */
  names: readonly string[];
  /** The record's own artist, folded, or empty. */
  albumArtist: string;
  tags: readonly string[];
  /** Folded, or null. */
  genre: string | null;
  year: number | null;
};

/** A song the batch is to be like, and how much it counts, from nought to one. */
export type Seed = { candidate: Candidate; weight: number };

export type Context = {
  /** How rare each tag is across the library: log(tracks / (1 + tracks with it)). A tag missing here says nothing. */
  idf: ReadonlyMap<string, number>;
  /** How often each track was played next to [id] in one sitting, by track. */
  together: (id: string) => ReadonlyMap<string, number> | undefined;
  /** How near Discover says two artists are, from nought to one, by folded name both ways round. */
  near: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** How reliably each track is walked out on, from nought to one. Absent where there is not enough to say. */
  skipRate: ReadonlyMap<string, number>;
};

/** The same artist, as the one the record is filed under: the strongest single thing two songs can share. */
export const SAME_ARTIST = 2.5;
/** Somebody both songs credit, but not as who they are filed under: a guest, a duet, the record's own artist. */
export const SHARED_NAME = 1.2;
/** Played beside each other in one sitting: worth this at three times or more, and in proportion below. */
export const TOGETHER = 1.5;
export const TOGETHER_FULL = 3;
/** Discover's nearness between the two artists, at its nearest. */
export const NEAR = 1;
/** The same genre, and a year within [YEARS], for a library with nothing better to go on. */
export const SAME_GENRE = 0.6;
export const CLOSE_YEAR = 0.25;
export const YEARS = 3;
/** How much of its score a song that is always skipped can lose. As `suggest.ts` has it. */
export const SKIP_PENALTY = 0.6;
/** What a song in the batch before keeps of its score. */
export const AGAIN = 0.3;

/**
 * Every candidate's score against the seeds, best first, with nothing that
 * scores nothing.
 *
 * The seeds are folded into one profile first — a weight for each tag, each
 * name, each neighbour — so that the library is gone through once however many
 * seeds there are.
 */
export function scoreLibrary(
  candidates: readonly Candidate[],
  seeds: readonly Seed[],
  context: Context,
  excluded: ReadonlySet<string>,
  lastBatch: ReadonlySet<string> = new Set()
): { candidate: Candidate; score: number }[] {
  const tagWeight = new Map<string, number>();
  const leadWeight = new Map<string, number>();
  const nameWeight = new Map<string, number>();
  const togetherWeight = new Map<string, number>();
  const nearWeight = new Map<string, number>();
  const genreWeight = new Map<string, number>();
  const years: { year: number; weight: number }[] = [];
  const bump = (map: Map<string, number>, key: string, by: number) => {
    if (key) map.set(key, (map.get(key) ?? 0) + by);
  };

  for (const { candidate: seed, weight } of seeds) {
    if (!(weight > 0)) continue;
    for (const tag of new Set(seed.tags)) {
      const rarity = context.idf.get(tag) ?? 0;
      if (rarity > 0) bump(tagWeight, tag, weight * rarity);
    }
    bump(leadWeight, seed.lead, weight);
    for (const name of new Set([...seed.names, seed.albumArtist])) bump(nameWeight, name, weight);
    for (const [id, times] of context.together(seed.id) ?? []) {
      bump(togetherWeight, id, weight * Math.min(1, times / TOGETHER_FULL));
    }
    for (const name of seed.names) {
      for (const [other, nearness] of context.near.get(name) ?? []) bump(nearWeight, other, weight * nearness);
    }
    if (seed.genre) bump(genreWeight, seed.genre, weight);
    if (seed.year != null) years.push({ year: seed.year, weight });
  }

  const scored: { candidate: Candidate; score: number }[] = [];
  for (const candidate of candidates) {
    if (excluded.has(candidate.id)) continue;

    let tags = 0;
    for (const tag of new Set(candidate.tags)) tags += tagWeight.get(tag) ?? 0;
    // Divided by the root of how many tags it has, as in `suggest.ts`: otherwise the best-described songs win by having more chances.
    tags /= Math.sqrt(Math.max(1, candidate.tags.length));

    const lead = candidate.lead ? (leadWeight.get(candidate.lead) ?? 0) : 0;
    let shared = 0;
    for (const name of new Set([...candidate.names, candidate.albumArtist])) shared = Math.max(shared, nameWeight.get(name) ?? 0);
    // The same artist and a shared name are mostly the same fact; only what the second adds beyond the first counts.
    const people = SAME_ARTIST * lead + SHARED_NAME * Math.max(0, shared - lead);

    const together = TOGETHER * (togetherWeight.get(candidate.id) ?? 0);

    let near = 0;
    for (const name of candidate.names) near = Math.max(near, nearWeight.get(name) ?? 0);

    const genre = candidate.genre ? SAME_GENRE * (genreWeight.get(candidate.genre) ?? 0) : 0;
    let era = 0;
    if (candidate.year != null) {
      for (const { year, weight } of years) if (Math.abs(year - candidate.year) <= YEARS) era += CLOSE_YEAR * weight;
    }

    let score = tags + people + together + NEAR * near + genre + era;
    if (!(score > 0)) continue;
    score *= 1 - SKIP_PENALTY * (context.skipRate.get(candidate.id) ?? 0);
    if (lastBatch.has(candidate.id)) score *= AGAIN;
    if (score > 0) scored.push({ candidate, score });
  }

  return scored.sort(
    (left, right) =>
      right.score - left.score || (left.candidate.id < right.candidate.id ? -1 : left.candidate.id > right.candidate.id ? 1 : 0)
  );
}

/** How many of the best candidates a batch is drawn from. Wide enough that a batch is not the same eight every time; narrow enough that it stays near. */
export const DRAW_FROM = 30;

/**
 * A batch of [count], drawn from the best [DRAW_FROM] by chance in proportion
 * to score.
 *
 * Never two by one artist in a row, counting the song the batch follows
 * ([after]); never more than a quarter of the batch by one artist. Where those
 * cannot both be kept the batch comes out short rather than breaking them: the
 * next top-up is a few songs away and will have other seeds.
 */
export function drawBatch(
  scored: readonly { candidate: Candidate; score: number }[],
  count: number,
  after: string | null,
  random: () => number
): Candidate[] {
  const pool = scored.slice(0, DRAW_FROM).map((entry) => ({ ...entry }));
  const perArtist = Math.max(2, Math.ceil(count / 4));
  const byArtist = new Map<string, number>();
  const out: Candidate[] = [];
  let last = after;
  while (out.length < count && pool.length) {
    const open = pool.filter(
      ({ candidate }) => !candidate.lead || (candidate.lead !== last && (byArtist.get(candidate.lead) ?? 0) < perArtist)
    );
    if (!open.length) break;
    const total = open.reduce((sum, entry) => sum + entry.score, 0);
    let ticket = random() * total;
    let chosen = open[open.length - 1]!;
    for (const entry of open) {
      ticket -= entry.score;
      if (ticket < 0) {
        chosen = entry;
        break;
      }
    }
    pool.splice(pool.indexOf(chosen), 1);
    out.push(chosen.candidate);
    const lead = chosen.candidate.lead;
    if (lead) byArtist.set(lead, (byArtist.get(lead) ?? 0) + 1);
    last = lead || null;
  }
  return out;
}

/**
 * How much each of the last few songs counts as a seed, the one playing first.
 *
 * The one playing is most of what the batch should be like. The two before it
 * keep the batch from swinging on one song somebody let play through; the ones
 * still to come before the batch count a little, since the batch will follow
 * straight on from them.
 */
export const SEED_WEIGHTS = { current: 1, before: [0.6, 0.35], after: 0.4, afterCount: 3 } as const;

/**
 * Which songs of the queue the batch is to be like, with how much each counts.
 *
 * Picked songs count as seeds like any other, which is how a long run of them
 * drifts, gently, the way a radio does.
 */
export function seedsOf<T extends { id: string }>(queue: readonly T[], currentIndex: number): { track: T; weight: number }[] {
  const seeds: { track: T; weight: number }[] = [];
  const at = (index: number, weight: number) => {
    const track = queue[index];
    if (track && !seeds.some((seed) => seed.track.id === track.id)) seeds.push({ track, weight });
  };
  at(currentIndex, SEED_WEIGHTS.current);
  SEED_WEIGHTS.before.forEach((weight, back) => at(currentIndex - 1 - back, weight));
  for (let ahead = 1; ahead <= SEED_WEIGHTS.afterCount; ahead++) at(currentIndex + ahead, SEED_WEIGHTS.after);
  return seeds;
}
