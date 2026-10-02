import { filterUnenriched, manualTrackIds, saveMetadata, readAllMetadata, saveArtwork } from '../db/metadata.ts';
import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { fillArtwork } from './artwork.ts';
import { lookupTrack } from './itunes.ts';
import { artworkChanged } from '../media/artworkEvents.ts';
import { saveLookupTags } from '../db/tags.ts';
import { runEnrichment } from './pipeline.ts';
import type { EnrichProgress, EnrichResult } from './pipeline.ts';
import type { Track } from '../types.ts';

export type { EnrichProgress, EnrichResult };

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
  signal?: AbortSignal
): Promise<EnrichResult> {
  const result = await runEnrichment(tracks, onProgress, signal, {
    filterUnenriched,
    manualTrackIds,
    saveMetadata,
    saveLookupTags,
  });
  if (result.cancelled || result.stopped || signal?.aborted || !JukeboxAudio.downloadArtworkAsync) return result;
  const coversSaved = await fillArtwork(tracks, {
    metadata: readAllMetadata(),
    lookup: lookupTrack,
    download: (url) => JukeboxAudio.downloadArtworkAsync!(url),
    save: (id, uri, album) => { saveArtwork(id, uri, album); artworkChanged(); },
  }, (done, total) => onProgress({ done, total, matched: result.matched, throttled: false, phase: 'artwork' }), signal);
  return { ...result, coversSaved, cancelled: signal?.aborted ?? false };
}
