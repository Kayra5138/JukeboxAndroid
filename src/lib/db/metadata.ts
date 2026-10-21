import { db } from './index.ts';
import {
  chooseCoversIn,
  fillCoversIn,
  markCoverSearchedIn,
  placeTracksIn,
  saveMetadataTo,
  unplaceTracksIn,
} from './metadataRows.ts';
import { ALL_TIME, type Range } from '../stats/period.ts';

/**
 * What an online lookup produced for a track.
 *
 * Misses are stored too. Without that, every enrichment pass would re-query the
 * tracks that can never be matched — and with iTunes allowing roughly twenty
 * requests a minute, that is the difference between a pass finishing and a pass
 * spinning forever.
 */
export type TrackMetadata = {
  trackId: string;
  /** `manual` is an edit the user typed, and outranks anything looked up. */
  status: 'matched' | 'not_found' | 'manual';
  source: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  /**
   * Whoever the record named in `album` is by, or null where nobody said.
   *
   * Optional, as the two below are, so that whatever makes a row without
   * having anything to say of it need not say so; left out is written as
   * nothing. An edit may hold an empty string, which is somebody saying the
   * record has no album artist whatever the file claims: see `mergeMetadata`.
   */
  albumArtist?: string | null;
  genre: string | null;
  year: number | null;
  artworkUrl: string | null;
  /** Where it sits on its record, when the catalogue said. */
  trackNumber: number | null;
  discNumber: number | null;
  /**
   * When somebody took this track's cover off by hand, or null.
   *
   * Nothing gives the track a cover from the rest of its record while this is
   * set: it was taken off on purpose. Saving the row again with a cover chosen
   * clears it, and so does discarding the edit.
   */
  coverRemovedAt?: number | null;
  /**
   * When a cover was searched for and none was found, or null.
   *
   * Only ever read from here. {@link markCoverSearched} writes it, and saving
   * the row again clears it: a row said afresh may name the track differently,
   * and a search that failed under the old names is no answer about the new.
   */
  coverSearchedAt?: number | null;
};

type Row = {
  track_id: string;
  status: 'matched' | 'not_found' | 'manual';
  source: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  genre: string | null;
  year: number | null;
  artwork_url: string | null;
  track_number: number | null;
  disc_number: number | null;
  cover_removed_at: number | null;
  cover_searched_at: number | null;
};

function toMetadata(row: Row): TrackMetadata {
  return {
    trackId: row.track_id,
    status: row.status,
    source: row.source,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumArtist: row.album_artist,
    genre: row.genre,
    year: row.year,
    artworkUrl: row.artwork_url,
    trackNumber: row.track_number,
    discNumber: row.disc_number,
    coverRemovedAt: row.cover_removed_at,
    coverSearchedAt: row.cover_searched_at,
  };
}

export function saveMetadata(entry: TrackMetadata): void {
  saveMetadataTo(db(), entry, Date.now());
}

/** Several rows at once, as one transaction: an edit made to many tracks together. */
export function saveMetadataMany(entries: TrackMetadata[]): void {
  const database = db();
  const now = Date.now();
  database.withTransactionSync(() => {
    for (const entry of entries) saveMetadataTo(database, entry, now);
  });
}

/** One track's row, for a screen that needs to keep fields it does not show. */
export function readMetadata(trackId: string): TrackMetadata | null {
  const row = db().getFirstSync<Row>('SELECT * FROM track_metadata WHERE track_id = ?', trackId);
  return row ? toMetadata(row) : null;
}

export function readAllMetadata(): Map<string, TrackMetadata> {
  const rows = db().getAllSync<Row>('SELECT * FROM track_metadata');
  return new Map(rows.map((row) => [row.track_id, toMetadata(row)]));
}

/**
 * The cover the app holds for one track: its row's own where that is one of
 * the app's pictures, the one its record gave it otherwise, and failing both
 * whatever address the row has. A note that nothing was found has no cover.
 */
export function readArtwork(trackId: string): string | null {
  const row = db().getFirstSync<{ own: string | null; shared: string | null }>(
    `SELECT (SELECT artwork_url FROM track_metadata WHERE track_id = ? AND status != 'not_found') AS own,
            (SELECT artwork_url FROM shared_covers WHERE track_id = ?
               AND NOT EXISTS (SELECT 1 FROM track_metadata
                               WHERE track_id = ? AND cover_removed_at IS NOT NULL)) AS shared`,
    trackId,
    trackId,
    trackId
  );
  if (!row) return null;
  return row.own?.startsWith('file://') ? row.own : (row.shared ?? row.own ?? null);
}

