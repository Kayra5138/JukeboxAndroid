import JukeboxAudio, { type FolderEntry } from '../../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { recogniseLater } from '../identity/index.ts';
import {
  hidingRule,
  leftOutUnder,
  parseLeftOut,
  parseShortest,
  shownTracks,
  type Hiding,
  type Shortest,
} from '../library/hiding.ts';
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

/**
 * The folders under the library folder somebody has switched off, as whole
 * paths. Kept across a change of library folder, and applied only to the
 * ones inside it: see `leftOutUnder` in `library/hiding.ts`.
 */
export function leftOutFolders(): string[] {
  return parseLeftOut(readSetting(SETTINGS.libraryLeftOut));
}

export function setLeftOutFolders(folders: readonly string[]): void {
  writeSetting(SETTINGS.libraryLeftOut, JSON.stringify(folders));
}

/** How many folders are left out of the library as it is now: what Settings says of them. */
export function leftOutCount(): number {
  return leftOutUnder(leftOutFolders(), libraryRoot()).length;
}

/**
 * How short a file has to be to be left out, in seconds, or nought for not
 * at all, which is where every install starts: a song that is not shown
 * looks like a song lost, and voice notes are better left out by somebody
 * who has seen them there.
 */
export function shortestFiles(): Shortest {
  return parseShortest(readSetting(SETTINGS.libraryShortest)) ?? 0;
}

export function setShortestFiles(seconds: Shortest): void {
  writeSetting(SETTINGS.libraryShortest, String(seconds));
}

/**
 * What the library leaves out at this moment, or null where it leaves out
 * nothing. Read afresh each time: it is two rows of the settings table.
 */
export function libraryHiding(): Hiding | null {
  return hidingRule({ root: libraryRoot(), leftOut: leftOutFolders(), shortest: shortestFiles() });
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

/**
 * The folders under [root] that hold music, each with how many tracks are
 * directly in it: what the screen that leaves folders out is made from. One
 * column of the media store, read once, which is cheap enough to ask on every
 * visit to that screen.
 */
export function listFoldersUnder(root: string): Promise<LibraryFolder[]> {
  return JukeboxAudio.queryFoldersAsync(root);
}

/**
 * Whether the app may read audio, without asking.
 *
 * For work that is not somebody's tap — Discover looking over its list as the
 * app opens, or behind the screen — which must not put a dialog up, and which
 * has to tell a library it may not read yet from one with nothing in it: the
 * media store answers both with no rows.
 */
export async function hasAudioPermission(): Promise<boolean> {
  return (await JukeboxAudio.getPermissionsAsync()).granted;
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

/**
 * Every track in the library, already sorted by artist/album/track: what is
 * under the chosen root, less what is left out of it ({@link libraryHiding}).
 *
 * Each scan is also shown to whatever keeps a song's history with the song
 * when its file is given a new id. Here rather than in the screens, so that no
 * way of reading the library can leave it out; and after the tracks have been
 * handed back, so that no screen waits on it. It is shown the whole folder,
 * left-out files too: a file that is only not being shown has not gone, and
 * must not have its history handed to something else.
 */
export async function scanLibrary(): Promise<Track[]> {
  return shownTracks(await scanEverything(), libraryHiding());
}

/**
 * Every track under the chosen root, what is left out of the library too.
 *
 * For whatever keeps the user's own record of their tracks rather than
 * showing them a library: a backup, which has to be able to name every track
 * a play or a tag belongs to, and the names sent with a listen. A folder
 * switched off for a while has not stopped being theirs.
 */
export async function scanEverything(): Promise<Track[]> {
  return scanUnder(libraryRoot());
}

/**
 * The same, of a folder the caller names. For the one reader that has to know
 * afterwards which folder its answer was about: `lib/library`, which holds the
 * library for the screens and must not hold one folder's under another's name.
 */
export async function scanUnder(root: string): Promise<Track[]> {
  const read = await JukeboxAudio.queryTracksAsync(root);
  // A native side from before the album artist was read sends no such field.
  // Said as nothing here, so that a track read by it is the same track as the
  // one written down for the next start, which always carries the field.
  const tracks =
    read.length > 0 && !('albumArtist' in read[0]!)
      ? read.map((track) => ({ ...track, albumArtist: null }))
      : read;
  recogniseLater(tracks);
  return tracks;
}

/**
 * Whether the library under [root] is as it was, said without reading it: a
 * short string that is the same for as long as a scan would be. Null when
 * there is no saying — the media store would not answer, or the native half
 * of the app is older than the question — and then it has to be scanned.
 */
export async function libraryStamp(root: string): Promise<string | null> {
  if (!JukeboxAudio.libraryStampAsync) return null;
  return JukeboxAudio.libraryStampAsync(root);
}

/**
 * One track, by media store id. Null when it is not under the current root —
 * which a file imported into a folder the library does not look at will not be,
 * hence the root going along with the id.
 */
export async function findTrack(trackId: string): Promise<Track | null> {
  return JukeboxAudio.queryTrackAsync(trackId, libraryRoot());
}
