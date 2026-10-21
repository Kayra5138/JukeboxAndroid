import { splitCredit } from '../metadata/credit.ts';
import { canonicalLabel, foldForMatch } from '../metadata/text.ts';
import type { EnrichedTrack } from './enriched.ts';
import { compareFolded, compareNames } from './sort.ts';

/**
 * Records, assembled from what the tracks say about themselves.
 *
 * Derived rather than stored, for the same reason the listening lists are:
 * there is nothing to keep in step and no way for an album to disagree with
 * the tracks it is made of. Look a track up, correct it by hand, delete it —
 * the albums follow without anything having to notice.
 */

export type Album = {
  /** Unique within a library, and what a screen is opened with: see {@link albumKey}. */
  key: string;
  name: string;
  /**
   * Whoever the record is by, as it is shown: its album artist where its
   * tracks name one, otherwise the artist most of them share, and null where
   * they disagree.
   */
  artist: string | null;
  /**
   * The album artist its tracks name, as most of them spell it, or null where
   * none of them names one. "Various Artists" is one, for a record whose
   * tracks say they are a compilation.
   */
  albumArtist: string | null;
  /**
   * A record of many artists: one whose tracks say so, or one whose tracks
   * name no album artist and no artist that half of them share.
   */
  compilation: boolean;
  year: number | null;
  tracks: EnrichedTrack[];
};

/**
 * What separates a record's name from its artist inside a key.
 *
 * A unit separator: no name anybody types or any tag carries has one in it,
 * so a key with it is never mistaken for a record that happens to be called
 * something with a dash in it, and one without it is a record of that name
 * alone — which is exactly what a key was before records had artists, so a
 * key written down then still opens the record it named.
 */
const BETWEEN = '\u001f';

/**
 * Who an album artist is, for telling records apart: the first artist in the
 * credit, folded.
 *
 * The first and not the whole of it. A file whose album artist is the track's
 * own artist, guests and all — `Aurora & Someone` on one song of a record
 * whose others say `Aurora` — is still on Aurora's record, and keying by the
 * whole credit would make a record of one song out of it. Credits are taken
 * apart by the one reading the rest of the app uses (`metadata/credit.ts`),
 * so `Simon & Garfunkel` stays one artist here as it does everywhere else.
 *
 * Empty for a credit with no letters or digits in it, which says nobody.
 */
export function artistKey(credit: string | null | undefined): string {
  const first = splitCredit(credit)[0];
  return first ? foldForMatch(first) : '';
}

/**
 * What a record's tracks say when they say it is by many people.
 *
 * In the languages the app speaks and the ones taggers most often write it
 * in, folded the way `foldForMatch` folds. MusicBrainz names it "Various
 * Artists" and a lookup of a record by its special artist is written down
 * under that name, so that one is here too.
 */
const MANY_ARTISTS = new Set(
  [
    'Various Artists', 'Various Artist', 'Various', 'VA', 'V.A.', 'V/A',
    'Varios Artistas', 'Varios', 'Artistas Varios', 'Varios Intérpretes',
    'Vários Artistas', 'Diversos Artistas', 'Vários Intérpretes',
    'Verschiedene Interpreten', 'Verschiedene Künstler', 'Diverse Interpreten', 'Diverse',
    'Artistes Divers', 'Artistes Variés', 'Divers', 'Compilation',
    'Artisti Vari', 'Artisti Diversi', 'AA.VV.', 'AA VV',
    'Çeşitli Sanatçılar', 'Çeşitli', 'Karışık', 'Karışık Sanatçılar',
    'Различные исполнители', 'Разные исполнители', 'Сборник', 'Va',
    'ヴァリアス・アーティスト', 'オムニバス', 'V.A',
    '群星', '多位艺术家', '合辑', '羣星',
  ].map((name) => foldForMatch(name))
);

/** Whether an album artist says the record is by many people. */
export function isCompilationArtist(credit: string | null | undefined): boolean {
  const folded = foldForMatch(credit ?? '');
  return folded !== '' && MANY_ARTISTS.has(folded);
}

