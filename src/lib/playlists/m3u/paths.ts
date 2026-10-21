/**
 * What an entry in a playlist says about where its file is.
 *
 * The same song is written a dozen ways depending on who wrote the playlist:
 *
 *  - `/storage/emulated/0/Music/Nirvana/Lithium.mp3`: an Android player
 *    (Poweramp, Musicolet), the whole path on the phone.
 *  - `/sdcard/Music/...`, `/storage/self/primary/...`: older names for the
 *    same place, still written by some.
 *  - `/storage/1A2B-3C4D/Music/...`: a memory card, named by its volume id.
 *  - `file:///storage/emulated/0/Music/Nirvana/Lithium%20(Live).mp3`: VLC,
 *    as an address, with anything unusual in it percent-encoded.
 *  - `D:\Music\Nirvana\Lithium.mp3`: foobar2000, MusicBee, Winamp, a PC.
 *  - `..\Nirvana\Lithium.mp3`, `Nirvana/Lithium.mp3`: relative to wherever
 *    the playlist itself was saved.
 *  - `content://media/external/audio/media/1234`: an Android player that
 *    names files by their media store id.
 *  - `https://...`: a stream, which is nothing in the library.
 *
 * The media store keeps a song as a volume and a path from the top of that
 * volume (`Music/Nirvana/`), and that pair is what everything here is turned
 * into where it can be. Where it cannot -- a PC's drive letter says nothing
 * about the phone -- what is kept is the path's steps, so that the end of it
 * can still be compared with the end of a song's.
 *
 * Nothing here reads the phone, so that every spelling can be tested.
 */

/** A place on the phone: which volume, and the path from its top, with no slashes at either end. */
export type Place = {
  /** `primary` for the phone's own storage, a card's volume id in lower case, or null where it cannot be said. */
  volume: string | null;
  path: string;
};

export type Location =
  /** A web address or another kind of stream: nothing a file in the library can be. */
  | { kind: 'web' }
  /** A media store id, as some Android players write an entry. */
  | { kind: 'media'; id: string }
  | {
      kind: 'file';
      /** Volume and path where the entry says enough to know them. */
      place: Place | null;
      /** Every step of the path that is known, the file's name last; for comparing ends. */
      steps: string[];
    };

/** A path as slashes and steps: backslashes turned round, doubled and dotted steps gone. */
function steps(path: string): string[] {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .map((step) => step.normalize('NFC'))
    .filter((step) => step !== '' && step !== '.');
}

/** A card's volume id as Android writes it: `1A2B-3C4D`. */
const VOLUME_ID = /^[0-9a-f]{4}-[0-9a-f]{4}$/i;

/**
 * The volume an absolute path on an Android phone is on, and the path from
 * its top. Null for a path that is not one of the phone's.
 *
 * A card named by something other than its id (`/storage/sdcard1`, Samsung's
 * old `/mnt/extSdCard`) is known to be a card and not which, so its volume is
 * null and its path is still from the top of it.
 */
export function placeOfAbsolute(path: string): Place | null {
  const parts = steps(path);
  const lower = parts.map((part) => part.toLowerCase());
  const take = (count: number, volume: string | null): Place => ({ volume, path: parts.slice(count).join('/') });

  if (lower[0] === 'storage') {
    if (lower[1] === 'emulated' && (/^\d+$/.test(lower[2] ?? '') || lower[2] === 'legacy')) return take(3, 'primary');
    if (lower[1] === 'self' && lower[2] === 'primary') return take(3, 'primary');
    if (VOLUME_ID.test(lower[1] ?? '')) return take(2, lower[1]!);
    if (/^(sdcard\d|extsdcard|external_sd|ext_sd|sdcard)$/.test(lower[1] ?? '')) return take(2, lower[1] === 'sdcard' ? 'primary' : null);
    return null;
  }
  if (lower[0] === 'sdcard') return take(1, 'primary');
  if (lower[0] === 'mnt') {
    if (lower[1] === 'sdcard') return take(2, 'primary');
    if (lower[1] === 'media_rw' && VOLUME_ID.test(lower[2] ?? '')) return take(3, lower[2]!);
    if (lower[1] === 'user' && /^\d+$/.test(lower[2] ?? '')) {
      if (lower[3] === 'primary' || lower[3] === 'emulated') return take(lower[3] === 'emulated' ? 5 : 4, 'primary');
      if (VOLUME_ID.test(lower[3] ?? '')) return take(4, lower[3]!);
    }
    if (/^(extsdcard|external_sd|ext_sd|sdcard\d)$/.test(lower[1] ?? '')) return take(2, null);
    return null;
  }
  if (lower[0] === 'data' && lower[1] === 'media' && /^\d+$/.test(lower[2] ?? '')) return take(3, 'primary');
  return null;
}

/**
 * Percent-encoding undone, as in a `file://` address.
 *
 * UTF-8 underneath, as the standard says and every player since about 2005
 * does. An old one that encoded its code page's bytes instead leaves
 * sequences that are not UTF-8; those are read one byte to a letter rather
 * than refused, which gets the accented Western letters right and nothing
 * worse than wrong for the rest.
 */
