import type { NamedSong } from '../history/import.ts';
import type { ForeignList } from './spotify.ts';

/**
 * Playlists in the XML Apple's Music app writes, on a Mac or in Windows:
 * the whole library (File › Library › Export Library) or one playlist (File
 * › Library › Export Playlist, as XML). Both are a property list -- Apple's
 * dictionaries of `<key>` and value -- with every song once under `Tracks`,
 * by a number, and each playlist under `Playlists` as its name and the
 * numbers of its songs:
 *
 *     <key>Tracks</key><dict>
 *       <key>1201</key><dict><key>Track ID</key><integer>1201</integer>
 *         <key>Name</key><string>Numb</string><key>Artist</key><string>Linkin Park</string>…</dict>
 *     </dict>
 *     <key>Playlists</key><array>
 *       <dict><key>Name</key><string>Road</string>
 *         <key>Playlist Items</key><array><dict><key>Track ID</key><integer>1201</integer></dict></array></dict>
 *     </array>
 *
 * The library itself, the kinds of thing it sorts itself into (Music,
 * Podcasts, Audiobooks…) and the folders playlists are kept in are listed
 * among the playlists as well, and are left out. A song is found by its
 * name, as in Spotify's files (`songFinder`). What the text says, and only
 * that.
 */

type Plist = string | number | boolean | Plist[] | { [key: string]: Plist };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decoded(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

type Open = { kind: 'dict'; value: { [key: string]: Plist }; key: string | null } | { kind: 'array'; value: Plist[] };

/**
 * The value a property list holds, or null when the text is not one. Read
 * a tag at a time rather than by a parser, which React Native does not have:
 * a property list is only ever these dozen tags.
 */
export function readPlist(xml: string): Plist | null {
  const tag = /<(\/?)(dict|array|key|string|integer|real|date|data|true|false)\s*(\/?)>/g;
  const stack: Open[] = [];
  let root: Plist | null = null;
  const put = (value: Plist) => {
    const top = stack[stack.length - 1];
    if (!top) {
      root ??= value;
      return;
    }
    if (top.kind === 'array') top.value.push(value);
    else if (top.key != null) {
      top.value[top.key] = value;
      top.key = null;
    }
  };
  let match: RegExpExecArray | null;
  while ((match = tag.exec(xml)) != null) {
    const [, closing, name, empty] = match;
    if (name === 'true' || name === 'false') {
      if (!closing) put(name === 'true');
      continue;
    }
    if (name === 'dict' || name === 'array') {
      if (empty) put(name === 'dict' ? {} : []);
      else if (!closing) stack.push(name === 'dict' ? { kind: 'dict', value: {}, key: null } : { kind: 'array', value: [] });
      else {
        const done = stack.pop();
        if (!done) return null;
        put(done.value);
      }
      continue;
    }
    if (closing) continue;
    if (empty) {
      put(name === 'integer' || name === 'real' ? 0 : '');
      continue;
    }
    // A leaf: everything up to its closing tag.
    const end = xml.indexOf(`</${name}>`, tag.lastIndex);
    if (end < 0) return null;
    const inner = decoded(xml.slice(tag.lastIndex, end));
    tag.lastIndex = end + name!.length + 3;
    if (name === 'key') {
      const top = stack[stack.length - 1];
      if (top?.kind === 'dict') top.key = inner;
    } else if (name === 'integer' || name === 'real') put(Number(inner));
    else put(inner);
  }
  return root;
}

const isDict = (value: Plist | null | undefined): value is { [key: string]: Plist } =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const text = (value: Plist | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/** The playlists in Apple's XML, or null when the text is not that. */
export function readAppleXml(contents: string): ForeignList[] | null {
  const head = contents.slice(0, 2000);
  if (!/<plist[\s>]/.test(head)) return null;
  const plist = readPlist(contents);
  if (!isDict(plist) || !isDict(plist.Tracks) || !Array.isArray(plist.Playlists)) return null;

  const songs = new Map<string, NamedSong>();
  for (const [id, track] of Object.entries(plist.Tracks)) {
    if (!isDict(track)) continue;
    const title = text(track.Name);
    // A video or a podcast's episode is not a song.
    if (!title || track.Podcast === true || track['Has Video'] === true || track['TV Show'] === true) continue;
    songs.set(id, { title, artist: text(track.Artist) ?? text(track['Album Artist']), album: text(track.Album) });
  }

  const lists: ForeignList[] = [];
  for (const playlist of plist.Playlists) {
    if (!isDict(playlist)) continue;
    // The library itself, what it sorts itself into, and a folder of playlists.
    if (playlist.Master === true || playlist['Distinguished Kind'] != null || playlist.Folder === true) continue;
    if (playlist.Visible === false) continue;
    const items = Array.isArray(playlist['Playlist Items']) ? playlist['Playlist Items'] : [];
    const found = items.flatMap((item) => {
      if (!isDict(item)) return [];
      const song = songs.get(String(item['Track ID']));
      return song ? [song] : [];
    });
    if (found.length > 0) lists.push({ name: text(playlist.Name) ?? '', items: found });
  }
  return lists;
}
