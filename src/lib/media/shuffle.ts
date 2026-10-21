import { foldForMatch } from '../metadata/text.ts';

/** Fisher-Yates, so "play this tag" is a genuinely different order each time. */
export function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * How far a track may wander from its share of the list, as a fraction of the
 * gap between one of its artist's tracks and the next.
 *
 * Without it the spread is a lattice: an artist with six tracks in a sixty
 * track queue lands on every tenth row, every time, and a shuffle you can
 * predict is not one. Kept under a half so the wandering cannot reorder the
 * evenly spaced positions — the spacing is the point, and this only blurs it.
 */
const WANDER = 0.4;

/** Below this there is nothing to spread; the plain shuffle is the answer. */
const WORTH_SPREADING = 3;

/**
 * A shuffle that keeps one artist from clumping.
 *
 * A fair shuffle puts three tracks by the same artist in a row far more often
 * than people expect it to, and reads as broken when it does — which is why
 * Spotify stopped using one. The fix is theirs: rather than shuffling the
 * queue, shuffle each artist's own tracks and then deal them out evenly across
 * the whole length, each artist starting at a random point of their own. An
 * artist with four tracks in a hundred gets one every twenty-five rows or so,
 * wherever those rows happen to fall, and two of them landing together stops
 * being something chance can arrange.
 *
 * The spread is laid round a circle and not along a line, and the list starts
 * wherever on the circle chance says. Along a line it went wrong at the ends:
 * a track's small wander could carry it past the start, which only an artist
 * with one track has room to do, so that nine in ten shuffles began with one
 * of them and an artist with fifty tracks nearly never did. Round a circle
 * nothing is past the start, and starting anywhere makes every track as
 * likely as every other to be the one that plays first — which is the first
 * thing anybody notices about a shuffle.
 *
 * One pass to group, one shuffle per group, one sort. Nothing looks at any
 * other track, nothing is measured twice, and there is no pass that tries to
 * improve on the result — this runs on the press, every press, on whatever the
 * queue happens to be.
 *
 * @param startAfter What is already playing, so the first track dealt is not by
 *   the same artist as the one it follows. The spread has no way of knowing
 *   about a track that is not in the list.
 */
export function spreadShuffle<T>(
  items: T[],
  keyOf: (item: T) => string,
  startAfter?: string
): T[] {
  if (items.length < WORTH_SPREADING) return shuffled(items);

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  /*
    Positions run over 0 to 1 rather than over the list's length, so an artist's
    spacing is worked out from how many tracks they have and nothing else. The
    list's length never enters into it; the sort at the end is what turns these
    back into rows.
  */
  const dealt: { at: number; item: T }[] = [];
  for (const group of groups.values()) {
    const order = shuffled(group);
    const gap = 1 / order.length;
    // Where this artist's run begins. Random within one gap, so two artists
    // with the same number of tracks do not march in step.
    const start = Math.random() * gap;
    for (let i = 0; i < order.length; i += 1) {
      const at = start + i * gap + (Math.random() - 0.5) * gap * WANDER;
      // Round the circle: past one end is the other, not beyond the list.
      dealt.push({ at: ((at % 1) + 1) % 1, item: order[i]! });
    }
  }

  dealt.sort((a, b) => a.at - b.at);
  // Begun anywhere on the circle. The order round it is kept, so is the spacing.
  const from = Math.floor(Math.random() * dealt.length);
  const result = [...dealt.slice(from), ...dealt.slice(0, from)].map((entry) => entry.item);

  /*
    The one thing the spread cannot see. Everything in the list was placed
    against everything else in it, but the track this list is being dealt after
    is not in it — so the join is the one place two of an artist's tracks can
    still end up touching. Swapped with the nearest one that is by somebody
    else, which moves a single row rather than dealing again.
  */
  if (startAfter != null && result.length > 1 && keyOf(result[0]!) === startAfter) {
    const clear = result.findIndex((item) => keyOf(item) !== startAfter);
    if (clear > 0) [result[0], result[clear]] = [result[clear]!, result[0]!];
  }

  return result;
}

/**
 * What counts as the same artist.
 *
 * Folded, because `AURORA` and `Aurora` are one artist to everybody except a
 * string comparison, and a queue that spreads them separately is a queue that
 * plays them together. Anything without an artist joins one group and is
 * spread like any other — a folder of untagged files is still better off not
 * playing in the order it was read in.
 */
export function artistKey(track: { artist?: string | null }): string {
  return foldForMatch(track.artist ?? '');
}
