import type { BackupTrack } from './format.ts';

/**
 * Finding the songs a backup talks about in the library that is here now.
 *
 * Everything the app remembers is filed under a song's id, and that id is the
 * media store's: a number this phone gave the file when it first saw it. On the
 * same phone it does not change. On another phone, or after the music has been
 * copied over again, the same song has a different number and the same number
 * may well belong to a different song. So a backup cannot be put back by id.
 * It carries a description of each song instead, and this finds the song that
 * fits it.
 */

/** As much of a library track as is needed to recognise one. */
export type LocalTrack = {
  id: string;
  filename: string | null;
  folder: string | null;
  title: string | null;
  artist: string | null;
  durationSec: number;
};

/** How far apart two lengths may be and still be the same recording. */
const SAME_LENGTH_SEC = 2;

const fold = (value: string | null | undefined) =>
  (value ?? '').normalize('NFKC').trim().toLowerCase();

/**
 * Which library track each backed-up song is now, by the backup's id.
 *
 * Tried from the surest evidence to the weakest, and each step only believed
 * when exactly one track answers to it: a guess between two candidates would
 * hand one song's history to another, which is worse than leaving it unplaced.
 *
 *  1. The same id and the same file name. The same phone, nothing moved.
 *  2. The same folder and file name. The library was copied over as it was.
 *  3. The same file name alone. It was copied into a different folder.
 *  4. The same title and artist, and the same length to within two seconds.
 *     The file was renamed, or is another rip of the same recording.
 *
 * Several backed-up songs may come out as one track. That is not a mistake to
 * be avoided: a file that was moved was given a new id at the time, and its
 * history has been split across the two ever since. Putting both on the track
 * that is there now is that history joined back up.
 */
export function matchTracks(wanted: BackupTrack[], library: LocalTrack[]): Map<string, string> {
  const byId = new Map<string, LocalTrack>();
  const byPath = new Map<string, LocalTrack[]>();
  const byName = new Map<string, LocalTrack[]>();
  const bySong = new Map<string, LocalTrack[]>();

  const add = (index: Map<string, LocalTrack[]>, key: string, track: LocalTrack) => {
    const list = index.get(key);
    if (list) list.push(track);
    else index.set(key, [track]);
  };

  for (const track of library) {
    byId.set(track.id, track);
    const name = fold(track.filename);
    if (name) {
      add(byPath, `${fold(track.folder)}\u0000${name}`, track);
      add(byName, name, track);
    }
    const title = fold(track.title);
    if (title) add(bySong, `${title}\u0000${fold(track.artist)}`, track);
  }

  const only = (list: LocalTrack[] | undefined) => (list && list.length === 1 ? list[0]! : null);

  const found = new Map<string, string>();
  for (const track of wanted) {
    const name = fold(track.filename);

    const same = byId.get(track.id);
    if (same && name && fold(same.filename) === name) {
      found.set(track.id, same.id);
      continue;
    }

    if (name) {
      const there = only(byPath.get(`${fold(track.folder)}\u0000${name}`)) ?? only(byName.get(name));
      if (there) {
        found.set(track.id, there.id);
        continue;
      }
    }

    const title = fold(track.title);
    if (title && track.durationSec != null) {
      const alike = (bySong.get(`${title}\u0000${fold(track.artist)}`) ?? []).filter(
        (each) => Math.abs(each.durationSec - track.durationSec!) <= SAME_LENGTH_SEC
      );
      const there = only(alike);
      if (there) found.set(track.id, there.id);
    }
  }
  return found;
}
