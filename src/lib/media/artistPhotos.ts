import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { readArtistPhoto, saveArtistPhoto, type ArtistPhoto } from '../db/artistPhotos.ts';
import { lookupArtistPhoto } from '../metadata/artistPhoto.ts';
import { foldForMatch } from '../metadata/text.ts';

export type { ArtistPhoto };

/**
 * Photographs already resolved this run, hits and misses alike.
 *
 * A second layer over the table because the table is the slow half of the
 * answer only once: the recap asks about the same five artists on the chart
 * card and again on the closing one, and a map lookup is the difference between
 * that costing nothing and costing a synchronous query per drawn row.
 */
const found = new Map<string, ArtistPhoto | null>();

/**
 * The photograph for an artist, found once and kept.
 *
 * The same shape as {@link artworkFor}: consult what is already known, and only
 * then go out to the network. The copy on disk is made the way album covers are
 * made — by the native downloader, into the app's own files directory — rather
 * than by a second scheme that would need its own cleanup and its own bugs.
 *
 * Null is an ordinary answer and the common one, so callers fall back to the
 * album cover instead of showing a hole.
 *
 * A request that never arrived is deliberately not written down. Offline is not
 * an answer about the artist, and recording it as one would cost somebody who
 * opened their recap on a train every photograph in it, permanently.
 */
export async function artistPhotoFor(
  name: string,
  signal?: AbortSignal
): Promise<ArtistPhoto | null> {
  const key = foldForMatch(name);
  if (!key) return null;

  const remembered = found.get(key);
  if (remembered !== undefined) return remembered;

  const stored = readArtistPhoto(name);
  if (stored !== undefined) {
    found.set(key, stored);
    return stored;
  }

  // An older native build has no downloader, and a picture that cannot be
  // copied locally is one that cannot be shown at all — the card is captured
  // off screen, where a half-loaded remote image captures as a blank.
  if (!JukeboxAudio.downloadArtworkAsync) return null;

  try {
    const source = await lookupArtistPhoto(name, signal);
    if (!source) {
      remember(key, name, null);
      return null;
    }
    const uri = await JukeboxAudio.downloadArtworkAsync(source.url);
    const photo = { uri, credit: source.credit, licence: source.licence };
    remember(key, name, photo);
    return photo;
  } catch {
    return null;
  }
}

function remember(key: string, name: string, photo: ArtistPhoto | null): void {
  found.set(key, photo);
  saveArtistPhoto(name, photo);
}
