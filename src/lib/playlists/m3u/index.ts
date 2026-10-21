import { fromBase64 } from '../../lyrics/decode.ts';
import type { AutoListId } from '../../db/autoLists.ts';
import { autoListTrackIds } from '../../db/autoLists.ts';
import { readSetting, SETTINGS, writeSetting } from '../../db/index.ts';
import {
  addToPlaylist,
  createPlaylist,
  playlist,
  playlists,
  playlistTrackIds,
  setPlaylistTracks,
} from '../../db/playlists.ts';
import { trackIdsWithTag } from '../../db/tags.ts';
import { libraryRoot, scanEverything } from '../../media/library.ts';
import { withMetadata } from '../../media/merge.ts';
import { readings } from './decode.ts';
import { foundCount, indexLibrary, matchEntries, type EntryResult, type ListTrack } from './match.ts';
import { listsNative, type PickedListFile } from './native.ts';
import { looksLikePlaylist, parseM3u } from './parse.ts';
import { placeOfDocument } from './paths.ts';
import {
  entryPath,
  fileNamesFor,
  listNameFor,
  onceEach,
  parsePathStyle,
  PRIMARY_STORAGE,
  writeM3u,
  type PathStyle,
  type WrittenTrack,
} from './write.ts';

export type { PathStyle } from './write.ts';
export type { EntryResult } from './match.ts';

/**
 * Lists as M3U files: the errands. Asking the phone for files and the
 * library, the database for lists, in order. What a file says, which song an
 * entry means and what is written are decided in the files beside this one,
 * where they are tested without any of the three.
 */

/** Whether this build can read and write playlist files at all. */
export const listFilesAvailable = (): boolean => listsNative != null;

export function pathStyle(): PathStyle {
  return parsePathStyle(readSetting(SETTINGS.listFilePaths));
}

export function setPathStyle(style: PathStyle): void {
  writeSetting(SETTINGS.listFilePaths, style);
}

type Library = {
  tracks: (ListTrack & WrittenTrack)[];
  byId: Map<string, ListTrack & WrittenTrack>;
};

/**
 * Every track under the library folder, left-out ones too, with the names
 * the app shows and the file's own as well, and the whole path of each where
 * the phone will say it.
 *
 * Left-out tracks too, both ways. A list keeps a track somebody has hidden
 * from the library, and a file of it written out should name that track as
 * the list does; and a playlist brought in names files, which are no less
 * there for being left out of what the library shows.
 */
async function wholeLibrary(): Promise<Library> {
  const root = libraryRoot();
  const [raw, located] = await Promise.all([
    scanEverything(),
    listsNative?.trackPathsAsync(root).catch(() => null) ?? Promise.resolve(null),
  ]);
  const primary = located?.primary?.replace(/\/+$/, '') || PRIMARY_STORAGE;
  const files = new Map(raw.map((track) => [track.id, track]));
  const tracks = withMetadata(raw).map((track) => {
    const file = files.get(track.id);
    const relative = [track.folder ?? '', track.filename ?? ''].join('').replace(/^\/+/, '');
    return {
      ...track,
      // Where the media store would not give a whole path, the phone's own
      // storage under the name this phone gives it.
      path: located?.paths[track.id] ?? (primary === PRIMARY_STORAGE ? null : `${primary}/${relative}`),
      aliases: file ? [{ title: file.title, artist: file.artist }] : [],
    };
  });
  return { tracks, byId: new Map(tracks.map((track) => [track.id, track])) };
}

// ---- bringing playlists in ----

export type Prepared =
  | {
      kind: 'ready';
      /** The file's name, as the picker gave it. */
      file: string;
      /** The name the list would have. */
      name: string;
      results: EntryResult[];
      /** Which reading of the file was taken; see `decode.ts`. */
      encoding: string;
    }
  | { kind: 'problem'; file: string; problem: 'tooBig' | 'unreadable' | 'empty' };

/** Lets the user pick playlists. Empty when they backed out. */
export async function chooseListFiles(): Promise<PickedListFile[]> {
  return (await listsNative?.pickListFilesAsync()) ?? [];
}

/**
 * Reads each picked playlist against the library, without changing
 * anything yet.
 *
 * Of the ways a file can be read, the one kept is the one that finds the
 * most songs; see `decode.ts` for why that is the judge.
 */
export async function prepareListFiles(picked: PickedListFile[], untitled: string): Promise<Prepared[]> {
  if (picked.length === 0) return [];
  const library = await wholeLibrary();
  const index = indexLibrary(library.tracks);

  return picked.map((one): Prepared => {
    const file = one.name ?? untitled;
    if (one.problem || one.bytes == null) {
      return { kind: 'problem', file, problem: one.problem === 'tooBig' ? 'tooBig' : 'unreadable' };
    }
    const bytes = fromBase64(one.bytes);
    const ways = bytes ? readings(bytes) : [];
    if (ways.length === 0) return { kind: 'problem', file, problem: 'unreadable' };

    if (!looksLikePlaylist(ways[0]!.text, parseM3u(ways[0]!.text))) return { kind: 'problem', file, problem: 'unreadable' };
    const folder = placeOfDocument(one);
    let best: { name: string | null; results: EntryResult[]; encoding: string } | null = null;
    for (const way of ways) {
      const document = parseM3u(way.text);
      const results = matchEntries(document.entries, index, folder);
      if (!best || foundCount(results) > foundCount(best.results)) {
        best = { name: document.name, results, encoding: way.encoding };
      }
    }
    if (!best || best.results.length === 0) return { kind: 'problem', file, problem: 'empty' };
    return {
      kind: 'ready',
      file,
      name: listNameFor(best.name, one.name, untitled),
      results: best.results,
      encoding: best.encoding,
    };
  });
}

