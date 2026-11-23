import { mergeMetadata, type EnrichedTrack } from './enriched.ts';
import { db } from '../db/index.ts';
import { readAllMetadata, readMetadata, readSharedCovers } from '../db/metadata.ts';
import { allTags, tagsFor } from '../db/tags.ts';
import type { Track } from '../types.ts';
import { scriptNames } from '../ui/scriptNames.ts';

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
  return mergeMetadata(tracks, { readAllMetadata, allTags, readSharedCovers, names: scriptNames });
}

/**
 * The same for one track, from its own rows: for a screen about one song,
 * which read the three whole tables for it.
 */
export function oneWithMetadata(track: Track): EnrichedTrack {
  const id = track.id;
  return mergeMetadata([track], {
    readAllMetadata: () => {
      const row = readMetadata(id);
      return new Map(row ? [[id, row]] : []);
    },
    allTags: () => new Map([[id, tagsFor(id)]]),
    readSharedCovers: () => {
      const row = db().getFirstSync<{ artwork_url: string }>('SELECT artwork_url FROM shared_covers WHERE track_id = ?', id);
      return new Map(row ? [[id, row.artwork_url]] : []);
    },
    names: scriptNames,
  })[0]!;
}
