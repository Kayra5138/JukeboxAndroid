import { lastPlayedAt, playCounts, skipCounts } from '../db/history.ts';
import { isTape } from '../tapes/tape.ts';
import { readSmartRules, smartListIds, type SmartRules, type SmartStats, type SmartTrack } from './smart.ts';

/**
 * Smart lists against the real library and history: `smart.ts` with the
 * database behind it.
 */

/** What has been listened to, for the rules that ask: three queries for the whole library. */
export function readSmartStats(): SmartStats {
  const counts = playCounts();
  return {
    plays: new Map([...counts].map(([id, entry]) => [id, entry.plays])),
    lastPlayed: lastPlayedAt(),
    skips: skipCounts(),
  };
}

/**
 * The songs of [library] a smart list of [rules] holds, in its order.
 *
 * Songs only: a tape, a book's part or an episode, is in no list, whatever
 * the rules would say of it. [rules] may be as they are kept, which are read
 * here; [stats] may be given by a caller that asks again and again, as the
 * editor does with each change, rather than read from the database each time.
 */
export function smartListTracks<T extends SmartTrack & { folder?: string | null }>(
  library: readonly T[],
  rules: SmartRules | string | null,
  stats: SmartStats = readSmartStats(),
  now: number = Date.now()
): T[] {
  const songs = library.filter((track) => !isTape(track));
  const byId = new Map(songs.map((track) => [track.id, track]));
  const asked = typeof rules === 'string' || rules == null ? readSmartRules(rules) : rules;
  return smartListIds(songs, asked, stats, now).flatMap((id) => {
    const track = byId.get(id);
    return track ? [track] : [];
  });
}
