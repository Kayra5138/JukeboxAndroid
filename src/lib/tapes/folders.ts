/**
 * The folder a tape fetched from somewhere is put in: one for each show,
 * book or list, under the Tapes folder of the library folder, named after it
 * — which is what makes it a tape at all (`rule.ts`), and keeps the parts of
 * one book together.
 */

/** [name] as a folder may be called: without what a path cannot hold, not too long, and never nothing. */
export function folderNameOf(name: string, otherwise = 'Tape'): string {
  const plain = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .trim();
  const short = Array.from(plain).slice(0, 80).join('').trim();
  return short || otherwise;
}

/**
 * What a part of a book fetched from a list is called: its video's title
 * without the list's name in front of it and without its number, which the
 * file is given in front of its name anyway. `Wedding Poems - Full Audiobook
 * 01 - Elegy XX`, of the list `Wedding Poems - Full Audiobook`, is `Elegy XX`.
 * The title as it was where nothing would be left.
 */
export function partTitleOf(title: string, list: string): string {
  let rest = title.trim();
  const name = list.trim();
  if (name && rest.toLowerCase().startsWith(name.toLowerCase())) rest = rest.slice(name.length);
  rest = rest.replace(/^[\s\-–—:|·,.]+/, '').replace(/^(?:part|chapter|bölüm|kapitel|teil)?\s*\d{1,3}\s*[-–—:.)|]\s*/i, '').trim();
  return rest || title.trim();
}

/** The folder, as the media store writes paths, for a tape called [name] in the library at [root]. */
export function tapeFolderOf(root: string, name: string): string {
  const base = root.replace(/^\/+|\/+$/g, '');
  return `${base ? `${base}/` : ''}Tapes/${folderNameOf(name)}`;
}
