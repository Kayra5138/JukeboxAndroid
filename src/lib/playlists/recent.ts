/**
 * The order of the list picker: the lists something was last put in, most
 * recent first, kept as a short list of ids in a setting. Nothing here knows
 * about the database, so it can be tested.
 */

/** No more than this many are remembered: past it, the Lists tab's own order is as good. */
const KEPT = 30;

/** The ids a stored setting says, anything unreadable as none. */
export function recentFrom(words: string | null): number[] {
  try {
    const kept: unknown = JSON.parse(words ?? '[]');
    return Array.isArray(kept) ? kept.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

/** [recent] with [id] put first, as the one just used. */
export function usedNow(recent: readonly number[], id: number): number[] {
  return [id, ...recent.filter((one) => one !== id)].slice(0, KEPT);
}

/** [lists] in the order of [recent], and the ones never used after, as they came. */
export function byRecent<T extends { id: number }>(lists: readonly T[], recent: readonly number[]): T[] {
  const rank = new Map(recent.map((id, at) => [id, at]));
  return [...lists].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}
