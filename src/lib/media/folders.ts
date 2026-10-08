import type { EnrichedTrack } from './enriched.ts';
import { compareNames, latestOf } from './sort.ts';

/**
 * The library by where its files are kept.
 *
 * For a collection that was filed by hand before anything read its tags, where
 * the folder is the only arrangement that was ever made on purpose. Derived
 * from the tracks, like everything else here — a folder is wherever a track
 * says it is, so there is nothing to scan for and an empty folder, which has
 * nothing to play, never appears.
 */

export type Folder = {
  /** The media store path without its slashes at either end; what a screen is opened with. */
  key: string;
  /** The same place as seen from the library folder, and empty for that folder itself. */
  path: string;
  /** The last step of the path: what the folder is called. */
  name: string;
  /** The tracks directly in it, by filename. */
  tracks: EnrichedTrack[];
};

/**
 * A folder as one spelling, whichever end the slashes were left on.
 *
 * The media store writes `Music/Nirvana/` and the library folder is kept as
 * `Music`; compared as they come, a folder would never be the root it is.
 */
export function folderKey(folder: string): string {
  return folder.replace(/^\/+|\/+$/g, '');
}

/** [key] as seen from [root], or whole where it is somehow not under it. */
function relativeTo(root: string, key: string): string {
  if (!root) return key;
  // Case is not something the media store is careful about in a path, and the
  // query that fetched these tracks was not careful about it either.
  const ours = key.toLowerCase();
  const theirs = root.toLowerCase();
  if (ours === theirs) return '';
  return ours.startsWith(`${theirs}/`) ? key.slice(root.length + 1) : key;
}

/**
 * Two paths in the order a file manager would list them.
 *
 * A step at a time rather than as two strings. Compared whole, the slash is
 * just another character with a place among the punctuation, and `Rock Ballads`
 * files itself between `Rock` and `Rock/Live` — parting a folder from what is
 * in it, which in a flat list is the only thing saying they belong together.
 */
function comparePaths(left: string, right: string): number {
  const ours = left ? left.split('/') : [];
  const theirs = right ? right.split('/') : [];
  const shared = Math.min(ours.length, theirs.length);
  for (let at = 0; at < shared; at += 1) {
    const order = compareNames(ours[at]!, theirs[at]!);
    if (order !== 0) return order;
  }
  return ours.length - theirs.length;
}

/**
 * Groups [tracks] into the folders that directly hold them.
 *
 * Directly: a folder's own files and not those of the folders inside it, each
 * of which is an entry of its own. That is how the folder chooser in Settings
 * counts them, and it is what keeps a track in exactly one place here — the one
 * view of the library where that is true by construction.
 *
 * A track the media store gives no folder for is left out. There is no place to
 * say it is, and a heading for the placeless would be a folder that does not
 * exist; it is still in every other view.
 *
 * @param root the library folder, which the paths are shown relative to.
 *   Passed in rather than read here, so the grouping can be exercised without
 *   the settings behind it.
 */
export function foldersOf(tracks: readonly EnrichedTrack[], root: string): Folder[] {
  const base = folderKey(root);
  const groups = new Map<string, EnrichedTrack[]>();

  for (const track of tracks) {
    const key = folderKey(track.folder ?? '');
    if (!key) continue;
    const held = groups.get(key);
    if (held) held.push(track);
    else groups.set(key, [track]);
  }

  const folders: Folder[] = [];
  for (const [key, members] of groups) {
    folders.push({
      key,
      path: relativeTo(base, key),
      name: key.slice(key.lastIndexOf('/') + 1),
      tracks: members.sort(
        (left, right) =>
          compareNames(left.filename ?? left.title, right.filename ?? right.title) ||
          (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
      ),
    });
  }

  return folders.sort(byPath);
}

function byPath(left: Folder, right: Folder): number {
  return (
    comparePaths(left.path, right.path) || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  );
}

/**
 * What can be asked of a list of folders: where they are, how much is in them
 * and which of them something has lately been put into.
 *
 * Not how much they are listened to, which is asked of artists. A folder is
 * where files were put, and nobody goes looking for the place they play most.
 */
export type FolderSort = 'name' | 'tracks' | 'added';

export const FOLDER_SORTS = ['name', 'tracks', 'added'] as const;

/** By path for anything the setting does not recognise. */
export function asFolderSort(value: string | null): FolderSort {
  return FOLDER_SORTS.find((order) => order === value) ?? 'name';
}

/** The order a tap lands on, wrapping round. */
export function nextFolderSort(order: FolderSort): FolderSort {
  return FOLDER_SORTS[(FOLDER_SORTS.indexOf(order) + 1) % FOLDER_SORTS.length]!;
}

/**
 * The folders in the order asked for. A copy.
 *
 * `name` is by path, a step at a time, which is the order {@link foldersOf}
 * hands them over in and the one that keeps a folder beside what is in it.
 * `added` is the newest file in the folder, and a folder none of whose files
 * can be dated goes after all that can. A draw is settled by path.
 */
export function sortFolders(folders: readonly Folder[], order: FolderSort): Folder[] {
  if (order === 'name') return [...folders].sort(byPath);

  return folders
    .map((folder) => ({
      folder,
      weight:
        order === 'tracks'
          ? folder.tracks.length
          : latestOf(folder.tracks.map((track) => track.addedAt ?? null)),
    }))
    .sort(
      (left, right) =>
        Number(left.weight == null) - Number(right.weight == null) ||
        (right.weight ?? 0) - (left.weight ?? 0) ||
        byPath(left.folder, right.folder)
    )
    .map((entry) => entry.folder);
}
