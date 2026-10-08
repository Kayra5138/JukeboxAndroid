import {
  fillCovers,
  filterUnenriched,
  manualTrackIds,
  markCoverSearched,
  readAllMetadata,
  saveMetadata,
} from '../db/metadata.ts';
import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { artworkChanged } from '../media/artworkEvents.ts';
import { scanLibrary } from '../media/library.ts';
import { saveCredit } from '../db/credits.ts';
import { saveLookupTags } from '../db/tags.ts';
import { isEmbeddedPicture } from './covers.ts';
import { runEnrichment } from './pipeline.ts';
import type { CoverStore, EnrichProgress, EnrichResult } from './pipeline.ts';
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
  { library, onSaved }: EnrichOptions = {}
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
  });
}
