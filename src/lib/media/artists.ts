import { strings, type Strings } from '../i18n/languages.ts';
import { foldForMatch } from '../metadata/text.ts';
import { albumsOf, type Album } from './albums.ts';
import type { EnrichedTrack } from './enriched.ts';
import { compareNames, latestOf, sortAlbums, sortTracks } from './sort.ts';

/**
 * The library by who made it, assembled from what the tracks say.
 *
 * Derived rather than stored, like the records in `albums.ts` and for the same
 * reason: an artist is whoever the tracks name, so correcting a tag moves the
 * track and there is nothing here that could be left behind.
 *
 * Who a track names is not decided here. A credit is a line of text and taking
 * it apart is a problem with its own file (`metadata/credit.ts`) and its own
 * memory of what the catalogues have said; the stats already count listens with
 * it, and a library that split `Eminem, Rihanna` by some second rule would show
 * an artist on one screen that the other has never heard of. So the reading is
 * handed in — the same one the stats are handed — which is also what lets this
 * be exercised without a database behind it.
 */

/** Who a track names: the reading `creditReader` in `db/credits.ts` gives out. */
export type NamesOn = (listen: { artist: string; title?: string | null }) => string[];

export type Artist = {
  /** Unique within a library, and what a screen is opened with. */
  key: string;
  name: string;
  /** Everything they are credited on, by title. */
  tracks: EnrichedTrack[];
  /** The records those tracks belong to, holding only the tracks that are theirs. */
  albums: Album[];
  /** A track to borrow a cover from, or null where there is nothing to borrow. */
  cover: EnrichedTrack | null;
};

/**
 * Where the tracks that name nobody are kept.
 *
 * Not a name anybody could have: a folded name is letters, digits and spaces,
 * so no credit can ever arrive at this key and be mistaken for it.
 */
export const UNKNOWN_ARTIST = '?';

const NOTHING_PLAYED: ReadonlyMap<string, number> = new Map();

type Gathering = {
  tracks: EnrichedTrack[];
  /** Each spelling met, and how many tracks use it. */
  spellings: Map<string, number>;
};

/**
 * Groups [tracks] under every artist each of them names.
 *
 * A track by two people is under both. It is not shared out between them and
 * not filed under the first: somebody looking for Rihanna is looking for
 * everything she is on, and the song she guests on is one of those. Which means
 * the artists' track counts add up to more than the library holds, exactly as
 * their minutes do in the stats, and for the same reason.
 *
 * Names are matched folded, so `AURORA` on one file and `Aurora` on another are
 * one artist. The spelling shown is the one most of their tracks use, and the
 * first met where that is a draw.
 *
 * Tracks that name nobody are kept, under one heading at the end. Unlike a
 * record called nothing, that heading invents no one — it says what the files
 * say — and leaving them out would make this the one view of the library in
 * which some of it cannot be found.
 *
 * That heading is called what the rows already call a track that names nobody,
 * in the language of [t]. Only its name: the key it is kept under is
 * {@link UNKNOWN_ARTIST} whatever is spoken, so a screen opened with it finds
 * it again after the language has changed.
 */
export function artistsOf(
  tracks: readonly EnrichedTrack[],
  namesOn: NamesOn,
  t: Strings = strings()
): Artist[] {
  const groups = new Map<string, Gathering>();

  const file = (key: string, name: string, track: EnrichedTrack) => {
    let group = groups.get(key);
    if (!group) {
      group = { tracks: [], spellings: new Map() };
      groups.set(key, group);
    }
    group.tracks.push(track);
    group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1);
  };

  for (const track of tracks) {
    const counted = new Set<string>();
    for (const name of namesOn({ artist: track.artist ?? '', title: track.title })) {
      const key = foldForMatch(name);
      // Once per track even if they are named twice, or in both the credit and
      // the title — the rule the stats count by.
      if (!key || counted.has(key)) continue;
      counted.add(key);
      file(key, name.trim(), track);
    }
    if (counted.size === 0) file(UNKNOWN_ARTIST, t.common.unknownArtist, track);
  }

  const artists: Artist[] = [];
  for (const [key, group] of groups) {
    let name = '';
    let most = 0;
    for (const [spelling, count] of group.spellings) {
      // Strictly more, so a draw goes to whichever was met first.
      if (count > most) {
        name = spelling;
        most = count;
      }
    }

    const albums = sortAlbums(albumsOf(group.tracks), 'name', NOTHING_PLAYED);
    const ordered = sortTracks(group.tracks, 'name', NOTHING_PLAYED);
    artists.push({
      key,
      name,
      tracks: ordered,
      albums,
      // A record's sleeve where they have one: it is the nearest thing to a
      // picture of them that the library holds without going to ask for one.
      cover: albums[0]?.tracks[0] ?? ordered[0] ?? null,
    });
  }

  return artists.sort(byName);
}

