import { strings, type Strings } from '../i18n/languages.ts';

/**
 * Dates written day first: `23/09/2026`.
 *
 * Spelled out rather than left to `toLocaleString`, which reads the order off
 * the device's locale and on this phone settles on the American month-first
 * one — so a build made on the twenty-third of September was shown as 9/23.
 * The order is a choice the app makes, not something to be inherited, and
 * writing it out also keeps it away from Intl, whose support on React Native's
 * engine has never been something to lean on.
 *
 * How it is spelled now belongs to the language — Turkish puts full stops
 * where English puts strokes — so the writing itself is in each language's
 * `format`, and these are the way to it for anything holding a date and not a
 * table. [t] is as it is everywhere: a screen passes the one `useT()` gave it,
 * or simply calls `t.format.date` itself.
 */
export function formatDate(date: Date, t: Strings = strings()): string {
  return t.format.date(date);
}

/** The same, with the time of day: `23/09/2026 14:05`. */
export function formatDateTime(date: Date, t: Strings = strings()): string {
  return t.format.dateTime(date);
}