/**
 * The key a record is opened with: its name, and its album artist where it
 * has one that is a person.
 *
 * Case and surrounding space vary between whichever catalogue answered, and a
 * library where "Ghost Stories" and "ghost stories " are two records is worse
 * than one where a genuine difference in capitalisation is lost. The artist
 * is keyed as {@link artistKey} keys it.
 *
 * A record with no album artist, or one by "Various Artists", is keyed by its
 * name alone — exactly as every record was before the album artist was read,
 * so that a key written down then still opens it.
 *
 * Exported because it is what a screen is opened with. Something holding a
 * single track cannot always tell from it alone which record the library put
 * it on — a track that names no album artist joins the record of its own
 * artist, which takes the rest of the library to know — so whatever opens a
 * record from a track says which track as well, and {@link findAlbum} sorts
 * it out.
 */
export function albumKey(name: string, albumArtist?: string | null): string {
  const record = name.trim().toLowerCase();
  if (!albumArtist || isCompilationArtist(albumArtist)) return record;
  const by = artistKey(albumArtist);
  return by ? `${record}${BETWEEN}${by}` : record;
}

/** The part of a key that is the record's name, which is the whole of a key without an artist. */
export function nameOfKey(key: string): string {
  const at = key.indexOf(BETWEEN);
  return at < 0 ? key : key.slice(0, at);
}

/**
 * The record a screen was opened with, among [albums].
 *
 * Opened from a track, the track's own record comes first, whatever the key
 * says: the key was made from the track's name for its record, and two
 * records can share that. Otherwise the record with that very key; and a key
 * none of them has any longer — written down before the record gained an
 * album artist, or an album artist since corrected — finds the record of
 * that name most of the name's tracks are on.
 */
export function findAlbum(
  albums: readonly Album[],
  key: string,
  trackId?: string | null
): Album | null {
  const name = nameOfKey(key);
  if (trackId) {
    const holding = albums.find(
      (album) => nameOfKey(album.key) === name && album.tracks.some((track) => track.id === trackId)
    );
    if (holding) return holding;
  }
  const exact = albums.find((album) => album.key === key);
  if (exact) return exact;
  let best: Album | null = null;
  for (const album of albums) {
    if (nameOfKey(album.key) !== name) continue;
    if (!best || album.tracks.length > best.tracks.length) best = album;
  }
  return best;
}

/**
 * [albums] narrowed to [shown]: each record that holds any of those tracks,
 * holding only those, under its own key.
 *
 * For a search. Grouping the tracks a search found would group them without
 * the rest of the library, and which record a track is on can take the rest
 * of the library to know; narrowing the library's own records keeps every
 * record what it is, only shorter.
 */
export function narrowAlbums(albums: readonly Album[], shown: readonly { id: string }[]): Album[] {
  const ids = new Set(shown.map((track) => track.id));
  const narrowed: Album[] = [];
  for (const album of albums) {
    const tracks = album.tracks.filter((track) => ids.has(track.id));
    if (tracks.length === album.tracks.length) narrowed.push(album);
    else if (tracks.length > 0) narrowed.push({ ...album, tracks });
  }
  return narrowed;
}

/**
 * Groups [tracks] into the records they belong to.
 *
 * Only tracks that name an album take part. The rest are not an album called
 * nothing — they are tracks whose record is unknown, and collecting them under
 * one heading would invent a release that does not exist.
 *
 * Tracks that name one record are first gathered by its name. Most names are
 * one record, and their tracks name no album artist or all name the same one;
 * those are a record and nothing more is asked. Where a name is shared by
 * records of different album artists — Queen's `Greatest Hits` and ABBA's —
 * each album artist is a record of its own (see {@link recordsIn}). What is
 * never done is to split a record by its tracks' own artists: a compilation
 * names a different one on every track, and a guest on one song is still on
 * the record.
 */
export function albumsOf(tracks: readonly EnrichedTrack[]): Album[] {
  const groups = new Map<string, EnrichedTrack[]>();

  for (const track of tracks) {
    const name = track.album?.trim();
    if (!name) continue;
    const id = albumKey(name);
    const held = groups.get(id);
    if (held) held.push(track);
    else groups.set(id, [track]);
  }

  const albums: Album[] = [];
  for (const [id, members] of groups) {
    for (const part of recordsIn(members)) albums.push(assemble(id, part));
  }

  /*
    By whoever it is by and then by its name, in the library's own alphabet
    (`sort.ts`) and not the phone's. `localeCompare` was both wrong and slow
    here: it files by whatever language the phone is in, and on this engine
    every call of it builds a collator on the other side of the bridge — per
    pair, for a few hundred records, each time the library is grouped.

    Folded once per record rather than once per pair. A record nobody can be
    named for goes first, as it did. The key settles what is left, because two
    names can fold alike and an order that ends in a draw is not one.
  */
  const filed = albums.map((album) => ({
    album,
    artist: canonicalLabel(album.artist ?? ''),
    name: canonicalLabel(album.name),
  }));
  filed.sort(
    (left, right) =>
      compareFolded(left.artist, right.artist) ||
      compareFolded(left.name, right.name) ||
      (left.album.key < right.album.key ? -1 : left.album.key > right.album.key ? 1 : 0)
  );
  return filed.map((entry) => entry.album);
}

