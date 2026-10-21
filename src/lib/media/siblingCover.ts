import { albumKey } from './albums.ts';
import { scanLibrary } from './library.ts';
import { readAllMetadata, readSharedCovers } from '../db/metadata.ts';
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
 * The record is the album and its album artist as they stand in the fields,
 * and [artist] the track's own artist, which a record known only by its name
 * has to share with most of it (see `covers.ts`).
 *
 * Null for a record nobody named, and for one none of whose tracks has a cover.
 */
export async function recordCover(
  album: string | null,
  albumArtist: string | null,
  artist: string | null,
  exceptTrackId: string
): Promise<string | null> {
  if (!album?.trim()) return null;
  const key = albumKey(album, albumArtist);
  const library = await scanLibrary();
  return coverIndex(
    library.filter((track) => track.id !== exceptTrackId),
    readAllMetadata(),
    readSharedCovers()
  ).pick(key, artist);
}
