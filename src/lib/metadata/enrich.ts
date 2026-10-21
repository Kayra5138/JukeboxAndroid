import {
  chooseCovers,
  fillCovers,
  filterUnenriched,
  forgetMetadata,
  manualTrackIds,
  markCoverSearched,
  readAllMetadata,
  readSharedCovers,
  saveMetadata,
} from '../db/metadata.ts';
import { lookUpAlbumRest } from '../album/index.ts';
import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { artworkChanged } from '../media/artworkEvents.ts';
import { scanLibrary } from '../media/library.ts';
import { saveCredit } from '../db/credits.ts';
import { saveLookupTags } from '../db/tags.ts';
import { lookUpAlbum, type AlbumToLookUp } from './albumLookup.ts';
import { isEmbeddedPicture } from './covers.ts';
import { searchAlbumCover } from './itunes.ts';
import { recordGenres } from './musicbrainz.ts';
import { runEnrichment } from './pipeline.ts';
import type { CoverStore, EnrichProgress, EnrichResult, RunMode } from './pipeline.ts';
import type { Track } from '../types.ts';

export type { EnrichProgress, EnrichResult };

export type EnrichOptions = {
  /**
   * The whole library, where whoever is asking already has it.
   *
   * A cover is taken from a track's neighbours on its record before it is
   * searched for, and the neighbours are mostly not among the tracks being
   * looked up. Left out, the library is read for the purpose.
   */
  library?: Track[];
  /**
   * Told which tracks have just had something written for them, as it happens
   * and not at the end, so that a list on screen can show the first results
   * while the rest are still being asked about.
   */
  onSaved?: (trackIds: string[]) => void;
  /** Everything, or covers alone: see `RunMode`. */
  mode?: RunMode;
};

/**
 * Enrichment, with the real database behind it.
 *
 * The loop itself is in `pipeline.ts` and takes its tables as an argument; this
 * is the only place they are the SQLite ones. Splitting them was what made the
 * loop's failure handling testable, which for code whose whole job is deciding
 * what a failed request means is the part that most needed testing.
 */
export async function enrichLibrary(
  tracks: Track[],
  onProgress: (progress: EnrichProgress) => void,
  signal?: AbortSignal,
  { library, onSaved, mode }: EnrichOptions = {}
): Promise<EnrichResult> {
  const download = JukeboxAudio.downloadArtworkAsync;
  // Without somewhere to keep a picture there are no covers to deal in, and
  // the run is the lookups alone.
  const covers: CoverStore | undefined = download
    ? {
        readAllMetadata,
        library: () => library ?? scanLibrary(),
        download: (url) => download(url),
        fillCovers: (fills) => {
          const filled = fillCovers(fills);
          if (filled.length > 0) {
            // Once for the cover and not once for each track it went onto:
            // every picture on screen asks again when this is said.
            artworkChanged();
            onSaved?.(filled);
          }
          return filled;
        },
        markCoverSearched,
        readSharedCovers,
        hasOwnPicture: async (trackId) =>
          isEmbeddedPicture(await JukeboxAudio.getEmbeddedArtworkAsync(trackId)),
      }
    : undefined;

  return runEnrichment(tracks, onProgress, signal, {
    filterUnenriched,
    manualTrackIds,
    saveMetadata: (entry) => {
      saveMetadata(entry);
      onSaved?.([entry.trackId]);
    },
    saveLookupTags,
    saveCredit,
    covers,
  }, undefined, mode);
}

/**
 * One record looked up as a whole (`albumLookup.ts`), with the real
 * catalogues, the real database and the real phone behind it. What is not on
 * the record's list is looked up by {@link enrichLibrary}, the ordinary way.
 */
export async function enrichAlbum(
  album: AlbumToLookUp,
  onProgress: (progress: EnrichProgress) => void,
  signal?: AbortSignal,
  options: EnrichOptions = {}
): Promise<EnrichResult> {
  const download = JukeboxAudio.downloadArtworkAsync;
  return lookUpAlbum(album, onProgress, signal, {
    release: (asked, stop) => lookUpAlbumRest(asked, stop),
    genres: recordGenres,
    cover: async (name, artist, tracks, stop) =>
      download ? searchAlbumCover(name, artist, tracks, stop) : null,
    download: (url) => {
      if (!download) throw new Error('No covers on this build.');
      return download(url);
    },
    pictures: async (trackIds) => {
      if (JukeboxAudio.embeddedPicturesAsync) {
        const said = await JukeboxAudio.embeddedPicturesAsync(trackIds, true);
        return new Map(trackIds.map((id) => [id, said[id] ?? null]));
      }
      const answers = new Map<string, boolean>();
      for (const id of trackIds) {
        answers.set(id, isEmbeddedPicture(await JukeboxAudio.getEmbeddedArtworkAsync(id).catch(() => null)));
      }
      return answers;
    },
    readAllMetadata,
    saveMetadata: (entry) => {
      saveMetadata(entry);
      options.onSaved?.([entry.trackId]);
    },
    saveLookupTags,
    chooseCovers: (trackIds, uri, keep) => {
      const chosen = chooseCovers(trackIds, uri, keep);
      if (chosen.length > 0) {
        artworkChanged();
        options.onSaved?.(chosen);
      }
      return chosen;
    },
    forgetMetadata: (trackIds) => forgetMetadata(trackIds),
    lookUpEach: (tracks, progress, stop) => enrichLibrary(tracks, progress, stop, options),
  });
}
