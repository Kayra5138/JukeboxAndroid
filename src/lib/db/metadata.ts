import { db } from './index.ts';
import { fillCoversIn, markCoverSearchedIn, saveMetadataTo } from './metadataRows.ts';
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
  genre: string | null;
  year: number | null;
  artworkUrl: string | null;
  /** Where it sits on its record, when the catalogue said. */
  trackNumber: number | null;
  discNumber: number | null;
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
  genre: string | null;
  year: number | null;
  artwork_url: string | null;
  track_number: number | null;
  disc_number: number | null;
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
    genre: row.genre,
    year: row.year,
    artworkUrl: row.artwork_url,
    trackNumber: row.track_number,
    discNumber: row.disc_number,
    coverSearchedAt: row.cover_searched_at,
  };
}

export function saveMetadata(entry: TrackMetadata): void {
  saveMetadataTo(db(), entry, Date.now());
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

export function readArtwork(trackId: string): string | null {
  return db().getFirstSync<{ artwork_url: string | null }>(
    'SELECT artwork_url FROM track_metadata WHERE track_id = ?', trackId
  )?.artwork_url ?? null;
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
 */
export function fillCovers(fills: CoverFill[]): string[] {
  return fillCoversIn(db(), fills);
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
