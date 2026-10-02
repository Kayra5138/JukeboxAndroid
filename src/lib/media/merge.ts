import { mergeMetadata, type EnrichedTrack } from './enriched.ts';
import { readAllMetadata } from '../db/metadata.ts';
import { allTags } from '../db/tags.ts';
import type { Track } from '../types.ts';

export type { EnrichedTrack };

/**
 * The merge, with the real database behind it.
 *
 * The precedence rules are in `enriched.ts` and take their tables as an
 * argument; this is the only place they are the SQLite ones. Splitting them was
 * what made the three-way ordering between the file, a lookup and a typed
 * correction testable, which for the code deciding what the library shows is
 * the part that most needed testing.
 */
export function withMetadata(tracks: Track[]): EnrichedTrack[] {
  return mergeMetadata(tracks, { readAllMetadata, allTags });
}
