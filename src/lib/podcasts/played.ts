import type { TapePlace } from '../tapes/places.ts';
import { folderKey } from '../media/folders.ts';
import { wholeIn, type Range } from '../ui/range.ts';

/**
 * Which episodes of the followed podcasts have been heard to the end long
 * enough ago to go, for somebody who would rather not keep what they have
 * heard. Episodes of followed shows only: a book, or anything else put in the
 * Tapes folder, is never taken away unasked. Nothing here reads anything, so
 * it can be tested; see `cleanup.ts` for the taking away.
 */

/** How many days after it was heard an episode may wait, at most a month. */
export const DELETE_DAYS_RANGE: Range = { min: 1, max: 30 };

/** The days a stored setting means; null for never, which is anything that is not a number of days. */
export function deleteDaysFrom(saved: string | null): number | null {
  return wholeIn(saved, DELETE_DAYS_RANGE);
}

const DAY = 24 * 60 * 60 * 1000;

/** Of [tapes], the ones in a followed show's folder of [seriesFolders] heard to the end more than [days] days before [now]. */
export function playedLongAgo<T extends { id: string; folder?: string | null }>(
  tapes: readonly T[],
  places: ReadonlyMap<string, TapePlace>,
  seriesFolders: ReadonlySet<string>,
  days: number,
  now: number
): T[] {
  return tapes.filter((tape) => {
    const place = places.get(tape.id);
    if (!place?.finished || now - place.at < days * DAY) return false;
    return seriesFolders.has(folderKey(tape.folder ?? '').toLocaleLowerCase());
  });
}
