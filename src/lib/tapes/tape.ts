import { libraryState } from '../library/index.ts';
import { libraryRoot } from '../media/library.ts';
import { isTapeFolder } from './rule.ts';

/**
 * Whether a track is a tape: in the Tapes folder of the library folder. See
 * `rule.ts`.
 *
 * Asked of every row drawn and every track a list is filtered by, so the
 * library folder is not read from the settings each time: it is read again
 * after a moment, which is more than often enough for a setting changed a few
 * times in the life of an install.
 */
let root: string | null = null;
let readAt = 0;
const FRESH_MS = 2_000;

function rootNow(): string {
  const now = Date.now();
  if (root == null || now - readAt > FRESH_MS) {
    try {
      root = libraryRoot();
    } catch {
      root = root ?? 'Music';
    }
    readAt = now;
  }
  return root;
}

export function isTape(track: { folder?: string | null }): boolean {
  return isTapeFolder(track.folder, rootNow());
}

/**
 * [trackIds] without the tapes among them, by the library as it is held.
 * A tape is in no list and is nobody's favourite: a book or an episode is
 * carried on with where it was left, not gathered with songs.
 */
export function withoutTapes(trackIds: readonly string[]): string[] {
  const library = libraryState();
  if (library.kind !== 'library') return [...trackIds];
  const tapes = new Set(library.tracks.filter((track) => isTape(track)).map((track) => track.id));
  return tapes.size === 0 ? [...trackIds] : trackIds.filter((id) => !tapes.has(id));
}