/** One record's tracks, and the album artist it is keyed by, or null for its name alone. */
type Part = { by: string | null; tracks: EnrichedTrack[] };

/**
 * The records among tracks that all name one record.
 *
 * Every rule here leans towards keeping tracks together. A record split in
 * two is a mistake anybody sees at once and cannot put right short of
 * retagging; two records of one name kept together is the mistake the
 * library has always made, and the rarer of the two.
 *
 *  1. Tracks naming no album artist, or all naming the same one, are one
 *     record. That is nearly every record in nearly every library, and it is
 *     settled without reading a single credit.
 *  2. An album artist saying "Various Artists" is a compilation, which is a
 *     record of its name alone: it joins whatever else of that name names no
 *     artist of its own.
 *  3. Several album artists that are each only the artist of their own
 *     tracks, sharing a folder, on records of a song or two apiece or of
 *     three or more artists, are not several records. They are one record
 *     somebody's tagger filled in track by track — the compilation whose
 *     every song names its own singer as the album artist — and it is kept
 *     whole as rule 1 would have it.
 *  4. Otherwise each album artist is a record. A track naming none goes to
 *     the record of its own artist: its first artist, then the whole of its
 *     credit, then any other artist in it if only one record is by one of
 *     them; failing those, the record that has tracks in the same folder, if
 *     only one does. What is left is a record of the name alone, which is
 *     what it would have been before album artists were read.
 */
function recordsIn(members: EnrichedTrack[]): Part[] {
  const named = new Map<string, EnrichedTrack[]>();
  const loose: EnrichedTrack[] = [];
  const rest: EnrichedTrack[] = [];

  for (const track of members) {
    const albumArtist = track.albumArtist?.trim();
    if (!albumArtist) {
      loose.push(track);
      continue;
    }
    if (isCompilationArtist(albumArtist)) {
      rest.push(track);
      continue;
    }
    const by = artistKey(albumArtist);
    if (!by) {
      loose.push(track);
      continue;
    }
    const held = named.get(by);
    if (held) held.push(track);
    else named.set(by, [track]);
  }

  if (named.size === 0 || (named.size >= 2 && taggedTrackByTrack(named))) {
    return [{ by: null, tracks: members }];
  }

  // Where each record already has tracks, read before anybody joins one, so
  // that which record a track joins does not depend on who joined first.
  const folders = new Map<string, Set<string>>();
  for (const [by, tracks] of named) {
    folders.set(by, new Set(tracks.map((track) => track.folder).filter((folder): folder is string => !!folder)));
  }

  for (const track of loose) {
    const home = homeOf(track, named, folders);
    if (home) named.get(home)!.push(track);
    else rest.push(track);
  }

  const parts: Part[] = [...named].map(([by, tracks]) => ({ by, tracks }));
  if (rest.length > 0) parts.push({ by: null, tracks: rest });
  return parts;
}

/** Rule 3 of {@link recordsIn}: album artists that only ever repeat each track's own artist. */
function taggedTrackByTrack(named: Map<string, EnrichedTrack[]>): boolean {
  for (const [by, tracks] of named) {
    if (tracks.some((track) => artistKey(track.artist) !== by)) return false;
  }
  const small = [...named.values()].every((tracks) => tracks.length <= 2);
  if (named.size < 3 && !small) return false;

  const seen = new Map<string, string>();
  for (const [by, tracks] of named) {
    for (const track of tracks) {
      if (!track.folder) continue;
      const other = seen.get(track.folder);
      if (other !== undefined && other !== by) return true;
      seen.set(track.folder, by);
    }
  }
  return false;
}

