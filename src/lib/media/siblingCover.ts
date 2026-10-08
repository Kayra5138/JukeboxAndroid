import { albumKey } from './albums.ts';
import { scanLibrary } from './library.ts';
import { readAllMetadata } from '../db/metadata.ts';
import { coverIndex } from '../metadata/covers.ts';

/**
 * The cover the other tracks of a record already have, with the real library
 * and the real database behind it.
 *
 * For the one place that asks about a record by name rather than about a track
 * as it is stored: the details screen, where the album is whatever is in the
 * field at that moment, typed or just found, and nothing has been saved yet.
 * The rules are the ones in `metadata/covers.ts`. The track itself is left out
 * of the count, so that its own cover is never what it is offered.
 *
 * Null for a record nobody named, and for one none of whose tracks has a cover.
 */
export async function recordCover(album: string | null, exceptTrackId: string): Promise<string | null> {
  const key = albumKey(album ?? '');
  if (key === '') return null;
  const library = await scanLibrary();
  return coverIndex(
    library.filter((track) => track.id !== exceptTrackId),
    readAllMetadata()
  ).pick(key);
}
