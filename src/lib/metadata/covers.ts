import { albumKey, artistKey, nameOfKey } from '../media/albums.ts';
import { albumArtistShown, albumShown } from '../media/enriched.ts';
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
 *  - "The same record" is the album a track is shown under and the album
 *    artist it is shown with, compared the way `albumKey` compares, which is
 *    as far as one track can say what the library means by it. Where no album
 *    artist is known the record is its name alone, and then a cover is still
 *    not handed to a track whose own artist is not the one most of the
 *    covered tracks share — Queen's `Greatest Hits` keeps its sleeve off
 *    ABBA's — unless no artist is most of them, which is a compilation, one
 *    record with one cover whoever sings on it.
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

type Row = Pick<TrackMetadata, 'status' | 'album' | 'albumArtist' | 'artist'>;

/** What groups a track with the rest of its record, or null if it names none. */
export function recordKey(
  track: Pick<Track, 'album' | 'albumArtist'>,
  row: Pick<TrackMetadata, 'status' | 'album' | 'albumArtist'> | null | undefined
): string | null {
  const name = albumShown(track, row) ?? '';
  if (name.trim() === '') return null;
  return albumKey(name, albumArtistShown(track, row));
}

/** The artist a track is shown under, as the merge has it: an edit's first, the file's, a lookup's. */
export function artistShown(track: Pick<Track, 'artist'>, row: Row | null | undefined): string | null {
  if (!row || row.status === 'not_found') return track.artist;
  return row.status === 'manual' ? (row.artist ?? track.artist) : (track.artist ?? row.artist);
}

/**
 * The cover the app holds for a track: its row's own picture, or else the one
 * its record gave it. A note that nothing was found has none of its own.
 */
export function heldCover(
  row: Pick<TrackMetadata, 'status' | 'artworkUrl' | 'coverRemovedAt'> | null | undefined,
  shared: string | null | undefined
): string | null {
  if (row && row.status !== 'not_found' && isStoredCover(row.artworkUrl)) return row.artworkUrl;
  // Taken off by hand: whatever the record gave it is not its cover.
  if (row?.coverRemovedAt != null) return null;
  return isStoredCover(shared) ? shared : null;
}

/** The covers each record's tracks have, counted. */
export type CoverIndex = {
  /**
   * The cover most tracks of the record have, or null when none has one.
   *
   * [artist] is the artist of the track that is to wear it. For a record
   * known only by its name it has to be the artist most of the covered
   * tracks share, where there is one; see the rules at the top.
   */
  pick: (key: string, artist?: string | null) => string | null;
  /** One more track of the record has this cover. */
  add: (key: string, uri: string) => void;
  /** Whether a track by [artist] may wear a cover of the record known by [key] at all. */
  fits: (key: string, artist: string | null | undefined) => boolean;
};

export function coverIndex(
  tracks: Track[] = [],
  rows: ReadonlyMap<string, TrackMetadata> = new Map(),
  shared: ReadonlyMap<string, string> = new Map()
): CoverIndex {
  // A Map keeps the order things were put in, which is what "seen first" means
  // between two covers the same number of tracks have.
  const held = new Map<string, Map<string, number>>();
  /**
   * Who each record's tracks are by, counted over all of them and not only
   * the covered ones: one covered track says nothing about whether the rest
   * are by somebody else.
   */
  const by = new Map<string, { counts: Map<string, number>; total: number }>();

  const add = (key: string, uri: string) => {
    let covers = held.get(key);
    if (!covers) held.set(key, (covers = new Map()));
    covers.set(uri, (covers.get(uri) ?? 0) + 1);
  };

  for (const track of tracks) {
    const row = rows.get(track.id);
    const key = recordKey(track, row);
    if (!key) continue;

    let artists = by.get(key);
    if (!artists) by.set(key, (artists = { counts: new Map(), total: 0 }));
    artists.total += 1;
    const who = artistKey(artistShown(track, row));
    if (who) artists.counts.set(who, (artists.counts.get(who) ?? 0) + 1);

    const cover = heldCover(row, shared.get(track.id));
    if (cover) add(key, cover);
  }

  /** Whether a track by [artist] may wear a cover of the record known by [key]. */
  const fits = (key: string, artist: string | null | undefined): boolean => {
    // A record with an album artist is that artist's, whoever sings.
    if (nameOfKey(key) !== key || artist === undefined) return true;
    const artists = by.get(key);
    if (!artists) return true;
    let most = 0;
    let leader = '';
    for (const [who, count] of artists.counts) {
      if (count > most) {
        most = count;
        leader = who;
      }
    }
    // Nobody on more than half of them: a compilation, whose cover is
    // everybody's. Half and half is two artists' worth of one record as far
    // as anything here can tell, which is how the album list shows it too.
    if (most * 2 <= artists.total) return true;
    return artistKey(artist) === leader;
  };

  return {
    add,
    fits,
    pick: (key, artist) => {
      if (!fits(key, artist)) return null;
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
  rows: ReadonlyMap<string, TrackMetadata>,
  shared: ReadonlyMap<string, string> = new Map()
): string | null {
  const row = rows.get(track.id);
  if (heldCover(row, shared.get(track.id))) return null;
  const key = recordKey(track, row);
  return key ? coverIndex(library, rows, shared).pick(key, artistShown(track, row)) : null;
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