/** Which record a track naming no album artist joins, by rule 4 of {@link recordsIn}, or null. */
function homeOf(
  track: EnrichedTrack,
  named: Map<string, EnrichedTrack[]>,
  folders: Map<string, Set<string>>
): string | null {
  const credited = splitCredit(track.artist)
    .map((name) => foldForMatch(name))
    .filter((key) => key !== '');
  if (credited[0] && named.has(credited[0])) return credited[0];

  const whole = foldForMatch(track.artist ?? '');
  if (whole && named.has(whole)) return whole;

  const guests = [...new Set(credited.slice(1).filter((key) => named.has(key)))];
  if (guests.length === 1) return guests[0]!;

  if (track.folder) {
    const near = [...folders].filter(([, held]) => held.has(track.folder!)).map(([by]) => by);
    if (near.length === 1) return near[0]!;
  }
  return null;
}

/** A record, out of its part of the tracks that share its name. */
function assemble(id: string, part: Part): Album {
  const ordered = orderWithin(part.tracks);
  // The spelling the first track uses, since one of them has to be chosen
  // and they are the same record whichever it is.
  const name = ordered[0]!.album?.trim() ?? id;
  const albumArtist = part.by
    ? mostSaid(ordered, (track) => (artistKey(track.albumArtist) === part.by ? track.albumArtist : null))
    : mostSaid(ordered, (track) => (isCompilationArtist(track.albumArtist) ? track.albumArtist : null));
  const common = commonArtist(ordered);
  return {
    key: part.by ? `${id}${BETWEEN}${part.by}` : id,
    name,
    artist: albumArtist ?? common,
    albumArtist,
    compilation: part.by == null && (albumArtist != null || common == null),
    year: ordered.find((track) => track.year != null)?.year ?? null,
    tracks: ordered,
  };
}

/** The spelling most of [tracks] give for something, the first met between equals, or null. */
function mostSaid(tracks: EnrichedTrack[], said: (track: EnrichedTrack) => string | null | undefined): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  for (const track of tracks) {
    const value = said(track)?.trim();
    if (!value) continue;
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (best == null || count > counts.get(best)!) best = value;
  }
  return best;
}

/**
 * The tracks of one record, in the order it plays.
 *
 * Numbered tracks first and in their own order; everything else after them, by
 * filename. A track whose position nobody knows is not track zero, and slipping
 * it in among the ones that are known would be claiming to know. Putting them
 * below keeps the part of the order that is real intact and says plainly that
 * the rest is not.
 */
export function orderWithin(tracks: EnrichedTrack[]): EnrichedTrack[] {
  const numbered: EnrichedTrack[] = [];
  const rest: EnrichedTrack[] = [];
  for (const track of tracks) {
    (positionOf(track) == null ? rest : numbered).push(track);
  }

  numbered.sort((left, right) => {
    const leftPosition = positionOf(left)!;
    const rightPosition = positionOf(right)!;
    return (
      (leftPosition.disc ?? 1) - (rightPosition.disc ?? 1) ||
      leftPosition.track - rightPosition.track ||
      // Only reached by two tracks claiming one position, so folding inside
      // the comparison costs nothing worth saving.
      compareNames(left.title, right.title)
    );
  });

  // Every one of these is compared by name, so each is folded once and kept.
  const unplaced = rest.map((track) => ({
    track,
    name: canonicalLabel(track.filename ?? track.title),
  }));
  unplaced.sort((left, right) => compareFolded(left.name, right.name));

  return [...numbered, ...unplaced.map((entry) => entry.track)];
}

/**
 * Where a track sits, from the catalogue or from the file.
 *
 * The catalogue is asked first. A file downloaded one at a time carries
 * whatever number the downloader felt like, while the catalogue knows the
 * record — and where neither says anything, nothing is claimed.
 */
function positionOf(track: EnrichedTrack): { disc: number | null; track: number } | null {
  const number = track.trackNumber;
  if (number == null || number <= 0) return null;
  return { disc: track.discNumber ?? null, track: number };
}

/** The artist of the record, or null where its tracks do not agree. */
function commonArtist(tracks: EnrichedTrack[]): string | null {
  const counts = new Map<string, { name: string; count: number }>();
  for (const track of tracks) {
    const name = track.artist?.trim();
    if (!name) continue;
    const id = name.toLowerCase();
    const held = counts.get(id);
    if (held) held.count += 1;
    else counts.set(id, { name, count: 1 });
  }
  if (counts.size === 0) return null;

  const [best] = [...counts.values()].sort((left, right) => right.count - left.count);
  // A record where no one artist appears on half the tracks is a compilation,
  // and naming the most frequent of twelve would be picking one at random.
  return best.count * 2 >= tracks.length ? best.name : null;
}
