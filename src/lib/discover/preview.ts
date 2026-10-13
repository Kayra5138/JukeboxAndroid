import { splitCredit } from '../metadata/credit.ts';
import { foldForMatch } from '../metadata/text.ts';
import type { DeezerTrack } from './deezer.ts';
import { SHOP_ID, isShopSong } from './songs.ts';

/**
 * Which thirty seconds go with a song.
 *
 * A song that is tapped and not yet on the phone takes some seconds to
 * fetch, and for those seconds there was nothing to hear. Deezer serves
 * thirty seconds of nearly every track to anybody, as an MP3 that starts the
 * moment it is asked for. So the tap is answered with that, and the song
 * takes over when it is in.
 *
 * What has to be got right is that it is the same song, and that is all this
 * file is: the asking is `deezer.ts`'s and the playing is the phone's.
 * Thirty seconds of the wrong recording — the live take, the cover, another
 * song of the same name — followed by the right one from the start would be
 * worse than the silence it replaced. So where it cannot be told, there is
 * no preview and the tap is as it always was.
 */

/** The number Deezer knows a song by, for a song that came from Deezer; null for any other. */
export function shopTrackOf(songId: string): number | null {
  if (!isShopSong(songId)) return null;
  const hex = songId.slice(SHOP_ID.length);
  if (!/^[0-9a-f]{1,12}$/i.test(hex)) return null;
  const track = Number.parseInt(hex, 16);
  return Number.isSafeInteger(track) && track > 0 ? track : null;
}

/** What is typed into Deezer's search for a song known by its name. */
export function previewQuery(song: { artist: string; title: string }): string {
  const lead = splitCredit(song.artist)[0] ?? song.artist;
  return `${lead} ${song.title}`.replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** How far a track's length may be from the song's and still be the same recording. A live take or an edit is rarely this near. */
export const SAME_LENGTH_SEC = 4;

/**
 * The track of [tracks] that is [song], or null where none certainly is.
 *
 * The same title, letter for letter once folded — with or without whatever
 * the track carries in brackets, since the catalogue the song came from and
 * Deezer do not agree on where a subtitle goes. The same artist: the one the
 * track is filed under has to be one of the names in the song's credit, or
 * the whole of it. And the same length, within a few seconds, wherever the
 * song's is known; where it is not, a track that says it is a version of
 * something — live, remix, a remaster — is not taken on trust.
 *
 * The first that passes, in the order Deezer gave them, which is its best
 * match first.
 */
export function pickPreview(
  song: { artist: string; title: string; durationSec?: number | null },
  tracks: readonly DeezerTrack[]
): DeezerTrack | null {
  const title = foldForMatch(song.title);
  const credit = foldForMatch(song.artist);
  const names = new Set([credit, ...splitCredit(song.artist).map(foldForMatch)].filter(Boolean));
  if (!title || !names.size) return null;
  for (const track of tracks) {
    if (!track.preview) continue;
    const full = foldForMatch(track.title);
    const short = foldForMatch(track.short);
    if (full !== title && short !== title) continue;
    if (!names.has(foldForMatch(track.artistName))) continue;
    if (song.durationSec && track.durationSec) {
      if (Math.abs(song.durationSec - track.durationSec) > SAME_LENGTH_SEC) continue;
    } else if (full !== title || track.version) {
      // No length to hold it to, and it is some version of the song: not sure enough.
      continue;
    }
    return track;
  }
  return null;
}

/**
 * Whether [address] is one a preview is served from: `https`, on one of
 * Deezer's preview hosts. The phone holds it to the same before it plays
 * anything (`PreviewSource.kt`), and is the one that counts; this is so that
 * an address that will be refused there is not sent at all.
 */
export function isPreviewAddress(address: string | null | undefined): address is string {
  if (!address || address.length > 2000) return false;
  return /^https:\/\/cdn[a-z]?-preview(-[0-9a-f]{1,2})?\.dzcdn\.net\//i.test(address);
}