/** The list already called [name], by any casing, or null. */
export function listNamed(name: string): { id: number; name: string } | null {
  const wanted = name.trim().toLowerCase();
  const found = playlists().find((list) => list.name.trim().toLowerCase() === wanted);
  return found ? { id: found.id, name: found.name } : null;
}

/** Every list's name, for finding one that is free. */
export function listNames(): string[] {
  return playlists().map((list) => list.name);
}

export type Imported = {
  listId: number;
  name: string;
  /** Entries in the file. */
  total: number;
  /** Entries found in the library, repeats included. */
  found: number;
  /** Entries found that were a track already named earlier in the file, and so are in the list once. */
  repeated: number;
  /** The entries not found, and why. */
  missing: EntryResult[];
};

/**
 * Writes a prepared playlist into the lists: as a new list called [as.name],
 * or in place of what list [as.listId] held.
 *
 * In the file's order. A track the file names twice is in the list once, at
 * the first place it was named; a list holds each track once, and two rows
 * of one track would be two rows that move and are taken off together.
 */
export function bringIn(prepared: Extract<Prepared, { kind: 'ready' }>, as: { name: string } | { listId: number }): Imported {
  const now = Date.now();
  const found = prepared.results.flatMap((result) => (result.trackId ? [result.trackId] : []));
  const { ids, repeated } = onceEach(found);
  let listId: number;
  let name: string;
  if ('listId' in as) {
    listId = as.listId;
    name = playlist(as.listId)?.name ?? prepared.name;
    setPlaylistTracks(listId, ids, now);
  } else {
    name = as.name;
    listId = createPlaylist(as.name, now);
    addToPlaylist(listId, ids, now);
  }
  return {
    listId,
    name,
    total: prepared.results.length,
    found: found.length,
    repeated,
    missing: prepared.results.filter((result) => result.trackId == null),
  };
}

// ---- writing lists out ----

export type ListSource = { kind: 'list'; id: number } | { kind: 'auto'; id: AutoListId; name: string };

/**
 * What a list holds, by id, in its order: what was put in it, or what
 * carries its tag in the library's order, or what an auto list finds today.
 * Members that are hidden from the library are in it: they are files, and
 * the list has them.
 */
function memberIds(source: ListSource, library: Library): { name: string; ids: string[] } | null {
  if (source.kind === 'auto') return { name: source.name, ids: autoListTrackIds(source.id, Date.now()) };
  const details = playlist(source.id);
  if (!details) return null;
  if (details.tag) {
    const tagged = new Set(trackIdsWithTag(details.tag));
    return { name: details.name, ids: library.tracks.filter((track) => tagged.has(track.id)).map((track) => track.id) };
  }
  return { name: details.name, ids: playlistTrackIds(source.id) };
}

/** A list's playlist text, and how many of its members could not be written: gone, or outside the library folder. */
function written(name: string, ids: string[], library: Library, style: PathStyle): { text: string; left: number } {
  const root = libraryRoot();
  const entries: { track: WrittenTrack; path: string }[] = [];
  let left = 0;
  for (const id of ids) {
    const track = library.byId.get(id);
    const path = track ? entryPath(track, style, root) : null;
    if (track && path) entries.push({ track, path });
    else left += 1;
  }
  return { text: writeM3u(name, entries), left };
}

/**
 * Writes one list where the user chooses. `saved` is false when they backed
 * out of choosing, which is not a failure; anything that goes wrong writing
 * is thrown.
 */
export async function exportList(
  source: ListSource,
  style: PathStyle,
  untitled: string
): Promise<{ saved: boolean; name: string; written: number; left: number }> {
  const native = listsNative;
  if (!native) return { saved: false, name: '', written: 0, left: 0 };
  const library = await wholeLibrary();
  const members = memberIds(source, library);
  if (!members) return { saved: false, name: '', written: 0, left: 0 };
  const { text, left } = written(members.name, members.ids, library, style);
  const [fileName] = fileNamesFor([members.name], untitled);
  const saved = await native.saveListFileAsync(fileName!, text);
  return { saved, name: members.name, written: members.ids.length - left, left };
}

/**
 * Writes every list the user made into a folder they choose, one file each.
 * Null when they backed out of choosing.
 *
 * Their own lists, followed tags included, and not the ones made from
 * listening: those are a question asked again every day rather than a list
 * anybody keeps, and each can be written out from its own page.
 */
export async function exportAllLists(
  style: PathStyle,
  untitled: string
): Promise<{ written: number; failed: string[]; folder: string; left: number } | null> {
  const native = listsNative;
  if (!native) return null;
  const library = await wholeLibrary();
  const all = playlists();
  const names = fileNamesFor(all.map((list) => list.name), untitled);
  const texts: string[] = [];
  let left = 0;
  for (const list of all) {
    const members = memberIds({ kind: 'list', id: list.id }, library);
    const out = written(list.name, members?.ids ?? [], library, style);
    texts.push(out.text);
    left += out.left;
  }
  const result = await native.saveListFilesAsync(names, texts);
  return result ? { ...result, left } : null;
}
