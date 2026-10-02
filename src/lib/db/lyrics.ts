import { db } from './index.ts';
import type { Lyrics } from '../lyrics/lrclib.ts';

export type LyricsSource = 'lookup' | 'manual';

export type StoredLyrics = Lyrics & {
  fetchedAt: number;
  source: LyricsSource;
  /** Milliseconds to shift every timing by. Positive means later. */
  offsetMs: number;
};

/**
 * How long to leave a track alone after finding nothing for it.
 *
 * Without this, every play of an untitled or obscure track asks LRCLIB again
 * and gets the same answer. A month is long enough to stop the asking and short
 * enough that lyrics added in the meantime are eventually picked up.
 */
const RETRY_MISS_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How long to leave a track alone after failing to *reach* LRCLIB.
 *
 * A different thing entirely from a miss, and the distinction is the whole
 * point of the column: a miss is an answer and is trusted for a month, while
 * this is the absence of one. Recording an aeroplane trip as a miss would cost
 * every track played during it a month of lyrics; recording nothing at all
 * re-runs the whole seven-request cascade on every play. An hour is long enough
 * to stop the asking and short enough that walking back into signal fixes it.
 */
const RETRY_UNREACHABLE_AFTER_MS = 60 * 60 * 1000;

export function readLyrics(trackId: string): StoredLyrics | null {
  const row = db().getFirstSync<{
    plain: string | null;
    synced: string | null;
    fetched_at: number;
    source: string | null;
    offset_ms: number | null;
  }>(
    `SELECT plain, synced, fetched_at, source, offset_ms FROM track_lyrics
     WHERE track_id = ? AND (plain IS NOT NULL OR synced IS NOT NULL)`,
    trackId
  );

  if (!row) return null;
  return {
    plain: row.plain,
    synced: row.synced,
    fetchedAt: row.fetched_at,
    source: row.source === 'manual' ? 'manual' : 'lookup',
    offsetMs: row.offset_ms ?? 0,
  };
}

/**
 * True when somebody chose these words, so a lookup must not replace them.
 *
 * Asked before fetching rather than after: the point is to not go and get
 * something that would be thrown away, and to not overwrite a correction with
 * the guess it was made to fix.
 */
export function isManual(trackId: string): boolean {
  const row = db().getFirstSync<{ source: string | null }>(
    `SELECT source FROM track_lyrics WHERE track_id = ?`,
    trackId
  );
  return row?.source === 'manual';
}

/** Stores words a person chose or typed, and stops lookups from undoing it. */
export function writeManualLyrics(trackId: string, lyrics: Lyrics, at: number): void {
  const database = db();
  database.withTransactionSync(() => {
    database.runSync(
      `INSERT INTO track_lyrics (track_id, plain, synced, fetched_at, source, offset_ms)
       VALUES (?, ?, ?, ?, 'manual', COALESCE((SELECT offset_ms FROM track_lyrics WHERE track_id = ?), 0))
       ON CONFLICT(track_id) DO UPDATE SET
         plain = excluded.plain,
         synced = excluded.synced,
         fetched_at = excluded.fetched_at,
         source = 'manual',
         unreachable_at = NULL`,
      trackId,
      lyrics.plain,
      lyrics.synced,
      Math.round(at),
      trackId
    );
    dropTranslations(trackId);
  });
}

/**
 * Throws away a hand-made choice and lets the automatic search have another go.
 *
 * The row goes rather than its source being set back, because the two things
 * that stop a fresh lookup are the source and the answer already stored. A
 * track corrected by hand and then cleared should be asked about as if it had
 * never been seen.
 */
export function clearLyrics(trackId: string): void {
  const database = db();
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM track_lyrics WHERE track_id = ?`, trackId);
    dropTranslations(trackId);
  });
}

/**
 * Forgets the renderings of words that are about to change.
 *
 * `readTranslation` already refuses one whose line count disagrees, which
 * catches most replacements. It cannot catch a replacement of the same height —
 * two recordings of the same song, one timed and one not — and that is exactly
 * what somebody correcting a track by hand is likely to be doing. Left alone,
 * the old rendering would sit under the new words looking plausible.
 */
function dropTranslations(trackId: string): void {
  db().runSync(`DELETE FROM lyric_translations WHERE track_id = ?`, trackId);
}

/** How far the timings are shifted, in milliseconds. Positive means later. */
export function writeLyricsOffset(trackId: string, offsetMs: number): void {
  db().runSync(
    `UPDATE track_lyrics SET offset_ms = ? WHERE track_id = ?`,
    Math.round(offsetMs),
    trackId
  );
}

/** A miss is stored too, so the same empty answer is not fetched repeatedly. */
export function writeLyrics(trackId: string, lyrics: Lyrics | null, at: number): void {
  db().runSync(
    // An answer settles the question, so any earlier "could not reach" is
    // dropped along with it rather than left to expire on its own.
    `INSERT OR REPLACE INTO track_lyrics (track_id, plain, synced, fetched_at, unreachable_at)
     VALUES (?, ?, ?, ?, NULL)`,
    trackId,
    lyrics?.plain ?? null,
    lyrics?.synced ?? null,
    Math.round(at)
  );
}

/**
 * Record that nothing answered, without recording it as an answer.
 *
 * `fetched_at` is left at zero on a row that exists only for this: it is what
 * the month-long miss window is measured from, and a track nobody has managed
 * to ask about yet must not start serving one.
 */
export function writeLyricsUnreachable(trackId: string, at: number): void {
  db().runSync(
    `INSERT INTO track_lyrics (track_id, plain, synced, fetched_at, unreachable_at)
     VALUES (?, NULL, NULL, 0, ?)
     ON CONFLICT(track_id) DO UPDATE SET unreachable_at = excluded.unreachable_at`,
    trackId,
    Math.round(at)
  );
}

/** False while a previous answer — words or a miss — is still good. */
export function shouldFetch(trackId: string, now: number): boolean {
  const row = db().getFirstSync<{
    found: number;
    fetched_at: number;
    unreachable_at: number | null;
  }>(
    `SELECT (plain IS NOT NULL OR synced IS NOT NULL) AS found, fetched_at, unreachable_at
     FROM track_lyrics WHERE track_id = ?`,
    trackId
  );

  if (!row) return true;
  if (row.found) return false;
  if (row.unreachable_at != null && now - row.unreachable_at < RETRY_UNREACHABLE_AFTER_MS) {
    return false;
  }
  return now - row.fetched_at > RETRY_MISS_AFTER_MS;
}
