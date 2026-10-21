import { decodeLyricsFile, fromBase64 } from './decode.ts';
import { asLyrics, embeddedLyrics, readFolders, siblingFor, writeFolders, type LocalLyrics, type LyricsFolder } from './local.ts';
import { lyricsNative } from './native.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';

/**
 * Reading a track's words from the phone: its own file first, then a `.lrc`
 * beside it. See `local.ts` for the order and the deciding; this is only the
 * asking.
 *
 * Nothing found here goes anywhere but the screen and the app's own database.
 * It is the point of reading it from the phone: a song whose words are on the
 * phone is a song nobody needs to be asked about.
 */

/** The folders granted for `.lrc` files, as the setting keeps them. */
export function readLyricsFolders(): LyricsFolder[] {
  return readFolders(readSetting(SETTINGS.lyricsFolders));
}

export function writeLyricsFolders(folders: readonly LyricsFolder[]): void {
  writeSetting(SETTINGS.lyricsFolders, writeFolders(folders));
}

async function fromFile(trackId: string): Promise<LocalLyrics | null> {
  const said = await lyricsNative?.readEmbeddedAsync(trackId);
  const lyrics = embeddedLyrics(said);
  return lyrics ? { lyrics, source: 'file' } : null;
}

async function fromBeside(trackId: string): Promise<LocalLyrics | null> {
  if (!lyricsNative) return null;
  const folders = readLyricsFolders();
  if (folders.length === 0) return null;

  const siblings = await lyricsNative.siblingsAsync(trackId, folders.map((folder) => folder.uri));
  if (siblings.status !== 'found' || !siblings.name) return null;
  const file = siblingFor(siblings.name, siblings.files ?? []);
  if (!file) return null;

  const encoded = await lyricsNative.readDocumentAsync(file.uri);
  const bytes = encoded == null ? null : fromBase64(encoded);
  const text = bytes ? decodeLyricsFile(bytes) : null;
  const lyrics = text == null ? null : asLyrics(text);
  return lyrics ? { lyrics, source: 'lrc' } : null;
}

/**
 * The words on the phone for a track, or null when there are none.
 *
 * Never throws. Either source failing — a file the media store will not open,
 * a folder whose grant was taken back — is that source having nothing to say,
 * and the other, or LRCLIB, is still asked.
 */
export async function readLocalLyrics(trackId: string): Promise<LocalLyrics | null> {
  try {
    const inFile = await fromFile(trackId);
    if (inFile) return inFile;
  } catch {
    // On to the next.
  }
  try {
    return await fromBeside(trackId);
  } catch {
    return null;
  }
}
