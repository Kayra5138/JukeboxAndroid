/**
 * The orders the tapes view can be in: the ones being listened to first —
 * the one listened to last at the top, then those not begun, then those
 * heard — by name, or by what came newest. Nothing here reads a setting.
 */
export type TapeSort = 'played' | 'name' | 'added';

const ORDERS: readonly TapeSort[] = ['played', 'name', 'added'];

/** The order a stored setting means; the ones being listened to first for anything else. */
export function asTapeSort(saved: string | null): TapeSort {
  return (ORDERS as readonly (string | null)[]).includes(saved) ? (saved as TapeSort) : 'played';
}

/** The order after [now] on the button. */
export function nextTapeSort(now: TapeSort): TapeSort {
  return ORDERS[(ORDERS.indexOf(now) + 1) % ORDERS.length]!;
}

/** Which of the tapes view's parts are shown: all of them, or the followed shows, the books or the other tapes alone. */
export type TapeFilter = 'all' | 'series' | 'books' | 'tapes';

const FILTERS: readonly TapeFilter[] = ['all', 'series', 'books', 'tapes'];

/** The part a stored setting means; all of them for anything else. */
export function asTapeFilter(saved: string | null): TapeFilter {
  return (FILTERS as readonly (string | null)[]).includes(saved) ? (saved as TapeFilter) : 'all';
}
