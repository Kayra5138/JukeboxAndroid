import { db } from './index.ts';
import { countsAsPlay, type Play } from '../player/session.ts';
import { ALL_TIME, type Listen, type Range } from '../stats/period.ts';

export type { Play };

/**
 * Store a finished listen. What counts as one is decided in `player/session.ts`
 * — it is arithmetic over wall clock, and putting it there is what let it be
 * tested without SQLite underneath.
 */
export function recordPlay(play: Play): void {
  if (!countsAsPlay(play)) return;
  const { track, startedAt, secondsPlayed, completed } = play;

  db().runSync(
    `INSERT INTO plays (track_id, title, artist, filename, started_at, seconds_played, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    track.id,
    track.title,
    track.artist,
    track.filename,
    Math.round(startedAt),
    secondsPlayed,
    completed ? 1 : 0
  );
}

/**
 * Store a listen the user walked out on.
 *
 * Only ever called for the one gesture that means it — pressing next, or
 * picking another row, while something was playing. The other ways a listen
 * ends with `completed` false are not judgements about the music and must not
 * be counted as any: closing the app, a file that would not open, the queue
 * being replaced from the library. Written down as skips those would bury the
 * tracks that were actually rejected under every track that happened to be
 * playing when something else happened.
 *
 * Side by side with {@link recordPlay} rather than inside it, because both can
 * be true of one listen and the caller is the only thing that knows which
 * gesture ended it.
 */
export function recordSkip(play: Play): void {
  const { track, startedAt, secondsPlayed } = play;

  db().runSync(
    `INSERT INTO skips (track_id, title, artist, started_at, seconds_played, duration_sec)
     VALUES (?, ?, ?, ?, ?, ?)`,
    track.id,
    track.title,
    track.artist,
    Math.round(startedAt),
    secondsPlayed,
    track.durationSec
  );
}


export type ListeningSummary = {
  playCount: number;
  totalSeconds: number;
  distinctTracks: number;
  distinctArtists: number;
  /** Listens that ran to the end, for the share of a period spent skipping. */
  completedCount: number;
};

/*
  Every query below takes a half-open range and compares it the same way:
  `started_at >= since AND started_at < until`. Half open is what lets two
  neighbouring periods be asked about without a listen falling into both, and
  the same comparison everywhere is what keeps the chart's columns adding up to
  the summary above them.
*/
export function summarize(range: Range = ALL_TIME): ListeningSummary {
  const row = db().getFirstSync<{
    play_count: number;
    total_seconds: number | null;
    distinct_tracks: number;
    distinct_artists: number;
    completed_count: number | null;
  }>(
    `SELECT COUNT(*)                  AS play_count,
            SUM(seconds_played)       AS total_seconds,
            COUNT(DISTINCT track_id)  AS distinct_tracks,
            COUNT(DISTINCT artist)    AS distinct_artists,
            SUM(completed)            AS completed_count
     FROM plays WHERE started_at >= ? AND started_at < ?`,
    range.since,
    range.until
  );

  return {
    playCount: row?.play_count ?? 0,
    totalSeconds: row?.total_seconds ?? 0,
    distinctTracks: row?.distinct_tracks ?? 0,
    distinctArtists: row?.distinct_artists ?? 0,
    completedCount: row?.completed_count ?? 0,
  };
}

/**
 * The listens themselves, for the things a GROUP BY cannot answer.
 *
 * A chart's columns are local days and months, and SQLite only knows that
 * through `localtime`, which reads the device's zone at query time and would
 * put the whole calendar beyond the reach of a test. Reading the rows and
 * bucketing them in `stats/period.ts` keeps that arithmetic somewhere it can
 * be checked. Only three columns, and only one period's worth, so what comes
 * back is a few thousand numbers at the very outside.
 */
export function listens(range: Range = ALL_TIME): Listen[] {
  return db().getAllSync<Listen>(
    `SELECT started_at AS at, seconds_played AS seconds, completed
     FROM plays WHERE started_at >= ? AND started_at < ?
     ORDER BY started_at`,
    range.since,
    range.until
  );
}

/**
 * How often each track has been started, and how often it was seen through.
 *
 * One query for the whole library rather than one per track: the suggestion
 * engine asks about every candidate at once, and a track's habit of being
 * skipped is one of the few things that can be said about it without any tags
 * at all.
 */
export function playCounts(): Map<string, { plays: number; completed: number }> {
  const rows = db().getAllSync<{ track_id: string; plays: number; completed: number | null }>(
    `SELECT track_id, COUNT(*) AS plays, SUM(completed) AS completed
     FROM plays GROUP BY track_id`
  );

  const counts = new Map<string, { plays: number; completed: number }>();
  for (const row of rows) {
    counts.set(row.track_id, { plays: row.plays, completed: row.completed ?? 0 });
  }
  return counts;
}

/**
 * When each track was last listened to.
 *
 * One query for the whole library rather than one per track, for the same
 * reason {@link playCounts} is: the library screen wants to put every track it
 * is showing in order of this, and asking row by row would be a query per row
 * of a list being scrolled.
 *
 * Tracks that have never been played are simply absent, rather than present
 * with a zero. A track nobody has listened to has no last listen, and giving it
 * one at the beginning of time would file it as the most neglected thing in the
 * library instead of as something outside the question.
 */
export function lastPlayedAt(): Map<string, number> {
  const rows = db().getAllSync<{ track_id: string; at: number }>(
    `SELECT track_id, MAX(started_at) AS at FROM plays GROUP BY track_id`
  );

  const latest = new Map<string, number>();
  for (const row of rows) latest.set(row.track_id, row.at);
  return latest;
}

/** When the history starts, which is how wide a chart of all of it has to be. */
export function firstPlayAt(): number | null {
  const row = db().getFirstSync<{ first: number | null }>(
    `SELECT MIN(started_at) AS first FROM plays`
  );
  return row?.first ?? null;
}

export type TrackListening = {
  playCount: number;
  completedCount: number;
  totalSeconds: number;
  firstPlayed: number | null;
  lastPlayed: number | null;
};

/** What this one track's listening history adds up to. */
export function listeningFor(trackId: string): TrackListening {
  const row = db().getFirstSync<{
    play_count: number;
    completed_count: number;
    total_seconds: number | null;
    first_played: number | null;
    last_played: number | null;
  }>(
    `SELECT COUNT(*)            AS play_count,
            SUM(completed)      AS completed_count,
            SUM(seconds_played) AS total_seconds,
            MIN(started_at)     AS first_played,
            MAX(started_at)     AS last_played
     FROM plays WHERE track_id = ?`,
    trackId
  );

  return {
    playCount: row?.play_count ?? 0,
    completedCount: row?.completed_count ?? 0,
    totalSeconds: row?.total_seconds ?? 0,
    firstPlayed: row?.first_played ?? null,
    lastPlayed: row?.last_played ?? null,
  };
}

/**
 * `key` is what the row is grouped by and is unique within a list; `label` is
 * only what to call it. Two different tracks can share a title — a studio and a
 * live recording of the same song, the same song on two albums — and keying a
 * list on the title alone folds them into one row.
 */
export type TopEntry = {
  key: string;
  label: string;
  /** A second line where there is one to give — a track's artist. */
  detail?: string | null;
  playCount: number;
  totalSeconds: number;
  /**
   * A track this row can borrow a cover from.
   *
   * The row itself for a track; for an artist, whichever of theirs was played
   * most, because a picture of a name is not a thing that exists.
   */
  sample?: string | null;
};

export function topTracks(limit = 20, range: Range = ALL_TIME): TopEntry[] {
  return db().getAllSync<TopEntry>(
    // A track renamed part way through its history has more than one title in
    // the table, and which of them a bare `title` returns is SQLite's choice.
    // The most recent is the defensible one: it is what the track is called now.
    `SELECT track_id AS "key",
            track_id AS sample,
            (SELECT title FROM plays newest
             WHERE newest.track_id = plays.track_id
             ORDER BY started_at DESC, id DESC LIMIT 1) AS label,
            (SELECT artist FROM plays newest
             WHERE newest.track_id = plays.track_id
             ORDER BY started_at DESC, id DESC LIMIT 1) AS detail,
            COUNT(*) AS playCount,
            SUM(seconds_played) AS totalSeconds
     FROM plays WHERE started_at >= ? AND started_at < ?
     GROUP BY track_id
     ORDER BY playCount DESC, totalSeconds DESC
     LIMIT ?`,
    range.since,
    range.until,
    limit
  );
}

export function topArtists(limit = 20, range: Range = ALL_TIME): TopEntry[] {
  return db().getAllSync<TopEntry>(
    `SELECT artist AS "key",
            artist AS label,
            NULL   AS detail,
            COUNT(*) AS playCount,
            SUM(seconds_played) AS totalSeconds,
            (SELECT track_id FROM plays best
             WHERE best.artist = plays.artist
               AND best.started_at >= ? AND best.started_at < ?
             GROUP BY best.track_id
             ORDER BY COUNT(*) DESC, SUM(best.seconds_played) DESC LIMIT 1) AS sample
     FROM plays WHERE started_at >= ? AND started_at < ? AND artist IS NOT NULL
     GROUP BY artist
     ORDER BY playCount DESC, totalSeconds DESC
     LIMIT ?`,
    // The subquery takes the range as well, so an artist's cover comes from
    // what they were played for in this period rather than from ever.
    range.since,
    range.until,
    range.since,
    range.until,
    limit
  );
}
