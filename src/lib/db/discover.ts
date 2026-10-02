import { db } from './index.ts';

/**
 * What a discovery run found, and the lookups it would otherwise repeat.
 *
 * Two tables and nothing clever. The point of both is that a run is slow — a
 * request a second and a half to the catalogue, then a burst at the
 * recommender — and neither the screen opening nor the next run should have to
 * pay for what was already asked.
 */

/** One piece of music to go and find. */
export type Discovery = {
  recordingMbid: string;
  title: string;
  artist: string;
  artistMbid: string;
  release: string | null;
  coverUrl: string | null;
  /** The artists already listened to that led here, as one readable line. */
  because: string;
};

/**
 * A name's catalogue id, or null for one that was looked up and had none.
 *
 * The two are different answers and the caller has to tell them apart, so a
 * name never asked about comes back as `undefined` and one asked about in vain
 * comes back as `null`.
 */
export function knownArtistId(artist: string): string | null | undefined {
  const row = db().getFirstSync<{ mbid: string | null }>(
    'SELECT mbid FROM artist_ids WHERE artist = ?',
    artist
  );
  return row === null ? undefined : row.mbid;
}

export function rememberArtistId(artist: string, mbid: string | null, now: number): void {
  db().runSync(
    `INSERT INTO artist_ids (artist, mbid, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(artist) DO UPDATE SET mbid = excluded.mbid, fetched_at = excluded.fetched_at`,
    artist,
    mbid,
    Math.round(now)
  );
}

/**
 * Replace the suggestions with the ones just found.
 *
 * Wholesale rather than merged, in one transaction. A run is an answer to the
 * question "what should I listen to, given what I have been listening to", and
 * that question has one current answer: leaving last month's in would make the
 * list a pile of every answer ever given, ordered by nothing.
 */
export function saveDiscoveries(found: Discovery[], now: number): void {
  const database = db();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM discoveries');
    found.forEach((entry, rank) => {
      database.runSync(
        `INSERT OR REPLACE INTO discoveries
           (recording_mbid, title, artist, artist_mbid, release_name, cover_url, because, rank, found_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.recordingMbid,
        entry.title,
        entry.artist,
        entry.artistMbid,
        entry.release,
        entry.coverUrl,
        entry.because,
        rank,
        Math.round(now)
      );
    });
  });
}

export function discoveries(): Discovery[] {
  return db()
    .getAllSync<{
      recording_mbid: string;
      title: string;
      artist: string;
      artist_mbid: string;
      release_name: string | null;
      cover_url: string | null;
      because: string;
    }>('SELECT * FROM discoveries ORDER BY rank ASC')
    .map((row) => ({
      recordingMbid: row.recording_mbid,
      title: row.title,
      artist: row.artist,
      artistMbid: row.artist_mbid,
      release: row.release_name,
      coverUrl: row.cover_url,
      because: row.because,
    }));
}

/** When the suggestions on offer were worked out, or null for none yet. */
export function discoveredAt(): number | null {
  const row = db().getFirstSync<{ at: number | null }>(
    'SELECT MAX(found_at) AS at FROM discoveries'
  );
  return row?.at ?? null;
}
