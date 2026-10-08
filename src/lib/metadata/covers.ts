import { albumKey } from '../media/albums.ts';
import { albumShown } from '../media/enriched.ts';
import { foldForMatch } from './text.ts';
import type { TrackMetadata } from '../db/metadata.ts';
import type { Track } from '../types.ts';

/**
 * Which cover a track can take from the rest of its record.
 *
 * A cover belongs to a record, and the library holds records a track at a
 * time. Searching for it once per track asked the same question twelve times
 * over for one album, at three and a half seconds an asking, and could come
 * back with three different pictures for it — the album's, the single's and a
 * compilation's. So before anything is searched for, a track is given the cover
 * its neighbours on the record already have.
 *
 * The rules, all of them on the cautious side:
 *
 *  - "The same record" is what the library means by it and nothing cleverer:
 *    the album a track is shown under, compared the way `albumKey` compares.
 *    Artists are not consulted, for the reason the album list does not consult
 *    them — a compilation names a different one on every track and is one
 *    record with one cover all the same.
 *  - A track that names no record has no neighbours. Tracks with no album are
 *    not an album called nothing.
 *  - Only a cover the app holds a copy of counts: one that was looked up and
 *    saved, or one chosen by hand. The picture inside a neighbour's file is
 *    not taken, because what the phone hands back for it is a copy in its
 *    cache that can be cleared away, and a download's thumbnail is a frame of
 *    a video and not a cover at all.
 *  - Where the neighbours disagree, the cover most of them have wins, and
 *    between equals the one seen first.
 *  - It is only ever a way of filling a gap. A track that already has a cover
 *    of the app's own keeps it, whether it was looked up or chosen.
 *
 * The same file is pointed at rather than copied. Covers are kept under names
 * made from what they are and are never deleted, so two rows naming one file
 * is how one cover on two tracks was already stored; taking the cover off one
 * track, or choosing another for it, changes that track's row and nothing else.
 */

/** A cover the app holds its own copy of, as against an address on the internet. */
export function isStoredCover(url: string | null | undefined): url is string {
  return url != null && url.startsWith('file://');
}

/**
 * Whether what the phone hands back as a track's own picture came out of the
 * file itself.
 *
 * The one call answers with either of two things: the thumbnail kept for a
 * download, or a copy of the picture inside the file, and only the second is a
 * cover the file's owner put there. They are told apart by where they are
 * kept — the copy is made in the cache's `artwork` folder (see
 * `MediaStoreLibrary.embeddedArtwork`), the thumbnail is not — because the
 * call says nothing else about which it was. A download's thumbnail is a
 * frame of a video, and is meant to give way to a cover once one is found.
 */
export function isEmbeddedPicture(uri: string | null | undefined): boolean {
  return uri != null && uri.includes('/cache/artwork/');
}

/** What groups a track with the rest of its record, or null if it names none. */
export function recordKey(
  track: Pick<Track, 'album'>,
  row: Pick<TrackMetadata, 'status' | 'album'> | null | undefined
): string | null {
  const key = albumKey(albumShown(track, row) ?? '');
  return key === '' ? null : key;
}

/** The covers each record's tracks have, counted. */
export type CoverIndex = {
  /** The cover most tracks of the record have, or null when none has one. */
  pick: (key: string) => string | null;
  /** One more track of the record has this cover. */
  add: (key: string, uri: string) => void;
};

export function coverIndex(
  tracks: Track[] = [],
  rows: ReadonlyMap<string, TrackMetadata> = new Map()
): CoverIndex {
  // A Map keeps the order things were put in, which is what "seen first" means
  // between two covers the same number of tracks have.
  const held = new Map<string, Map<string, number>>();

  const add = (key: string, uri: string) => {
    let covers = held.get(key);
    if (!covers) held.set(key, (covers = new Map()));
    covers.set(uri, (covers.get(uri) ?? 0) + 1);
  };

  for (const track of tracks) {
    const row = rows.get(track.id);
    if (!isStoredCover(row?.artworkUrl)) continue;
    const key = recordKey(track, row);
    if (key) add(key, row.artworkUrl);
  }

  return {
    add,
    pick: (key) => {
      let best: string | null = null;
      let most = 0;
      for (const [uri, count] of held.get(key) ?? []) {
        if (count > most) {
          best = uri;
          most = count;
        }
      }
      return best;
    },
  };
}

/**
 * The cover a track's neighbours on the record have, or null.
 *
 * Null as well for a track that already has one of its own, so that asking is
 * never a way of replacing a cover.
 */
export function siblingCover(
  track: Track,
  library: Track[],
  rows: ReadonlyMap<string, TrackMetadata>
): string | null {
  const row = rows.get(track.id);
  if (isStoredCover(row?.artworkUrl)) return null;
  const key = recordKey(track, row);
  return key ? coverIndex(library, rows).pick(key) : null;
}

/**
 * The order a run takes its tracks in: each record's tracks together.
 *
 * A record is placed where its first track stood and the rest of it is brought
 * up to join it, so nothing is moved further than it has to be and tracks that
 * name no record stay where they were. Doing a record's tracks one after
 * another is what lets one answer about the record serve all of them while it
 * is still fresh, and what makes a record finish, rather than every record in
 * the library being a third done.
 */
export function byRecord<T>(items: T[], keyOf: (item: T) => string | null): T[] {
  const first = new Map<string, number>();
  const placed = items.map((item, index) => {
    const key = keyOf(item);
    if (key == null) return { item, at: index, index };
    if (!first.has(key)) first.set(key, index);
    return { item, at: first.get(key)!, index };
  });
  return placed
    .sort((left, right) => left.at - right.at || left.index - right.index)
    .map((entry) => entry.item);
}

/**
 * A record's name without what a shop adds to it to say which pressing it is.
 *
 * Still as it was written, case and accents and all, for whoever has to ask a
 * catalogue for the record by name and not only compare two names.
 */
export function withoutEdition(name: string): string {
  return name
    .replace(/\s+-\s+(single|ep)\s*$/i, '')
    .replace(/\s*[([][^)\]]*[)\]]\s*$/, '')
    .trim();
}

/** `Ruins - Single` and `Ruins (Deluxe Edition)` are both `Ruins`. */
function plainRecordName(name: string): string {
  return foldForMatch(withoutEdition(name));
}

/**
 * Whether two catalogues are naming the same record.
 *
 * Asked before a cover found for one track is given to others that MusicBrainz
 * put on the same release: Apple may have answered with the single, and the
 * single's cover belongs on the one song.
 */
export function sameRecordName(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  const one = plainRecordName(left);
  return one !== '' && one === plainRecordName(right);
}
