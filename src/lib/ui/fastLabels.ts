import { canonicalLabel } from '../metadata/text.ts';

/**
 * What the fast scroller's bubble says of a place in a list: the letter a
 * name begins with, the month a date falls in, or a count.
 */

/** The letters of the alphabet the library is ordered by (`media/sort.ts`), each filed as itself. */
const OWN = /^[a-zçğıöşü]$/u;

/**
 * The letter [name] is filed under in the library's order, upper case; `#`
 * for one that starts with anything else -- a digit, a bracket, a quote --
 * all of which that order puts before the letters, together. A letter with
 * an accent the alphabet does not have is filed as the letter under it, as
 * the order files it: `Écho` among the E's, not under a heading of its own
 * between two of theirs.
 */
export function letterLabel(name: string | null | undefined): string {
  const first = [...canonicalLabel(name ?? '')][0];
  if (!first || !/\p{L}/u.test(first)) return '#';
  const bare = first.normalize('NFD')[0] ?? first;
  return (OWN.test(first) || !OWN.test(bare) ? first : bare).toUpperCase();
}

/** `Mar 2025` for a time in milliseconds, in the months given; a dash for none. */
export function monthLabel(at: number | null | undefined, months: readonly string[]): string {
  if (!at) return '—';
  const when = new Date(at);
  return `${months[when.getMonth()] ?? ''} ${when.getFullYear()}`;
}

/** The latest of [values], or null where there are none. */
export function latest(values: Iterable<number | null | undefined>): number | null {
  let most: number | null = null;
  for (const value of values) if (value != null && (most == null || value > most)) most = value;
  return most;
}
