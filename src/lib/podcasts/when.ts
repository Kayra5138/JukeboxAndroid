/**
 * Which of a podcast's episodes its screen shows, by when they came out: all
 * of them, the latest few weeks or months, or one year of them; newest or
 * oldest first. Hundreds of episodes are a long way to scroll for either end.
 */

export type When = 'all' | 'week' | 'month' | 'quarter' | `year:${number}`;
export type Order = 'newest' | 'oldest';

const DAY = 24 * 60 * 60 * 1000;
const SPANS = { week: 7 * DAY, month: 31 * DAY, quarter: 92 * DAY } as const;

/** The years [episodes] came out in, latest first, for a chip each. */
export function yearsOf(episodes: readonly { publishedAt: number | null }[]): number[] {
  const years = new Set<number>();
  for (const episode of episodes) if (episode.publishedAt != null) years.add(new Date(episode.publishedAt).getFullYear());
  return [...years].sort((a, b) => b - a);
}

/**
 * [episodes] that came out [when], in [order]. One without a date is in
 * "all" alone: nothing says it is recent, nor of which year.
 */
export function episodesWhen<T extends { publishedAt: number | null }>(
  episodes: readonly T[],
  when: When,
  order: Order,
  now = Date.now()
): T[] {
  const kept =
    when === 'all'
      ? [...episodes]
      : when.startsWith('year:')
        ? episodes.filter((episode) => episode.publishedAt != null && new Date(episode.publishedAt).getFullYear() === Number(when.slice(5)))
        : episodes.filter((episode) => episode.publishedAt != null && episode.publishedAt >= now - SPANS[when as keyof typeof SPANS]);
  // Stable, so episodes of one day keep the feed's own order between them; the undated last either way.
  return kept.sort((a, b) => {
    if (a.publishedAt == null || b.publishedAt == null) return (a.publishedAt == null ? 1 : 0) - (b.publishedAt == null ? 1 : 0);
    return order === 'newest' ? b.publishedAt - a.publishedAt : a.publishedAt - b.publishedAt;
  });
}
