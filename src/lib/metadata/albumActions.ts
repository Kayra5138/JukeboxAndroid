import JukeboxAudio from '../../../modules/jukebox-audio';
import { chooseCovers } from '../db/metadata';
import { refreshLibrary } from '../library/index';
import type { Album } from '../media/albums';
import { artworkChanged } from '../media/artworkEvents';
import type { Track } from '../types';
import { startAlbumLookup, type BulkOutcome } from './bulk';

/**
 * The two things that can be done to a whole record's details from wherever
 * the record is shown: its page, the record taken out of the rack, and the
 * menu a record held down opens. Here once, so that the three cannot come to
 * do them differently.
 */

/**
 * Looks [album] up as one record: see `albumLookup.ts`. Null where another
 * lookup is already under way, which the run that is going says for itself.
 */
export function lookUpRecord(album: Album, library?: Track[]): Promise<BulkOutcome | null> {
  return startAlbumLookup(
    {
      key: album.key,
      name: album.name,
      // Whoever the record is by, as the library shows it: its album artist,
      // "Various Artists" for a compilation, or the artist most of it is by.
      artist: album.albumArtist ?? album.artist,
      tracks: album.tracks,
    },
    library
  );
}

/**
 * Asks for a picture and puts it on every track of [album], over whatever
 * each wore. Answers how many tracks took it, or null where somebody backed
 * out of the gallery. Throws, with something fit to show, for a picture that
 * would not load.
 *
 * Every track, as one picked for one track goes on that track: somebody chose
 * it for this record, and that is the record's cover from now on — a cover
 * they once took off one of its tracks included.
 */
export function chooseRecordCover(album: Album): Promise<number | null> {
  return chooseCoverFor(album.tracks.map((track) => track.id));
}

/**
 * The same for any tracks somebody chose, a record or not: a selection on the
 * Tags screen or in the library. Every one of them takes the picture, for the
 * reason a record's tracks all do.
 */
export async function chooseCoverFor(trackIds: string[]): Promise<number | null> {
  if (trackIds.length === 0) return 0;
  const picked = await JukeboxAudio.pickImageAsync?.();
  if (!picked) return null;
  const chosen = chooseCovers(trackIds, picked);
  artworkChanged();
  await refreshLibrary();
  return chosen.length;
}
