import type { Track } from '../types.ts';
import { FILE_MISSING, type Item, type Kept, type Song, type Staged } from './core.ts';
import { NO_MATCH_CODE, WAITING_WIFI, isNoMatch, isWaitingWifi } from './policy.ts';

/**
 * A song as the catalogue hands it over.
 *
 * The rest are what a song on the list used to carry, when the list and the
 * pool were made of the same thing. Nothing sets them now; they are here so
 * that a list written by a version from before can be read: see `migrated`.
 */
export type Entry = Song & {
  jobId?: string;
  track?: Track;
  error?: string;
  errorCode?: string;
};

/** The list as an earlier version wrote it: songs that carried their own job, file and error, and the pool beside them. */
type Before = {
  entries?: Entry[];
  pool?: Entry[];
  refreshedAt?: number;
  retired?: string[];
  pending?: Entry[];
};

/**
 * A list written by a version from before, as it is kept now.
 *
 * A song's error was kept as the sentence it was told, in the language of
 * the day it failed. What it meant is read back out of it where it can be —
 * the code beside it, or the two sentences that were ever recognised by
 * their wording — and the sentence is then dropped. A song whose failure
 * cannot be named is left with none: it is tapped, and says again.
 *
 * A new list that was being got ready is carried over as one still being got
 * ready. It used to wait for every song; it now waits for the first few, so
 * it will most likely be shown the first time it is looked at.
 */
export function migrated(value: unknown, now: number): Kept {
  const before = (value ?? {}) as Before;
  const song = (entry: Entry): Song => {
    const { jobId: _job, track: _track, error: _error, errorCode: _code, ...rest } = entry;
    return rest;
  };
  const item = (entry: Entry): Item => {
    const made: Item = { id: entry.recordingMbid, song: song(entry), addedAt: now };
    if (entry.jobId) made.jobId = entry.jobId;
    if (entry.track) made.track = entry.track;
    else if (isNoMatch(entry.error)) made.failure = { code: NO_MATCH_CODE, at: now };
    else if (isWaitingWifi(entry)) made.failure = { code: WAITING_WIFI, at: now };
    else if (entry.errorCode) made.failure = { code: entry.errorCode, at: now };
    else if (entry.error && entry.jobId) made.failure = { code: FILE_MISSING, at: now };
    return made;
  };
  const listed = (entries: Entry[] | undefined) =>
    (Array.isArray(entries) ? entries : []).filter((entry) => entry && typeof entry.recordingMbid === 'string').map(item);
  const pending = listed(before.pending);
  const staged: Staged | null = pending.length ? { items: pending, since: now } : null;
  return {
    list: listed(before.entries),
    staged,
    pool: (Array.isArray(before.pool) ? before.pool : []).map(song),
    refreshedAt: before.refreshedAt ?? 0,
    retired: Array.isArray(before.retired) ? before.retired : [],
    attemptAt: 0,
    problem: null,
    fruitlessAt: 0,
  };
}
