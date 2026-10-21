import { nameOfFile as nameOf } from '../library/copies.ts';
import { withoutPackaging } from '../metadata/credit.ts';
import { foldForMatch } from '../metadata/text.ts';

/** A name as it is compared: folded, and without what a video's title says about the upload. */
const keyOf = (name: string) => foldForMatch(withoutPackaging(name));

/**
 * Which of some videos the library already has a file of.
 *
 * The queue knows a video is here by having fetched it: a finished job says
 * so. A file that came another way — downloaded on a computer with yt-dlp
 * and copied over, or fetched by a version of the app from before the queue
 * kept its jobs — leaves no job, and importing a playlist fetched every one
 * of those again: a library with fifty-five songs twice.
 *
 * So the library is asked as well, two ways:
 *
 *  - by the video's id in the file's name, `Title [dQw4w9WgXcQ].mp3`, which
 *    is how yt-dlp names what it saves unless told otherwise;
 *  - by the video's title against the file's name or the track's title,
 *    folded the way the library compares names, with the lengths within a
 *    few seconds of each other — the length is what keeps a live version or
 *    a cover from being taken for the song. Where two files fit, they are
 *    the same song twice already, and the first stands for it: a third copy
 *    is the one thing not wanted.
 */

export type OwnedVideo = { id: string; title: string; duration: number | null };
export type OwnedTrack = { id: string; title: string; filename: string | null; durationSec: number };

/** How far apart two lengths may be, in seconds, and be the same recording. */
const LENGTH_SLACK = 3;


/** The id between brackets at the end of a file's name, where yt-dlp puts it. */
function idIn(filename: string): string | null {
  return /\[([A-Za-z0-9_-]{11})\](?:\.[^.]+)?$/.exec(filename)?.[1] ?? null;
}

/** For each video the library has, the track that is it. */
export function ownedVideos(videos: readonly OwnedVideo[], tracks: readonly OwnedTrack[]): Map<string, string> {
  const byId = new Map<string, string>();
  const byName = new Map<string, OwnedTrack[]>();
  const file = (key: string, track: OwnedTrack) => {
    if (!key) return;
    const held = byName.get(key);
    if (held) {
      if (!held.includes(track)) held.push(track);
    } else byName.set(key, [track]);
  };
  for (const track of tracks) {
    if (track.filename) {
      const id = idIn(track.filename);
      if (id) byId.set(id, track.id);
      file(foldForMatch(nameOf(track.filename)), track);
      file(keyOf(nameOf(track.filename)), track);
    }
    file(foldForMatch(track.title), track);
    file(keyOf(track.title), track);
  }

  const owned = new Map<string, string>();
  for (const video of videos) {
    const named = byId.get(video.id);
    if (named) {
      owned.set(video.id, named);
      continue;
    }
    if (video.duration == null || video.duration <= 0) continue;
    const alike = [...new Set([...(byName.get(foldForMatch(video.title)) ?? []), ...(byName.get(keyOf(video.title)) ?? [])])].filter(
      (track) => track.durationSec > 0 && Math.abs(track.durationSec - (video.duration as number)) <= LENGTH_SLACK
    );
    if (alike.length > 0) owned.set(video.id, alike[0].id);
  }
  return owned;
}
