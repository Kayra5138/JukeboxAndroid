import JukeboxAudio, { type FolderEntry } from '../../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import type { Track } from '../types.ts';

/**
 * Where the library is read from. Everything below it is included, so new
 * albums appear without any configuration.
 *
 * Selecting by path rather than by the media store's `IS_MUSIC` column is
 * deliberate: WhatsApp marks its voice notes as music, and there are typically
 * thousands of them.
 */
export const DEFAULT_ROOT = 'Music';

export function libraryRoot(): string {
  return readSetting(SETTINGS.libraryRoot) ?? DEFAULT_ROOT;
}

export function setLibraryRoot(root: string): void {
  writeSetting(SETTINGS.libraryRoot, root.replace(/^\/+|\/+$/g, ''));
}

export type LibraryFolder = FolderEntry;

/**
 * Folders holding music, with counts, so the root can be chosen from what is
 * actually there. Always searched from `Music` rather than the current root, so
 * a narrower choice can still be widened again.
 *
 * The counts come back with the folders and busiest first, which is the order
 * the chooser wants: the folder the music is in is the one being looked for,
 * and it is rarely the alphabetically first.
 */
export function listFolders(): Promise<LibraryFolder[]> {
  return JukeboxAudio.queryFoldersAsync(DEFAULT_ROOT);
}

export async function ensureAudioPermission(): Promise<boolean> {
  const existing = await JukeboxAudio.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const requested = await JukeboxAudio.requestPermissionsAsync();
  return requested.granted;
}

let notificationAsked = false;

/**
 * Ask to post the media notification, at most once a process.
 *
 * Not asked at startup, unlike the audio permission: without it the foreground
 * service plays with no controls anywhere, but a dialog in front of an app that
 * has not played anything yet is asking about something the reader has no
 * reason to care about. The call belongs immediately before the first
 * `playQueue` — the last moment before the notification would appear, and the
 * first at which it means anything.
 *
 * Never rejects. A player that refuses to start because a permission probe went
 * wrong is worse than one with no notification.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const existing = await JukeboxAudio.getNotificationPermissionsAsync();
    if (existing.granted) return true;
    if (notificationAsked || !existing.canAskAgain) return false;
    notificationAsked = true;
    const requested = await JukeboxAudio.requestNotificationPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** Every track under the chosen root, already sorted by artist/album/track. */
export async function scanLibrary(): Promise<Track[]> {
  return JukeboxAudio.queryTracksAsync(libraryRoot());
}

/**
 * One track, by media store id. Null when it is not under the current root —
 * which a file imported into a folder the library does not look at will not be,
 * hence the root going along with the id.
 */
export async function findTrack(trackId: string): Promise<Track | null> {
  return JukeboxAudio.queryTrackAsync(trackId, libraryRoot());
}
