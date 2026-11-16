import { isUnder } from './hiding.ts';

/**
 * What can be set aside: one song, a record, an artist, a list, a folder, a tag.
 *
 * Set aside is not left out. A song set aside is in the library as before:
 * on its record, under its artist and its folder, found by a search, in its
 * lists, and played when any of those is played. It is kept out of two
 * things only, the Tracks view and shuffling everything (with what picks
 * songs to keep the music going), which is where a record of a hundred and
 * seventy pieces from a game drowns the rest. Nothing is deleted or moved,
 * and bringing it back is undoing a row.
 */
export type SetAsideKind = 'track' | 'album' | 'artist' | 'list' | 'folder' | 'tag';

export const SET_ASIDE_KINDS: readonly SetAsideKind[] = ['album', 'artist', 'list', 'folder', 'tag', 'track'];

/** Everything set aside, by kind: a song by its id, a record and an artist by their keys, a list by its id, a folder by its path, a tag by its name. */
export type SetAside = Readonly<Record<SetAsideKind, ReadonlySet<string>>>;

export const NOTHING_SET_ASIDE: SetAside = {
  track: new Set(),
  album: new Set(),
  artist: new Set(),
  list: new Set(),
  folder: new Set(),
  tag: new Set(),
};

/** Whether anything at all is set aside, so that a library with nothing set aside costs nothing. */
export function anySetAside(rules: SetAside): boolean {
  return SET_ASIDE_KINDS.some((kind) => rules[kind].size > 0);
}

/** The rows a list of `[kind, key]` makes, as they are read back out of the table. */
export function setAsideOf(rows: readonly { kind: string; key: string }[]): SetAside {
  const out: Record<SetAsideKind, Set<string>> = { track: new Set(), album: new Set(), artist: new Set(), list: new Set(), folder: new Set(), tag: new Set() };
  for (const row of rows) {
    if ((SET_ASIDE_KINDS as readonly string[]).includes(row.kind)) out[row.kind as SetAsideKind].add(row.key);
  }
  return out;
}

/** A group of songs as a screen keys it: a record or an artist. */
type Group = { key: string; tracks: readonly { id: string }[] };

/** A tag as compared: tags are held in one spelling already, and case is never a difference between two. */
const tagOf = (tag: string) => tag.trim().toLowerCase();

/**
 * The ids of the songs among [tracks] that are set aside: each set aside by
 * itself, on a record set aside, by an artist set aside, in a list set aside
 * (whatever the list holds today: a smart list's songs as its rules find
 * them), under a folder set aside (or one inside it), or wearing a tag set
 * aside.
 *
 * Records and artists are asked for only where one is set aside, and are the
 * ones the screens show, keyed as they key them: which record a song is on,
 * and whose name it is filed under, depend on the rest of the library, and
 * are not to be worked out again any differently here.
 */
export function setAsideIds(
  tracks: readonly { id: string; folder?: string | null; tags?: readonly string[] }[],
  rules: SetAside,
  groups: { albums: () => readonly Group[]; artists: () => readonly Group[]; list?: (key: string) => Iterable<string> }
): Set<string> {
  const out = new Set<string>();
  if (!anySetAside(rules)) return out;
  for (const id of rules.track) out.add(id);
  const within = (list: readonly Group[], keys: ReadonlySet<string>) => {
    for (const group of list) {
      if (!keys.has(group.key)) continue;
      for (const track of group.tracks) out.add(track.id);
    }
  };
  if (rules.album.size > 0) within(groups.albums(), rules.album);
  if (rules.artist.size > 0) within(groups.artists(), rules.artist);
  if (groups.list) for (const key of rules.list) for (const id of groups.list(key)) out.add(id);
  const folders = [...rules.folder];
  const tags = new Set([...rules.tag].map(tagOf));
  if (folders.length > 0 || tags.size > 0) {
    for (const track of tracks) {
      if (out.has(track.id)) continue;
      if (folders.some((folder) => isUnder(track.folder, folder)) || (track.tags ?? []).some((tag) => tags.has(tagOf(tag)))) {
        out.add(track.id);
      }
    }
  }
  return out;
}
