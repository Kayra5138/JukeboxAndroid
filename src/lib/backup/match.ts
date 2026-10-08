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

/** A length that says something. The media store gives nought for a file it could not read. */
const known = (seconds: number | null | undefined): seconds is number =>
  typeof seconds === 'number' && seconds > 0;

/** A file name without its ending, which is what an untagged file is given for a title. */
const bare = (name: string) => name.replace(/\.[^.]+$/, '');

/**
 * Whether a track with the right file name is the song that was backed up.
 *
 * A file name is not a song. `01 - Intro.mp3` is on every other record, and
 * taking the name alone for proof put two records' intros, with their listens
 * and tags and lyrics, onto whichever one of them was on the phone.
 *
 * So the name has to be borne out. Where both lengths are known they decide
 * it, either way: within two seconds it is the song, and outside that it is
 * not, however well the name fits. Where one is missing -- a song deleted
 * before the backup was made is described from its last listen, which has no
 * length -- the title and artist are asked instead, and they can only say yes.
 * A different title is as likely to be a correction as a different song. And
 * a title that is only the file name again is nobody's word for anything: it
 * is what an untagged file is called.
 *
 * Null is neither: nothing against it, and nothing for it but the name.
 */
function borneOut(wanted: BackupTrack, there: LocalTrack): boolean | null {
  if (known(wanted.durationSec) && known(there.durationSec)) {
    return Math.abs(there.durationSec - wanted.durationSec) <= SAME_LENGTH_SEC;
  }
  const title = fold(wanted.title);
  if (
    title &&
    title !== bare(fold(wanted.filename)) &&
    title === fold(there.title) &&
    fold(wanted.artist) === fold(there.artist)
  ) {
    return true;
  }
  return null;
}

/**
 * Which library track each backed-up song is now, by the backup's id.
 *
 * Tried from the surest evidence to the weakest, and each step only believed
 * when exactly one track answers to it: a guess between two candidates would
 * hand one song's history to another, which is worse than leaving it unplaced.
 *
 *  1. The same id and the same file name. The same phone, nothing moved.
 *  2. The same folder and file name, borne out by the length, or by the title
 *     and artist where there is no length. The library was copied over as it
 *     was.
 *  3. The same file name, borne out the same way. It was copied into a
 *     different folder.
 *  4. The same title and artist, and the same length to within two seconds.
 *     The file was renamed, or is another rip of the same recording.
 *  5. The file name and nothing else, where there was nothing to check it
 *     against -- and then only for a track no other backed-up song has come
 *     out as, by this step or any other.
 *
 * Several backed-up songs may come out as one track. That is not a mistake to
 * be avoided: a file that was moved was given a new id at the time, and its
 * history has been split across the two ever since. Putting both on the track
 * that is there now is that history joined back up. But it takes evidence, and
 * a name is not enough of it: two songs that share only a file name are two
 * songs, and the last step would sooner place neither than both.
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
  /** Songs with a name to go on and nothing else, and the track that has that name. */
  const byNameAlone: [BackupTrack, LocalTrack][] = [];

  for (const track of wanted) {
    const name = fold(track.filename);

    const same = byId.get(track.id);
    if (same && name && fold(same.filename) === name) {
      found.set(track.id, same.id);
      continue;
    }

    // The track with this name, where nothing could be said for or against it.
    let named: LocalTrack | null = null;
    if (name) {
      const there = only(byPath.get(`${fold(track.folder)}\u0000${name}`)) ?? only(byName.get(name));
      const verdict = there ? borneOut(track, there) : false;
      if (there && verdict) {
        found.set(track.id, there.id);
        continue;
      }
      if (verdict === null) named = there;
    }

    const title = fold(track.title);
    if (title && track.durationSec != null) {
      const alike = (bySong.get(`${title}\u0000${fold(track.artist)}`) ?? []).filter(
        (each) => Math.abs(each.durationSec - track.durationSec!) <= SAME_LENGTH_SEC
      );
      const there = only(alike);
      if (there) {
        found.set(track.id, there.id);
        continue;
      }
    }

    if (named) byNameAlone.push([track, named]);
  }

  // Last, and after everything surer has had its say, so that what is counted
  // here is every other claim on the track and not only the ones made so far.
  const taken = new Set(found.values());
  const asked = new Map<string, number>();
  for (const [, there] of byNameAlone) asked.set(there.id, (asked.get(there.id) ?? 0) + 1);
  for (const [track, there] of byNameAlone) {
    if (asked.get(there.id) === 1 && !taken.has(there.id)) found.set(track.id, there.id);
  }
  return found;
}
