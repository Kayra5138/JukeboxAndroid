import JukeboxAudio from '../../../modules/jukebox-audio';
import { strings } from '../i18n/languages.ts';

/**
 * Sending songs to another app with Android's share sheet: a chat, a mail,
 * a phone nearby.
 *
 * Only a file of the phone's library can go, by the media store's address
 * for it; the native side passes on leave to read it to the one app chosen.
 * A file of the app's own, or one another app lent it for a moment, has no
 * such address, and is not offered.
 */

/** Whether this track's file is one that can be shared, on a build that can share. */
export function canShare(track: { uri: string }): boolean {
  return JukeboxAudio.shareTracksAsync != null && track.uri.startsWith('content://');
}

/**
 * Offers the tracks' files to the app the user picks, as sounds or, where
 * [asFile], as files. Throws, in words meant for a person, when none of them
 * could be offered.
 */
export async function shareTracks(tracks: readonly { uri: string }[], asFile = false): Promise<void> {
  const uris = tracks.filter(canShare).map((track) => track.uri);
  const said = strings().common;
  if (uris.length === 0 || !JukeboxAudio.shareTracksAsync) throw new Error(said.shareFailed);
  // As a sound, which a chat plays where it is, or as a file, which it keeps as a document: see `TrackShare.kt`.
  if (!(await JukeboxAudio.shareTracksAsync(uris, said.shareWith, asFile))) throw new Error(said.shareFailed);
}
