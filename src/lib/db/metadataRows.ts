import type { CoverFill, TrackMetadata } from './metadata.ts';

/**
 * The statements that write a track's row, apart from the database they are
 * run on.
 *
 * `metadata.ts` reaches the database through `db()`, and importing that pulls
 * in expo-sqlite, which only resolves inside the app. These are the writes
 * whose rules are in the SQL itself — which cover may be written over, what
 * saving a row again forgets — so they take whatever they are to run on, and a
 * test can hand them a real SQLite and see what the statements do.
 */
export type MetadataDb = {
  runSync: (sql: string, ...params: (string | number | null)[]) => { changes: number };
  withTransactionSync: (task: () => void) => void;
};

export function saveMetadataTo(database: MetadataDb, entry: TrackMetadata, now: number): void {
  database.runSync(
    `INSERT INTO track_metadata
       (track_id, status, source, title, artist, album, genre, year, artwork_url,
        track_number, disc_number, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(track_id) DO UPDATE SET
       status = excluded.status, source = excluded.source, title = excluded.title,
       artist = excluded.artist, album = excluded.album, genre = excluded.genre,
       year = excluded.year, artwork_url = excluded.artwork_url,
       track_number = excluded.track_number, disc_number = excluded.disc_number,
       fetched_at = excluded.fetched_at, cover_searched_at = NULL`,
    entry.trackId,
    entry.status,
    entry.source,
    entry.title,
    entry.artist,
    entry.album,
    entry.genre,
    entry.year,
    entry.artworkUrl,
    entry.trackNumber,
    entry.discNumber,
    now
  );
}

/** See `fillCovers` in `metadata.ts`, which is this with the app's database. */
export function fillCoversIn(database: MetadataDb, fills: CoverFill[]): string[] {
  const filled: string[] = [];
  if (fills.length === 0) return filled;
  database.withTransactionSync(() => {
    for (const { trackIds, uri, album } of fills) {
      for (const trackId of trackIds) {
        const changed = database.runSync(
          `UPDATE track_metadata SET artwork_url = ?,
             album = CASE WHEN status = 'manual' THEN album ELSE COALESCE(album, ?) END
           WHERE track_id = ?
             AND (artwork_url IS NULL OR artwork_url NOT LIKE 'file://%')`,
          uri,
          album,
          trackId
        ).changes;
        if (changed > 0) filled.push(trackId);
      }
    }
  });
  return filled;
}

export function markCoverSearchedIn(database: MetadataDb, trackIds: string[], now: number): void {
  if (trackIds.length === 0) return;
  database.withTransactionSync(() => {
    for (const trackId of trackIds) {
      database.runSync(
        'UPDATE track_metadata SET cover_searched_at = ? WHERE track_id = ?',
        now,
        trackId
      );
    }
  });
}
