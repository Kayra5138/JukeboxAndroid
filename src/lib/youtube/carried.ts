import { forBridge } from '../equalizer/bridge.ts';

/**
 * A video as the bridge will carry it to the phone.
 *
 * The phone takes a job's video as a map, and the bridge refuses a map with
 * a null anywhere inside something it holds — not in the map itself, where
 * a video has always had a null for a thumbnail it lacks, but one level
 * down: the place a track is fetched for, with no disc; what to look for,
 * with no length known. The whole call is turned away with "Value is null,
 * expected an Object", which from the screen was a download that failed the
 * moment it was asked for.
 *
 * The phone reads a key that is missing as it reads one that is null, so
 * inside whatever a video holds the nothings are left out. The video's own
 * keys are left as they are, nulls and all: those have always crossed, and
 * what reads a job back expects them.
 */
export function carried<Video extends object>(video: Video): Video {
  const sent: Record<string, unknown> = {};
  for (const [key, held] of Object.entries(video)) {
    sent[key] = held !== null && typeof held === 'object' ? forBridge(held) : held;
  }
  return sent as Video;
}

/**
 * A video without the playlist it was read off.
 *
 * A video read off a playlist says which, and a download that says so is put
 * in the list the app keeps of that playlist. One fetched for another reason
 * — to complete a record — is not being added to anybody's list, and must not
 * join one that happens to have been made of the same playlist.
 */
export function unlisted<Video extends { sourcePlaylist?: unknown }>(
  video: Video
): Omit<Video, 'sourcePlaylist'> {
  const { sourcePlaylist: _from, ...rest } = video;
  return rest;
}
