import { foldForMatch } from '../metadata/text.ts';
import type { EnrichedTrack } from './enriched.ts';

export type SearchResult = {
  tracks: EnrichedTrack[];
  /**
   * Tags the query names outright. Offered as a whole listening session rather
   * than a filtered list — asking for "gothic" usually means wanting to hear
   * gothic, not to read about it.
   */
  matchedTags: string[];
};

/**
 * Matches titles, artists, albums and tags in one box.
 *
 * Folded rather than compared directly, so `simarik` finds `Şımarık`. That
 * folding is ASCII on purpose — Turkish casing rules turn `INDIE` into `ındıe`,
 * which matches nothing.
 */
export function search(tracks: EnrichedTrack[], query: string): SearchResult {
  const needle = foldForMatch(query);
  if (!needle) return { tracks, matchedTags: [] };

  const matchedTags = new Set<string>();
  const matches = tracks.filter((track) => {
    const tagHit = track.tags.filter((tag) => foldForMatch(tag).includes(needle));
    tagHit.forEach((tag) => matchedTags.add(tag));

    return (
      tagHit.length > 0 ||
      foldForMatch(track.title).includes(needle) ||
      foldForMatch(track.artist ?? '').includes(needle) ||
      foldForMatch(track.album ?? '').includes(needle)
    );
  });

  return {
    tracks: matches,
    // Exact names first: typing "rock" should offer "rock" before "post-rock".
    matchedTags: [...matchedTags].sort(
      (a, b) => Number(foldForMatch(b) === needle) - Number(foldForMatch(a) === needle) || a.localeCompare(b)
    ),
  };
}
