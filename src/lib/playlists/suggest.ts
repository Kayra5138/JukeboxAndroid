/**
 * What else belongs in a list, judged from what is already in it.
 *
 * The tags do the work. A list is a set of choices somebody made, and the tags
 * on those choices are the nearest thing to a statement of why — so the shape
 * of the list is read off them, and tracks with the same shape are put forward.
 *
 * The one idea worth stating is that **tags are not equally informative**. Half
 * the library is tagged `rock`, so two tracks sharing it have told you almost
 * nothing; three tracks in the library are tagged `shoegaze`, so sharing that
 * is nearly an identification. Weighting by how rare a tag is across the
 * library is the difference between suggestions that feel pointed and
 * suggestions that are just the biggest genre back again.
 *
 * Pure, and separate from where the numbers come from, so the judgement can be
 * checked against a made-up library rather than against whatever happens to be
 * on the phone.
 */

export type Candidate = {
  trackId: string;
  tags: string[];
  artist: string | null;
  /** How many times it has been started. */
  plays: number;
  /** How many of those ran to the end. */
  completed: number;
};

export type Suggestion = {
  trackId: string;
  score: number;
  /** The tags that earned it the place, strongest first. */
  reasons: string[];
};

/** An artist already in the list counts for something, but not for much. */
const ARTIST_BOOST = 1.25;

/** How much of its score a track you always skip can lose. */
const SKIP_PENALTY = 0.6;

/** Below this there is not enough history to call anything a habit. */
const HABIT_PLAYS = 3;

/** How many tags are named as the reason. More than two stops being a reason. */
const REASONS = 2;

export function suggestForPlaylist({
  members,
  candidates,
  libraryTagCounts,
  libraryTotal,
  limit = 10,
}: {
  /** The tracks the list already holds. */
  members: Candidate[];
  /** Everything else worth considering. */
  candidates: Candidate[];
  /** How many tracks in the whole library carry each tag. */
  libraryTagCounts: Map<string, number>;
  libraryTotal: number;
  limit?: number;
}): Suggestion[] {
  // An empty list says nothing about what belongs in it, and a suggestion made
  // from nothing would just be the library in whatever order it came back.
  if (members.length === 0 || libraryTotal === 0) return [];

  const weights = profileOf(members, libraryTagCounts, libraryTotal);
  if (weights.size === 0) return [];

  const artists = new Set(
    members.map((member) => normalise(member.artist)).filter((name) => name.length > 0)
  );
  const held = new Set(members.map((member) => member.trackId));

  const scored: Suggestion[] = [];
  for (const candidate of candidates) {
    if (held.has(candidate.trackId)) continue;

    const matched = candidate.tags
      .map((tag) => ({ tag, weight: weights.get(tag) ?? 0 }))
      .filter((entry) => entry.weight > 0)
      .sort((left, right) => right.weight - left.weight);

    if (matched.length === 0) continue;

    /*
      Divided by the square root of how many tags the track carries. Without
      it a track tagged twenty things outscores a track tagged the three that
      matter, purely by having more chances to match — and the library's
      best-described tracks would fill every list.
    */
    let score =
      matched.reduce((sum, entry) => sum + entry.weight, 0) /
      Math.sqrt(Math.max(1, candidate.tags.length));

    if (artists.has(normalise(candidate.artist))) score *= ARTIST_BOOST;
    score *= 1 - SKIP_PENALTY * skipRate(candidate);

    if (score <= 0) continue;
    scored.push({
      trackId: candidate.trackId,
      score,
      reasons: matched.slice(0, REASONS).map((entry) => entry.tag),
    });
  }

  return scored
    // Ties broken by id so the same library gives the same list twice. A
    // suggestion panel that reshuffles on every visit reads as noise.
    .sort((left, right) => right.score - left.score || left.trackId.localeCompare(right.trackId))
    .slice(0, limit);
}

/**
 * How much each tag says about this particular list.
 *
 * Two parts multiplied: how much of the list carries the tag, and how unusual
 * the tag is in the library. A tag on every track in the list but also on
 * every track in the library describes the library, not the list.
 */
function profileOf(
  members: Candidate[],
  libraryTagCounts: Map<string, number>,
  libraryTotal: number
): Map<string, number> {
  const inList = new Map<string, number>();
  for (const member of members) {
    // Counted once per track however many times the track repeats it.
    for (const tag of new Set(member.tags)) {
      inList.set(tag, (inList.get(tag) ?? 0) + 1);
    }
  }

  const weights = new Map<string, number>();
  for (const [tag, count] of inList) {
    const across = libraryTagCounts.get(tag) ?? count;
    // Zero or less for a tag carried by everything, which is then dropped
    // rather than allowed to add a constant to every candidate alike.
    const rarity = Math.log(libraryTotal / (1 + across));
    if (rarity <= 0) continue;

    const share = count / members.length;
    weights.set(tag, share * rarity);
  }
  return weights;
}

/**
 * How reliably a track gets skipped, between nothing and all the time.
 *
 * Zero until there is enough history to mean anything: one abandoned play is
 * a phone call, not a verdict.
 */
function skipRate(candidate: Candidate): number {
  if (candidate.plays < HABIT_PLAYS) return 0;
  const finished = Math.min(candidate.completed, candidate.plays);
  return 1 - finished / candidate.plays;
}

function normalise(name: string | null): string {
  return (name ?? '').trim().toLowerCase();
}
