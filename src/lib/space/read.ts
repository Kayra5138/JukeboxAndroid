import { db } from '../db/index.ts';
import { downloads } from '../youtube/native.ts';
import { tallySkips, type Listening, type Membership } from './candidates.ts';

/**
 * What the rules in `candidates.ts` are handed, read: the history of every
 * track, the lists each is in, and which files the app downloaded itself.
 * Each one query for the whole library, never one per track. These throw
 * where the database will not answer; whoever calls decides what that means,
 * and the deleting by itself takes it to mean nothing is deleted.
 */

/** How often each track was listened to, heard through and skipped, and when it was last listened to. */
export function readListening(): Map<string, Listening> {
  const database = db();
  const listening = new Map<string, Listening>();
  const plays = database.getAllSync<{ track_id: string; plays: number; completed: number | null; at: number | null }>(
    `SELECT track_id, COUNT(*) AS plays, SUM(completed) AS completed, MAX(started_at) AS at
     FROM plays GROUP BY track_id`
  );
  for (const row of plays) {
    listening.set(row.track_id, { plays: row.plays, completed: row.completed ?? 0, skips: 0, lateSkips: 0, skippedAfter: null, lastPlayedAt: row.at });
  }
  const skips = database.getAllSync<{ track_id: string; seconds_played: number | null; duration_sec: number | null }>(
    'SELECT track_id, seconds_played, duration_sec FROM skips'
  );
  const tally = tallySkips(
    skips.map((row) => ({ trackId: row.track_id, secondsPlayed: row.seconds_played ?? 0, durationSec: row.duration_sec }))
  );
  for (const [id, heard] of tally) {
    const held = listening.get(id);
    if (held) Object.assign(held, heard);
    else listening.set(id, { plays: 0, completed: 0, lastPlayedAt: null, ...heard });
  }
  return listening;
}

/** The lists one track is in: whether Favorites is one, and the names of the others in the order of the Lists tab. */
export type ListsOf = { favorite: boolean; names: string[] };

/**
 * The lists each track is in, chosen ones only.
 *
 * A list made from a tag holds whatever has the tag today, and nobody put
 * the song in it: being in one says nothing about wanting to keep it, and it
 * is not counted.
 */
export function readLists(): Map<string, ListsOf> {
  const rows = db().getAllSync<{ track_id: string; name: string; kind: string | null }>(
    `SELECT t.track_id, p.name, p.kind
     FROM playlist_tracks t JOIN playlists p ON p.id = t.playlist_id
     WHERE p.tag IS NULL
     ORDER BY COALESCE(p.used_at, p.updated_at) DESC, p.id DESC`
  );
  const lists = new Map<string, ListsOf>();
  for (const row of rows) {
    const held = lists.get(row.track_id) ?? { favorite: false, names: [] };
    if (row.kind === 'favorites') held.favorite = true;
    else if (!held.names.includes(row.name)) held.names.push(row.name);
    lists.set(row.track_id, held);
  }
  return lists;
}

/** The same, as the deleting by itself asks it. */
export function membershipOf(lists: ReadonlyMap<string, ListsOf>): Map<string, Membership> {
  return new Map([...lists].map(([id, held]) => [id, { favorite: held.favorite, lists: held.names.length }]));
}

/**
 * The tracks the app downloaded itself: those the download queue finished
 * fetching and still names. A file copied over from a computer, or saved by
 * any other app, is not among them, and the phone would not let the app
 * delete it unasked anyway. None where there is no queue to ask.
 */
export async function readOwnTracks(): Promise<Set<string>> {
  if (!downloads) return new Set();
  const jobs = await downloads.getJobsAsync(false);
  return new Set(jobs.flatMap((job) => (job.status === 'done' && job.trackId ? [job.trackId] : [])));
}
