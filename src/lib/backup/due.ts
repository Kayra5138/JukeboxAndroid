import { wholeIn, type Range } from '../ui/range.ts';

/**
 * When an automatic backup falls due, and what its settings are read as.
 *
 * Apart from `auto.ts`, which does the backing up, so that the decision can
 * be tested on a desk: nothing here asks the phone for anything.
 */

/** How often one is made. */
export type Every = 'daily' | 'weekly';

export const DEFAULT_EVERY: Every = 'weekly';

/** How many are kept in the folder: any number from one to a month of days. */
export const KEEP_RANGE: Range = { min: 1, max: 30 };
export const DEFAULT_KEEP = 5;

const HOUR = 60 * 60 * 1000;
const INTERVAL: Record<Every, number> = { daily: 24 * HOUR, weekly: 7 * 24 * HOUR };

/*
  How much sooner than a whole day or week one is made anyway. The phone runs
  a task with the app closed when it suits the phone, not on the minute, and
  opening the app is not on the minute either: without some give, a backup
  made at nine one evening would not be due at eight the next and would wait
  for the next chance, and the days would creep later and later.
*/
const EARLY = 4 * HOUR;

/** The stored choice of how often, or the default where there is none or it is not one. */
export function everyOf(stored: string | null): Every {
  return stored === 'daily' || stored === 'weekly' ? stored : DEFAULT_EVERY;
}

/** The stored number to keep, or the default where there is none or it is out of range. */
export function keepOf(stored: string | null): number {
  return wholeIn(stored, KEEP_RANGE) ?? DEFAULT_KEEP;
}

/** When the last was made, in milliseconds, or null where none has been or what is stored is not a time. */
export function lastOf(stored: string | null): number | null {
  if (stored == null || stored.trim() === '') return null;
  const at = Number(stored);
  return Number.isFinite(at) && at > 0 ? at : null;
}

/**
 * Whether one is due at [now], the last having been made at [last].
 *
 * With none made yet it is due at once. A last one later than now means the
 * phone's clock was put back since; one more backup costs a file in a folder
 * that keeps only so many, where waiting for the clock to catch up could cost
 * weeks of them, so it is due then too.
 */
export function isDue(last: number | null, every: Every, now: number): boolean {
  if (last == null) return true;
  if (last > now) return true;
  return now - last >= INTERVAL[every] - EARLY;
}
