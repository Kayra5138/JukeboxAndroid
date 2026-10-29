import { folderNameOf } from './folders.ts';

/**
 * Sound files chosen on the phone, brought into the Tapes folder by hand.
 * Nothing here reads or copies anything, so it can be tested.
 */

/** A file's name without its ending: `Book - 01.mp3` is `Book - 01`. */
const stemOf = (name: string) => name.replace(/\.[A-Za-z0-9]{1,5}$/, '');

/** What is left of a name once its number and what joins it are taken off either end. */
function bare(text: string): string {
  return text
    .replace(/^[\s\-–—_.:|()[\]0-9]+/, '')
    .replace(/[\s\-–—_.:|()[\]0-9]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

/**
 * The name to offer for the folder the files go in: what their names have in
 * common at the start, numbers and joins taken off — `Book - 01.mp3` and
 * `Book - 02.mp3` are `Book` — or the one file's own name, or nothing.
 */
export function folderNameFor(names: readonly string[]): string {
  // Numbers in front go first, so that `01 Dune` and `02 Dune` are seen to share `Dune`.
  const stems = names.map((name) => bare(stemOf(name))).filter(Boolean);
  if (stems.length === 0) return '';
  let common = stems[0]!;
  for (const stem of stems.slice(1)) {
    let at = 0;
    while (at < common.length && at < stem.length && common[at]!.toLocaleLowerCase() === stem[at]!.toLocaleLowerCase()) at += 1;
    common = common.slice(0, at);
  }
  // Too little in common to be a name: the files are not one thing's parts, and the first one's name is offered.
  const name = bare(common);
  return folderNameOf(name.length >= 3 ? name : stems[0]!, '');
}

/** The files in the order they go, by name, the way their numbers count. */
export function inNameOrder<T extends { name: string }>(files: readonly T[]): T[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