/**
 * Every cover a track was given by the rest of its record, by track: what
 * `fillCovers` put in `shared_covers` for tracks with no row of their own.
 */
export function readSharedCovers(): Map<string, string> {
  return new Map(
    db()
      .getAllSync<{ track_id: string; artwork_url: string }>('SELECT track_id, artwork_url FROM shared_covers')
      .map((row) => [row.track_id, row.artwork_url])
  );
}

/** One cover going onto a run of tracks, with the record it came from. */
export type CoverFill = { trackIds: string[]; uri: string; album: string | null };

/**
 * Puts covers on tracks that have none, and answers which tracks took one.
 *
 * Only ever fills. A row that already holds a picture of the app's own is left
 * exactly as it is, and that is decided here rather than by whoever calls: a
 * run over the library takes minutes, and a cover chosen by hand in the middle
 * of one must not be written over by an answer that was already on its way.
 *
 * The genres and a hand-written record name are left alone too. An album is
 * only given to a row that names none, and never to one somebody typed.
 *
 * One transaction for all of them, because the usual call is one cover going
 * onto every track of a record at once.
 *
 * A track nobody has looked up, or nobody could find, takes its cover too,
 * kept apart from the rows so that having a cover does not make it count as
 * looked up (see `fillCoversIn`). A track somebody took the cover off takes
 * nothing.
 */
export function fillCovers(fills: CoverFill[]): string[] {
  return fillCoversIn(db(), fills);
}

/**
 * Puts one cover on every one of [trackIds], over whatever cover each had,
 * and answers which took it. [keep] are left as they are.
 *
 * For a cover somebody chose for a whole record, and for the one a lookup of
 * the record found, which is asked for in so many words and so outranks the
 * covers single lookups found track by track.
 */
export function chooseCovers(trackIds: string[], uri: string, keep?: ReadonlySet<string>): string[] {
  return chooseCoversIn(db(), trackIds, uri, Date.now(), keep);
}

/** Write down that a cover was searched for these tracks and there was none. */
export function markCoverSearched(trackIds: string[]): void {
  markCoverSearchedIn(db(), trackIds, Date.now());
}

/**
 * The genre a track is counted under, changed on its own.
 *
 * It is the first of the track's tags, and the tags are edited apart from
 * everything else here, so it has to be writable without the rest of the row
 * being said again. Where a lookup or an edit has already made a row, only
 * this column moves and the row stays what it was. Where there is none, or
 * only a note that nothing was found, one is made and it is the user's: the
 * statistics read the genre from this table and from nowhere else, and tags
 * typed for a track no catalogue knows would otherwise count for nothing.
 */
export function saveGenre(trackId: string, genre: string | null): void {
  const changed = db().runSync(
    `UPDATE track_metadata SET genre = ? WHERE track_id = ? AND status != 'not_found'`,
    genre,
    trackId
  ).changes;
  if (changed > 0 || genre == null) return;
  saveMetadata({
    trackId,
    status: 'manual',
    source: 'manual',
    title: null,
    artist: null,
    album: null,
    genre,
    year: null,
    artworkUrl: null,
    trackNumber: null,
    discNumber: null,
  });
}

/**
 * The genre of each of [trackIds] made its first tag again, after tags were
 * added to or taken off many tracks at once.
 *
 * Only where a lookup or an edit has made a row already. {@link saveGenre}
 * makes one where there is none, as it should for one track whose tags
 * somebody arranged; for a run of tracks given a label it would make every
 * one of them an edit, and a track that is an edit is never looked up.
 */
export function refreshGenres(trackIds: string[]): void {
  const database = db();
  database.withTransactionSync(() => {
    for (const trackId of trackIds) {
      database.runSync(
        `UPDATE track_metadata
         SET genre = (SELECT tag FROM track_tags WHERE track_id = ? ORDER BY position LIMIT 1)
         WHERE track_id = ? AND status != 'not_found'`,
        trackId,
        trackId
      );
    }
  });
}

/**
 * One track's place on its record, and what its row said of that before.
 *
 * `was.status` is null where there was no row.
 */
export type Placing = {
  trackId: string;
  trackNumber: number | null;
  discNumber: number | null;
  was: { status: TrackMetadata['status'] | null; trackNumber: number | null; discNumber: number | null };
};

/**
 * Where tracks sit on their record, changed on its own.
 *
 * As `saveGenre` is, and for the same reason: the two columns move and the
 * row stays what it was. A lookup's row is still a lookup's, to be looked up
 * again when that is asked for; an edit is still an edit. Saved as an edit
 * instead, a track would keep its place for good — and its names, genre and
 * cover with it, shut to every lookup after, for the sake of a number.
 *
 * Where there is no row, or only a note that nothing was found, one is made
 * that holds the place and nothing else, and it is a lookup's, not the
 * user's: nobody typed it, and it can be looked up again like any other. A
 * pass over the library passes it by, as it does every track that has a row,
 * so the place is not taken back by one.
 */