/**
 * Two artists by what they are called, with nobody last.
 *
 * Last whatever the alphabet would say about the words the heading is given:
 * it is not a name, and filing it among the names — under `B` in one language
 * and `U` in another — would make it look like one.
 */
function byName(left: Artist, right: Artist): number {
  return (
    Number(left.key === UNKNOWN_ARTIST) - Number(right.key === UNKNOWN_ARTIST) ||
    compareNames(left.name, right.name) ||
    // Two names the alphabet cannot tell apart still need an order that does
    // not change between one visit and the next.
    (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  );
}

/**
 * What can be asked of a list of artists.
 *
 * Not the three questions asked of tracks. Two of those carry over — what are
 * they called, what of theirs is new — but an artist is also a quantity, which
 * a track is not: how much of them there is, and how much of it gets listened
 * to. Stored under these words for the reason {@link SortOrder} is.
 */
export type ArtistSort = 'name' | 'tracks' | 'played' | 'added';

export const ARTIST_SORTS = ['name', 'tracks', 'played', 'added'] as const;

/** Alphabetical for anything the setting does not recognise. */
export function asArtistSort(value: string | null): ArtistSort {
  return ARTIST_SORTS.find((order) => order === value) ?? 'name';
}

/** The order a tap lands on, wrapping round. */
export function nextArtistSort(order: ArtistSort): ArtistSort {
  return ARTIST_SORTS[(ARTIST_SORTS.indexOf(order) + 1) % ARTIST_SORTS.length]!;
}

/**
 * The artists in the order asked for. A copy, as the other sorts hand back.
 *
 * `played` is how many times, not how lately — the sum of every listen to
 * every track of theirs. A track's own order asks when it was last wanted,
 * because one listen yesterday says something about a track; it says very
 * little about an artist with two hundred of them, and what somebody ordering
 * artists by listening wants at the top is whoever they listen to most.
 *
 * `added` is the newest of their tracks, the rule a record is dated by and for
 * the same reason: see {@link sortAlbums}.
 *
 * Whatever is asked, a draw is settled by name, and the heading for the tracks
 * that name nobody stays where it was: at the end. It would otherwise head the
 * list by sheer size in most untagged collections, above everybody who is
 * actually somebody.
 *
 * @param plays how many times each track has been listened to, keyed by track
 *   id. Passed in rather than read here, like the history the track sort takes.
 */
export function sortArtists(
  artists: readonly Artist[],
  order: ArtistSort,
  plays: ReadonlyMap<string, number>
): Artist[] {
  if (order === 'name') return [...artists].sort(byName);

  const weigh = (artist: Artist): number | null => {
    if (order === 'tracks') return artist.tracks.length;
    if (order === 'added') return latestOf(artist.tracks.map((track) => track.addedAt ?? null));
    let listens = 0;
    for (const track of artist.tracks) listens += plays.get(track.id) ?? 0;
    return listens;
  };

  // Weighed once each rather than inside the comparison, which a sort reaches
  // many times over for every artist.
  return artists
    .map((artist) => ({ artist, weight: weigh(artist) }))
    .sort(
      (left, right) =>
        Number(left.artist.key === UNKNOWN_ARTIST) - Number(right.artist.key === UNKNOWN_ARTIST) ||
        // An artist none of whose tracks can be dated goes after all that can.
        Number(left.weight == null) - Number(right.weight == null) ||
        (right.weight ?? 0) - (left.weight ?? 0) ||
        byName(left.artist, right.artist)
    )
    .map((entry) => entry.artist);
}
