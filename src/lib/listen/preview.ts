import { pickPreview, previewQuery, isPreviewAddress } from '../discover/preview.ts';
import { previewsOn } from '../discover/policy.ts';
import { readDiscoverSettings } from '../discover/store.ts';
import { searchTracks } from '../discover/deezer.ts';
import { readings } from '../metadata/identify.ts';
import type { Track } from '../types.ts';
import { downloads } from '../youtube/native.ts';
import type { YouTubeVideo } from '../youtube/types.ts';

/**
 * Something to hear while a song listened to is fetched: the thirty seconds
 * Deezer lets anybody play of it, as Discover plays of a song tapped before
 * it is in, and on the same player of its own (`PreviewPlayer`). The song
 * then starts from its beginning when it is in.
 *
 * A YouTube video's name is not a song's, so it is read the ways a name can
 * be (`identify.ts`) and each reading asked of Deezer in turn, the first two
 * at most; a preview is taken only where a track is surely the same
 * recording, of the same length near enough (`pickPreview`). Where none is,
 * the wait is as it was. Off where Discover's previews are turned off.
 */

/** How many readings of a video's name are asked of Deezer. */
const MOST_ASKED = 2;

/** The preview's own name for the player of previews: one at a time, so the same each time. */
const PREVIEW_ID = 'listen';

/**
 * A preview of [video] played while it is fetched, where one is found and
 * [still] says it is still being waited for; [started] is told once it plays.
 * Never throws.
 */
export async function previewWhileWaiting(video: YouTubeVideo, still: () => boolean, started: () => void): Promise<void> {
  try {
    if (!downloads?.previewStartAsync || !previewsOn(readDiscoverSettings())) return;
    const address = await previewOf(video);
    if (!address || !still()) return;
    if (!(await downloads.previewStartAsync(PREVIEW_ID, address))) return;
    // In already in the moment that took, or something else asked for: the preview is let go at once.
    if (!still()) return void stopPreview();
    started();
  } catch (error) {
    console.warn('No preview could be played while the song is fetched', error);
  }
}

/** The preview playing, stopped: the song is in, or is no longer waited for. Never throws. */
export function stopPreview(): Promise<void> {
  return (downloads?.previewStopAsync?.() ?? Promise.resolve()).catch(() => {});
}

/** Deezer's preview of [video], by the readings of its name, or null where none is surely it. */
async function previewOf(video: YouTubeVideo): Promise<string | null> {
  const named = readings({ title: video.title, artist: null } as unknown as Track)
    // A reading with nobody named is taken as the channel's, which is whose a song's official upload is.
    .map((one) => ({ artist: one.artist ?? video.channel ?? '', title: one.title }))
    .filter((one) => one.artist && one.title)
    .slice(0, MOST_ASKED);
  for (const song of named) {
    const tracks = await searchTracks(previewQuery(song));
    /*
      Held to the video's length first; then, since a video is often longer
      or shorter than the record — an introduction, a scene at the end — to
      the same name by the same artist and no version of it, as a song with
      no length to go by is.
    */
    const found = pickPreview({ ...song, durationSec: video.duration }, tracks) ?? pickPreview(song, tracks);
    if (isPreviewAddress(found?.preview)) return found.preview;
  }
  return null;
}
