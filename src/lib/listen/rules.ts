import type { DownloadJob } from '../youtube/types.ts';

/**
 * The rules of listening without keeping, apart from the asking so that they
 * can be tested: which track is one, whose job it came from, and which have
 * stayed long enough. See `index.ts`.
 */

/** What a song listened to and not kept is known by in the player and the history: its job's id after this. */
export const LISTEN_PREFIX = 'listen:';

export const isListened = (trackId: string | null | undefined): boolean => !!trackId && trackId.startsWith(LISTEN_PREFIX);

/** The job a song listened to came from, or null for any other track. */
export function listenJobOf(trackId: string): string | null {
  if (!isListened(trackId)) return null;
  const id = trackId.slice(LISTEN_PREFIX.length);
  return /^[a-fA-F0-9-]{36}$/.test(id) ? id : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Of [jobs], the songs listened to and fetched more than [days] ago, by their
 * jobs: what is let go. Only those that came in; one still on its way, or
 * that failed, is the queue's to deal with.
 */
export function listenDue(jobs: readonly DownloadJob[], days: number, now: number): string[] {
  return jobs
    .filter((job) => job.video.listen === true && job.status === 'done' && job.finishedAt != null && now - job.finishedAt > days * DAY_MS)
    .map((job) => job.id);
}