export function percentDecoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
  }
}

/**
 * Where the document the system's picker handed over is, as best it says.
 *
 * The picker answers with a `content://` address, and what that gives away
 * depends on who is serving the file. The phone's own storage names its
 * documents by volume and path (`primary:Music/Playlists/Mix.m3u`, and
 * `home:` for its Documents folder); the Downloads folder sometimes names
 * them by their whole path behind `raw:`; a file manager may put the path
 * into the address itself. The media store's own views say nothing, and for
 * those the native side looks the file up and sends its path where it can.
 * Null when nothing says: the entries are then matched by their ends alone.
 */
export function placeOfDocument(hints: { path?: string | null; documentId?: string | null; uri?: string | null }): Place | null {
  const folderOf = (place: Place | null): Place | null =>
    place ? { volume: place.volume, path: place.path.split('/').slice(0, -1).join('/') } : null;

  if (hints.path) {
    const place = placeOfAbsolute(hints.path);
    if (place) return folderOf(place);
  }
  const id = hints.documentId ?? '';
  if (id.startsWith('raw:')) {
    const place = placeOfAbsolute(id.slice(4));
    if (place) return folderOf(place);
  }
  if (id.startsWith('/')) {
    const place = placeOfAbsolute(id);
    if (place) return folderOf(place);
  }
  const named = /^([^:/]+):(.*)$/.exec(id);
  if (named) {
    const volume = named[1]!.toLowerCase();
    if (volume === 'primary' || VOLUME_ID.test(volume)) {
      return folderOf({ volume, path: steps(named[2]!).join('/') });
    }
    if (volume === 'home') return folderOf({ volume: 'primary', path: ['Documents', ...steps(named[2]!)].join('/') });
  }
  if (hints.uri) {
    const decoded = percentDecoded(hints.uri);
    const at = decoded.search(/\/(storage|sdcard|mnt)\//i);
    if (at >= 0) {
      const place = placeOfAbsolute(decoded.slice(at));
      if (place) return folderOf(place);
    }
  }
  return null;
}

/**
 * [relative]'s steps applied to [folder]: `..` going up a step, `.` none.
 * Null where it would go above the top of the volume, which no file is.
 */
function resolved(folder: Place, relative: string[]): Place | null {
  const at = folder.path === '' ? [] : folder.path.split('/');
  for (const step of relative) {
    if (step === '..') {
      if (at.length === 0) return null;
      at.pop();
    } else at.push(step);
  }
  return { volume: folder.volume, path: at.join('/') };
}

/**
 * What one entry's line says about where its file is, given the folder the
 * playlist is in when that is known.
 */
export function locate(line: string, folder: Place | null): Location {
  let text = line.trim();

  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text)?.[1]?.toLowerCase();
  if (scheme === 'content') {
    const decoded = percentDecoded(text);
    const media = /^content:\/\/media\/[^/]+\/audio\/media\/(\d+)/i.exec(decoded);
    if (media) return { kind: 'media', id: media[1]! };
    // A document address of the phone's own storage carries the volume and
    // path after `/document/`; anything else, only maybe a name at the end.
    const document = /\/document\/(.+)$/.exec(decoded)?.[1];
    if (document) {
      const place = placeOfDocument({ documentId: document });
      const name = steps(document.replace(/^[^:/]+:/, '')).pop();
      if (place && name) {
        const path = place.path ? `${place.path}/${name}` : name;
        return { kind: 'file', place: { volume: place.volume, path }, steps: steps(path) };
      }
    }
    return { kind: 'file', place: null, steps: steps(decoded.replace(/^content:\/\/[^/]*/i, '')).slice(-1) };
  }
  if (scheme === 'file') {
    text = percentDecoded(text.replace(/^file:/i, ''));
    // `file:///path` and `file://localhost/path` are the same thing; `file://server/share/path` is a share on a PC.
    if (/^\/\/localhost\//i.test(text)) text = text.slice('//localhost'.length);
    else if (text.startsWith('///')) text = text.slice(2);
    // `file:///C:/Music` leaves `/C:/Music`.
    if (/^\/[a-z]:\//i.test(text)) text = text.slice(1);
  } else if (scheme) {
    return { kind: 'web' };
  }

  const parts = steps(text);
  const slashed = text.replace(/\\/g, '/');

  // A PC's drive or share: nothing about the phone, only the steps.
  if (/^[a-z]:\//i.test(slashed) || /^[a-z]:$/i.test(parts[0] ?? '')) {
    return { kind: 'file', place: null, steps: parts.slice(1) };
  }
  if (slashed.startsWith('//')) return { kind: 'file', place: null, steps: parts.slice(2) };

  if (slashed.startsWith('/')) {
    const place = placeOfAbsolute(slashed);
    return { kind: 'file', place, steps: place ? steps(place.path) : parts };
  }

  // Relative to the playlist's own folder.
  const up = parts.filter((step) => step !== '..');
  if (folder) {
    const place = resolved(folder, parts);
    if (place) return { kind: 'file', place, steps: steps(place.path) };
  }
  return { kind: 'file', place: null, steps: up };
}
