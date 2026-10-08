import { db } from './index.ts';
import { rangeOf } from '../stats/period.ts';

/**
 * Lists nobody made, read out of what has actually been listened to.
 *
 * They are queries rather than rows: there is nothing to keep in step, nothing
 * to go stale, and no way for one to disagree with the history it came from.
 * The cost is that they cannot be reordered or pruned — which is right, since
 * they are not anybody's choices. A list you want to edit is a list you should
 * have made.
 */
export type AutoListId = 'mostPlayed' | 'recentlyFound' | 'forgotten' | 'skipped';

/**
 * In the order they are shown.
 *
 * What each is called, and the line under its name, are `lists.auto` in the
 * string tables under these same ids: Most played, New this month, Forgotten,
 * Skipped most.
 */
export const AUTO_LISTS: readonly AutoListId[] = [
  'mostPlayed',
  'recentlyFound',
  'forgotten',
  'skipped',
];

/** Long enough that not hearing something is a lapse rather than a gap. */
const FORGOTTEN_AFTER_MONTHS = 6;

/** Below this, not playing something for six months is not much of a story. */
const FORGOTTEN_MINIMUM_PLAYS = 5;

/** Past this a list stops being a list and starts being the library again. */
const LIMIT = 100;

export function autoListTrackIds(id: AutoListId, now: number): string[] {
  switch (id) {
    case 'mostPlayed':
      return ids(
        `SELECT track_id FROM plays
         GROUP BY track_id
         ORDER BY COUNT(*) DESC, SUM(seconds_played) DESC
         LIMIT ?`,
        LIMIT
      );

    case 'recentlyFound':
      // Judged by the first time a track was ever played, not the last: this
      // is what turned up this month, not what happened to be on this month.
      return ids(
        `SELECT track_id FROM plays
         GROUP BY track_id
         HAVING MIN(started_at) >= ?
         ORDER BY MIN(started_at) DESC
         LIMIT ?`,
        rangeOf('month', now).since,
        LIMIT
      );

    case 'forgotten':
      return ids(
        `SELECT track_id FROM plays
         GROUP BY track_id
         HAVING COUNT(*) >= ? AND MAX(started_at) < ?
         ORDER BY COUNT(*) DESC
         LIMIT ?`,
        FORGOTTEN_MINIMUM_PLAYS,
        monthsBefore(now, FORGOTTEN_AFTER_MONTHS),
        LIMIT
      );

    case 'skipped':
      /*
        Twice, at least. Pressing next once can mean nothing more than being
        in the wrong mood, and a list of every track that ever happened to be
        skipped is most of the library — which is to say, not a list.

        Ordered by how often, then by how soon: of two tracks each walked out
        on five times, the one never heard past the opening bar is the one the
        list is really about.
      */
      return ids(
        `SELECT track_id FROM skips
         GROUP BY track_id
         HAVING COUNT(*) >= ?
         ORDER BY COUNT(*) DESC, AVG(seconds_played) ASC
         LIMIT ?`,
        SKIPPED_AT_LEAST,
        LIMIT
      );
  }
}

/** Below this, pressing next is a mood rather than an opinion. */
const SKIPPED_AT_LEAST = 2;

/**
 * [months] before [now], by the calendar rather than by arithmetic.
 *
 * Six months is not a hundred and eighty days, and the difference shows up as
 * a list that quietly changes what it means depending on which months it
 * happens to be spanning.
 */
function monthsBefore(now: number, months: number): number {
  const date = new Date(now);
  date.setMonth(date.getMonth() - months);
  return +date;
}

function ids(sql: string, ...parameters: (string | number)[]): string[] {
  return db()
    .getAllSync<{ track_id: string }>(sql, ...parameters)
    .map((row) => row.track_id);
}
