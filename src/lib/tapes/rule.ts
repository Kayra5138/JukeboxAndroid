/**
 * What a tape is: anything in the Tapes folder of the library folder —
 * `Music/Jukebox/Tapes/` and whatever is under it — and nothing else.
 *
 * A place and not a guess. Books, podcasts and long recordings are put there
 * on purpose; anything anywhere else is music and is never taken for a tape,
 * however long it runs or however it is tagged, so the music is never touched
 * by any of what a tape is given: its place kept, kept out of the history and
 * out of the songs the player picks. The player's own rule is the same
 * (`Tapes.kt`).
 *
 * The folder may be called Tapes, or the word for it in any language the app
 * speaks, so that it can be named in the language of whoever made it.
 *
 * Nothing here reads a setting, so it can be tested; `tape.ts` does.
 */

/** The names a tapes folder goes by, compared without case. The player's list is the same. */
export const TAPE_FOLDERS = [
  'tapes',
  'kasetler',
  'kassetten',
  'casetes',
  'cassettes',
  'cassette',
  'fitas',
  'カセット',
  'кассеты',
  '磁带',
] as const;

/** The tapes folder [folder] is in, under the library folder [root], or nothing: folders as the media store writes them, `Music/Jukebox/Tapes/Book/`. */
export function isTapeFolder(folder: string | null | undefined, root: string): boolean {
  if (!folder) return false;
  const base = root.replace(/^\/+|\/+$/g, '').toLocaleLowerCase();
  const path = folder.replace(/^\/+/, '').toLocaleLowerCase();
  const under = base ? (path.startsWith(`${base}/`) ? path.slice(base.length + 1) : null) : path;
  if (under == null) return false;
  const first = under.split('/')[0] ?? '';
  return (TAPE_FOLDERS as readonly string[]).includes(first);
}