export function placeTracks(placings: Placing[]): void {
  placeTracksIn(db(), placings, Date.now());
}

/**
 * Puts back what `placeTracks` changed: the numbers each row had, and no row
 * where there was none. A row whose place has been changed again since is
 * left as it is.
 */
export function unplaceTracks(placings: Placing[]): void {
  unplaceTracksIn(db(), placings);
}

/** Track ids that have never been looked up, in the order given. */
export function filterUnenriched(trackIds: string[]): string[] {
  const known = new Set(
    db()
      .getAllSync<{ track_id: string }>('SELECT track_id FROM track_metadata')
      .map((row) => row.track_id)
  );
  return trackIds.filter((id) => !known.has(id));
}

/** Track ids the user has edited by hand, which lookups must leave alone. */
export function manualTrackIds(): Set<string> {
  return new Set(
    db()
      .getAllSync<{ track_id: string }>(`SELECT track_id FROM track_metadata WHERE status = 'manual'`)
      .map((row) => row.track_id)
  );
}

/** Track ids somebody took the cover off by hand, which nothing is to give one again. */
export function coverRemovedIds(): Set<string> {
  return new Set(
    db()
      .getAllSync<{ track_id: string }>('SELECT track_id FROM track_metadata WHERE cover_removed_at IS NOT NULL')
      .map((row) => row.track_id)
  );
}

/** Drop the misses so a later pass can try them again. */
export function clearMisses(): void {
  db().runSync(`DELETE FROM track_metadata WHERE status = 'not_found'`);
}

/**
 * Forget what was found for these tracks, so they are looked up afresh.
 *
 * Hand-written entries are only discarded when [includeManual] says so, which
 * the bulk "look up again" path does not — losing a typed correction to a
 * routine refresh would be worse than leaving it stale.
 */
export function forgetMetadata(trackIds: string[], includeManual = false): void {
  if (trackIds.length === 0) return;
  const placeholders = trackIds.map(() => '?').join(',');
  const guard = includeManual ? '' : ` AND status != 'manual'`;
  db().runSync(
    `DELETE FROM track_metadata WHERE track_id IN (${placeholders})${guard}`,
    trackIds
  );
}

export type MetadataSummary = { matched: number; notFound: number; manual: number };

export function metadataSummary(): MetadataSummary {
  const row = db().getFirstSync<{ matched: number; not_found: number; manual: number }>(
    `SELECT SUM(status = 'matched')   AS matched,
            SUM(status = 'not_found') AS not_found,
            SUM(status = 'manual')    AS manual
     FROM track_metadata`
  );
  return {
    matched: row?.matched ?? 0,
    notFound: row?.not_found ?? 0,
    manual: row?.manual ?? 0,
  };
}

/** `key` matches `TopEntry`, so these can be shown in the same list as those. */
export type GenreCount = {
  key: string;
  genre: string;
  playCount: number;
  totalSeconds: number;
  /** The genre's most played track, for a cover to stand in for the name. */
  sample?: string | null;
};

/**
 * Listening time by genre. Joins history to metadata rather than storing the
 * genre on the play, so improving the metadata retroactively improves every
 * statistic derived from it.
 */
export function topGenres(limit = 10, range: Range = ALL_TIME): GenreCount[] {
  return db().getAllSync<GenreCount>(
    `SELECT m.genre AS "key",
            m.genre AS genre,
            COUNT(*) AS playCount,
            SUM(p.seconds_played) AS totalSeconds,
            -- Whichever track of the genre was played most, for its cover.
            (SELECT p2.track_id FROM plays p2
             JOIN track_metadata m2 ON m2.track_id = p2.track_id
             WHERE m2.genre = m.genre
               AND p2.started_at >= ? AND p2.started_at < ?
             GROUP BY p2.track_id
             ORDER BY COUNT(*) DESC, SUM(p2.seconds_played) DESC LIMIT 1) AS sample
     FROM plays p
     JOIN track_metadata m ON m.track_id = p.track_id
     WHERE p.started_at >= ? AND p.started_at < ? AND m.genre IS NOT NULL
     GROUP BY m.genre
     ORDER BY playCount DESC, totalSeconds DESC
     LIMIT ?`,
    range.since,
    range.until,
    range.since,
    range.until,
    limit
  );
}
