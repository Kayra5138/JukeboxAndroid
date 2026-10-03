import { db } from './index.ts';

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
