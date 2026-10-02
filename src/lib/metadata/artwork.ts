import type { Track } from '../types.ts';
import type { TrackMetadata } from '../db/metadata.ts';
import { isAbortError, isNetworkError, statusOf } from './http.ts';

type ArtworkStore = {
  metadata: Map<string, TrackMetadata>;
  lookup: (track: Track, signal?: AbortSignal) => Promise<{ artworkUrl: string | null; album: string | null } | null>;
  download: (url: string) => Promise<string>;
  save: (trackId: string, uri: string, album: string | null) => void;
};

/** Backfill older MusicBrainz matches as well as newly looked-up tracks. */
export async function fillArtwork(tracks: Track[], store: ArtworkStore,
  progress: (done: number, total: number) => void, signal?: AbortSignal): Promise<number> {
  const pending = tracks.filter((track) => {
    const metadata = store.metadata.get(track.id);
    return metadata && metadata.status !== 'not_found' && !metadata.artworkUrl?.startsWith('file://');
  });
  let saved = 0;
  for (const [index, track] of pending.entries()) {
    if (signal?.aborted) break;
    progress(index, pending.length);
    const metadata = store.metadata.get(track.id)!;
    try {
      const match = metadata.artworkUrl
        ? { artworkUrl: metadata.artworkUrl, album: metadata.album }
        : await store.lookup({ ...track, title: metadata.title ?? track.title, artist: metadata.artist ?? track.artist }, signal);
      if (signal?.aborted) break;
      if (!match?.artworkUrl) continue;
      const uri = await store.download(match.artworkUrl);
      if (signal?.aborted) break;
      store.save(track.id, uri, match.album);
      saved += 1;
    } catch (error) {
      // A missing cover never invalidates a good metadata match. Leave it for
      // the next pass; stop early on offline/rate-limit rather than hammering it.
      const status = statusOf(error);
      if (signal?.aborted || isAbortError(error) || isNetworkError(error) || status === 403 || status === 429 || (status != null && status >= 500)) break;
    }
  }
  return saved;
}
