import type { NamedSong } from '../history/import.ts';

/**
 * Spotify's playlists, as its "Download your data" hands them over.
 *
 * Spotify's own way in, its Web API, is closed to an app like this one: since
 * May 2025 it is opened only to companies with a quarter of a million users
 * a month, and an app short of that may let in five people it names by hand.
 * What anybody can have, without an app of Spotify's in between, is the
 * account's data, asked for on Spotify's privacy page and sent as a zip some
 * days later. The playlists are in it, in `Playlist1.json` (and `Playlist2`
 * and on, for many), and the songs saved with the heart, in
 * `YourLibrary.json`:
 *
 *     { "playlists": [ { "name": "Road", "lastModifiedDate": "2024-05-01",
 *         "items": [ { "track": { "trackName": "Numb", "artistName": "Linkin Park",
 *                                 "albumName": "Meteora", "trackUri": "spotify:track:…" },
 *                      "episode": null, "localTrack": null, "addedDate": "2024-04-30" } ] } ] }
 *
 *     { "tracks": [ { "artist": "Linkin Park", "album": "Meteora", "track": "Numb", "uri": "spotify:track:…" } ] }
 *
 * A playlist's song is named, not pointed at: Spotify's address for it means
 * nothing on a phone, so it is found in the library by its name, as a listen
 * from Spotify's history is (`songFinder`). A file of the phone's own that the
 * playlist held is named in its address instead, `spotify:local:` and the
 * artist, album, title and length. Podcast episodes and audiobooks are not
 * songs and are left out.
 *
 * Nothing here reads a file or the library: what the text says, and only that.
 */

/** One playlist: its name, and its songs in its order. */
export type ForeignList = { name: string; items: NamedSong[] };

/** What a Spotify file held: its playlists, and the songs saved with the heart (`liked`), where it is that file. */
export type SpotifyLists = { lists: ForeignList[]; liked: NamedSong[] | null };

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => value != null && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/** A part of a `spotify:local:` address: written for a web address, a space as `+`. */
function unescaped(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' ')).trim();
  } catch {
    return part.replace(/\+/g, ' ').trim();
  }
}

/** A file of the phone's own, from its address: `spotify:local:Artist:Album:Title:Seconds`. Null where it says no title. */
function localSong(uri: string | null): NamedSong | null {
  if (!uri) return null;
  const match = /^spotify:local:(.*)$/i.exec(uri);
  if (!match) return null;
  const parts = match[1]!.split(':');
  // The length is last, the title before it; a title with a colon in it was written with the colon escaped.
  if (parts.length < 4) return null;
  const [artist, album, title] = parts.slice(-4, -1).map(unescaped);
  if (!title) return null;
  return { title, artist: artist || null, album: album || null };
}

/** A playlist's item, where it is a song: one of Spotify's, or a file of the phone's own. */
function itemSong(item: unknown): NamedSong | null {
  if (!isObject(item)) return null;
  const track = item.track;
  if (isObject(track)) {
    const title = text(track.trackName);
    if (title) return { title, artist: text(track.artistName), album: text(track.albumName) };
  }
  const local = item.localTrack;
  if (isObject(local)) return localSong(text(local.uri));
  return null;
}

/** A song saved with the heart, as `YourLibrary.json` lists it. */
function likedSong(row: unknown): NamedSong | null {
  if (!isObject(row)) return null;
  const title = text(row.track);
  if (!title) return null;
  return { title, artist: text(row.artist), album: text(row.album) };
}

/**
 * What a Spotify file says, or null when it is not one of the two.
 *
 * A playlist with no songs in it, only episodes, say, or nothing at all, is
 * left out: there would be nothing to bring.
 */
export function readSpotifyLists(contents: string): SpotifyLists | null {
  const start = contents.trimStart();
  if (!start.startsWith('{')) return null;
  let json: unknown;
  try {
    json = JSON.parse(start);
  } catch {
    return null;
  }
  if (!isObject(json)) return null;

  if (Array.isArray(json.playlists)) {
    const lists: ForeignList[] = [];
    for (const list of json.playlists) {
      if (!isObject(list) || !Array.isArray(list.items)) continue;
      const items = list.items.map(itemSong).filter((song): song is NamedSong => song != null);
      if (items.length > 0) lists.push({ name: text(list.name) ?? '', items });
    }
    return { lists, liked: null };
  }

  // The library: saved songs, albums, artists and shows together. Only the songs are a list.
  if (Array.isArray(json.tracks) && ('albums' in json || 'artists' in json || 'shows' in json || json.tracks.some(likedSong))) {
    const liked = json.tracks.map(likedSong).filter((song): song is NamedSong => song != null);
    return { lists: [], liked };
  }
  return null;
}
