import { db } from '../db/index.ts';
import { newestFirst, securePicture, type Episode, type Show } from './episodes.ts';

/**
 * The podcasts somebody follows and what their feeds were last seen to hold,
 * in the database (`PODCASTS` in the migrations). Whether an episode has been
 * fetched is not here: it is the download queue's, by the episode's job.
 */
export type Subscription = Show & {
  feedUrl: string;
  subscribedAt: number;
  checkedAt: number | null;
  /** Whether new episodes are fetched by themselves. */
  autoDownload: boolean;
  /** How many of the newest are kept fetched, for one that fetches by itself. */
  keep: number;
  /** Whether the episodes after the one being listened to are fetched, for working through it from older ones. */
  fetchNext: boolean;
  /** How many after it, for one that fetches the next ones. */
  nextCount: number;
  /** The name of its folder of the Tapes folder: its name when it was followed, kept should it rename itself. */
  folder: string;
};

/** No more than this many episodes of a show are remembered: a feed of thousands is its newest few hundred. */
const EPISODES_KEPT = 400;

type Row = {
  feed_url: string;
  title: string;
  author: string | null;
  image: string | null;
  summary: string | null;
  subscribed_at: number;
  checked_at: number | null;
  auto_download: number;
  keep: number;
  fetch_next: number;
  next_count: number;
  folder: string | null;
};

const subscriptionOf = (row: Row): Subscription => ({
  feedUrl: row.feed_url,
  title: row.title,
  author: row.author,
  image: securePicture(row.image),
  summary: row.summary,
  subscribedAt: row.subscribed_at,
  checkedAt: row.checked_at,
  autoDownload: row.auto_download === 1,
  keep: row.keep,
  fetchNext: row.fetch_next === 1,
  nextCount: row.next_count,
  folder: row.folder ?? row.title,
});

export function subscriptions(): Subscription[] {
  return db().getAllSync<Row>('SELECT * FROM podcasts ORDER BY title COLLATE NOCASE').map(subscriptionOf);
}

export function subscription(feedUrl: string): Subscription | null {
  const row = db().getFirstSync<Row>('SELECT * FROM podcasts WHERE feed_url = ?', feedUrl);
  return row ? subscriptionOf(row) : null;
}

export function subscribe(feedUrl: string, show: Show, at: number): void {
  db().runSync(
    `INSERT INTO podcasts (feed_url, title, author, image, summary, subscribed_at, checked_at, folder)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(feed_url) DO UPDATE SET title = excluded.title, author = excluded.author, image = excluded.image, summary = excluded.summary`,
    feedUrl,
    show.title,
    show.author,
    show.image,
    show.summary,
    Math.round(at),
    Math.round(at),
    show.title
  );
}

/** Followed no longer. What was fetched of it stays, as files are not taken away unasked. */
export function unsubscribe(feedUrl: string): void {
  const database = db();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM podcasts WHERE feed_url = ?', feedUrl);
    database.runSync('DELETE FROM podcast_episodes WHERE feed_url = ?', feedUrl);
  });
}

export function setAutoDownload(feedUrl: string, on: boolean): void {
  db().runSync('UPDATE podcasts SET auto_download = ? WHERE feed_url = ?', on ? 1 : 0, feedUrl);
}

export function setFetchNext(feedUrl: string, on: boolean): void {
  db().runSync('UPDATE podcasts SET fetch_next = ? WHERE feed_url = ?', on ? 1 : 0, feedUrl);
}

/** How many episodes after the one being listened to are fetched, for one that fetches the next ones. */
export function setNextCount(feedUrl: string, count: number): void {
  db().runSync('UPDATE podcasts SET next_count = ? WHERE feed_url = ?', Math.min(KEEP_RANGE.max, Math.max(KEEP_RANGE.min, Math.round(count))), feedUrl);
}

/** How many of the newest episodes a podcast that fetches by itself may keep fetched. */
export const KEEP_RANGE = { min: 1, max: 10 } as const;

export function setKeep(feedUrl: string, keep: number): void {
  db().runSync('UPDATE podcasts SET keep = ? WHERE feed_url = ?', Math.min(KEEP_RANGE.max, Math.max(KEEP_RANGE.min, Math.round(keep))), feedUrl);
}

/** The show's details as its feed now has them, and that it was looked at. */
export function noteChecked(feedUrl: string, show: Show, at: number): void {
  db().runSync(
    'UPDATE podcasts SET title = ?, author = ?, image = ?, summary = ?, checked_at = ? WHERE feed_url = ?',
    show.title,
    show.author,
    show.image,
    show.summary,
    Math.round(at),
    feedUrl
  );
}

/** The guids of the episodes of [feedUrl] seen before. */
export function knownGuids(feedUrl: string): Set<string> {
  return new Set(
    db().getAllSync<{ guid: string }>('SELECT guid FROM podcast_episodes WHERE feed_url = ?', feedUrl).map((row) => row.guid)
  );
}

/** [episodes] remembered as seen, and the oldest past what is kept let go. */
export function saveEpisodes(feedUrl: string, episodes: readonly Episode[], at: number): void {
  const database = db();
  database.withTransactionSync(() => {
    // The newest of them, whichever way round the feed lists them: a serial listed from its first episode keeps its last.
    for (const episode of newestFirst(episodes).slice(0, EPISODES_KEPT)) {
      database.runSync(
        `INSERT INTO podcast_episodes (feed_url, guid, title, url, published_at, duration_sec, image, summary, chapters_url, transcript_url, transcript_type, seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(feed_url, guid) DO UPDATE SET title = excluded.title, url = excluded.url,
           published_at = excluded.published_at, duration_sec = excluded.duration_sec, image = excluded.image, summary = excluded.summary,
           chapters_url = excluded.chapters_url, transcript_url = excluded.transcript_url, transcript_type = excluded.transcript_type`,
        feedUrl,
        episode.guid,
        episode.title,
        episode.url,
        episode.publishedAt,
        episode.durationSec,
        episode.image,
        episode.summary,
        episode.chaptersUrl ?? null,
        episode.transcriptUrl ?? null,
        episode.transcriptType ?? null,
        Math.round(at)
      );
    }
    database.runSync(
      `DELETE FROM podcast_episodes WHERE feed_url = ? AND guid NOT IN (
         SELECT guid FROM podcast_episodes WHERE feed_url = ? ORDER BY published_at DESC LIMIT ?)`,
      feedUrl,
      feedUrl,
      EPISODES_KEPT
    );
  });
}

/** The episodes of [feedUrl] as last seen, newest first. */
export function savedEpisodes(feedUrl: string): Episode[] {
  return db()
    .getAllSync<{
      guid: string;
      title: string;
      url: string;
      published_at: number | null;
      duration_sec: number | null;
      image: string | null;
      summary: string | null;
      chapters_url: string | null;
      transcript_url: string | null;
      transcript_type: string | null;
    }>(
      `SELECT guid, title, url, published_at, duration_sec, image, summary, chapters_url, transcript_url, transcript_type
       FROM podcast_episodes WHERE feed_url = ? ORDER BY published_at DESC`,
      feedUrl
    )
    .map((row) => ({
      guid: row.guid,
      title: row.title,
      url: row.url,
      publishedAt: row.published_at,
      durationSec: row.duration_sec,
      image: securePicture(row.image),
      summary: row.summary,
      chaptersUrl: row.chapters_url,
      transcriptUrl: row.transcript_url,
      transcriptType: row.transcript_type,
    }));
}
