import { folderPath } from '../../library/hiding.ts';

/**
 * Writing a list out as an M3U playlist, and naming what is written.
 *
 * Always `.m3u8`: UTF-8, which every player that reads playlists at all has
 * understood for fifteen years, and which is the only way a title in Turkish,
 * Russian or Japanese comes out the other side as it went in. The extended
 * form, with an `#EXTINF` for each entry, because it costs a line and is what
 * lets another player -- or this one, reading the file back on a phone where
 * the music is somewhere else -- find a song whose path no longer fits.
 */

/**
 * How each entry names its file.
 *
 *  - `phone`: the whole path on the phone, `/storage/emulated/0/Music/...`,
 *    which is what other Android players look for wherever the playlist is
 *    put. The default, because a playlist saved through the system's "save
 *    as" can end up anywhere, and nothing the app is told says where; a path
 *    relative to the playlist would be right in one folder and wrong in all
 *    the others.
 *  - `library`: the path from the library folder down, `Nirvana/Nevermind/
 *    Lithium.mp3`, for a copy of the same music on a computer. Put the file
 *    at the top of that folder and foobar2000, MusicBee or VLC find every
 *    song in it, whatever the drive is called.
 */
export type PathStyle = 'phone' | 'library';
export const PATH_STYLES: readonly PathStyle[] = ['phone', 'library'];

export function parsePathStyle(words: string | null): PathStyle {
  return words === 'library' ? 'library' : 'phone';
}

/** The phone's own storage, where the media store does not say a song is somewhere else. */
export const PRIMARY_STORAGE = '/storage/emulated/0';

/** A track as an entry is written from. */
export type WrittenTrack = {
  filename: string | null;
  folder: string | null;
  title: string | null;
  artist: string | null;
  durationSec: number;
  /** The whole path, where the native side could say it: the one way to name a song on a card rightly. */
  path?: string | null;
};

/**
 * Where [track] is, in [style]; null for a track the style cannot name, which
 * is one with no file name, or one outside the library folder when paths are
 * from the library folder.
 */
export function entryPath(track: WrittenTrack, style: PathStyle, root: string): string | null {
  if (!track.filename) return null;
  const relative = [folderPath(track.folder ?? ''), track.filename].filter(Boolean).join('/');
  if (style === 'phone') return track.path || `${PRIMARY_STORAGE}/${relative}`;
  const base = folderPath(root);
  if (!base) return relative;
  if (!relative.toLowerCase().startsWith(`${base.toLowerCase()}/`)) return null;
  return relative.slice(base.length + 1);
}

/** Anything that would end a line or start a directive, which no part of one may contain. */
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

/**
 * The playlist's text.
 *
 * `#PLAYLIST:` carries the name, which VLC reads and which brings the list
 * back under its own name when the file is imported here again, however the
 * file was renamed on the way. Lengths are whole seconds, as Winamp wrote
 * them and as some readers insist; a length the media store did not know is
 * written as -1, which is how the format says "unknown".
 */
export function writeM3u(name: string, entries: readonly { track: WrittenTrack; path: string }[]): string {
  const lines = ['#EXTM3U', `#PLAYLIST:${oneLine(name)}`];
  for (const { track, path } of entries) {
    const seconds = track.durationSec > 0 ? Math.round(track.durationSec) : -1;
    const title = oneLine(track.title ?? '') || oneLine(track.filename ?? '');
    const artist = oneLine(track.artist ?? '');
    lines.push(`#EXTINF:${seconds},${artist ? `${artist} - ${title}` : title}`);
    lines.push(oneLine(path));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * A list's name as a file name, the same on a phone, a card and a PC.
 *
 * What FAT, which most memory cards are, and Windows will not have in a name
 * is changed for a dash, as are the characters that would break the line in
 * a listing; dots and spaces at either end go, as Windows drops them anyway.
 * Kept short enough that the ending still fits on any of them.
 */
export function fileNameFor(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 120)
    .replace(/[\s.]+$/g, '');
  return `${cleaned || fallback}.m3u8`;
}

/**
 * File names for several lists going into one folder, none of them the same
 * as another by any casing: the second `Mix` is `Mix (2)`. A card's file
 * system does not tell `mix` from `Mix`, so neither does this.
 */
export function fileNamesFor(names: readonly string[], fallback: string): string[] {
  const taken = new Set<string>();
  return names.map((name) => {
    const first = fileNameFor(name, fallback);
    const bare = first.slice(0, -'.m3u8'.length);
    let candidate = first;
    for (let count = 2; taken.has(candidate.toLowerCase()); count += 1) candidate = `${bare} (${count}).m3u8`;
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

/**
 * A name for a list beside one already called [name]: `Mix (2)`, or the
 * first such number not taken. Compared without case, as the lists tab
 * would be read by a person.
 */
export function freeListName(name: string, taken: readonly string[]): string {
  const held = new Set(taken.map((each) => each.trim().toLowerCase()));
  if (!held.has(name.trim().toLowerCase())) return name.trim();
  let count = 2;
  while (held.has(`${name.trim()} (${count})`.toLowerCase())) count += 1;
  return `${name.trim()} (${count})`;
}

/**
 * The name a playlist file brings a list in under: what it calls itself, or
 * else its file name without the ending, or else [fallback].
 */
export function listNameFor(declared: string | null, fileName: string | null, fallback: string): string {
  const fromFile = (fileName ?? '').replace(/\.(m3u8?|txt)$/i, '').trim();
  return (declared ?? '').trim() || fromFile || fallback;
}

/**
 * The tracks in the order given with each one after its first left out,
 * and how many were left out. A list holds a track once; a playlist may
 * name it as often as it likes.
 */
export function onceEach(trackIds: readonly string[]): { ids: string[]; repeated: number } {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of trackIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ids, repeated: trackIds.length - ids.length };
}
