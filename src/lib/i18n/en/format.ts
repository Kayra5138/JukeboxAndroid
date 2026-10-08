import { fixed, grouped, pad2 } from '../write.ts';

/**
 * How English writes numbers and dates.
 *
 * The date is day first, `23/09/2026`, which was a choice made before there
 * was a second language: see `lib/format/date.ts` for why it is not left to
 * the phone.
 */
const date = (value: Date) =>
  `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;

export const format = {
  /** A whole number: `12,345`. */
  number: (value: number) => grouped(value, ','),
  /** A number with decimal places, one unless told otherwise: `1,234.5`. */
  decimal: (value: number, places: number = 1) => fixed(value, places, '.', ','),
  date,
  /** The date with the time of day: `23/09/2026 14:05`. */
  dateTime: (value: Date) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /**
   * Capitals, for the small headings above a section.
   *
   * Done here and not by `textTransform: 'uppercase'` in a style, because
   * Android capitalises by the phone's language and the app's is chosen in
   * the app: Turkish headings on an English phone lost the dot of their İ,
   * and English ones on a Turkish phone gained it. A language with letters
   * of its own says how they are raised.
   */
  upper: (line: string) => line.toUpperCase(),
  /** January first. */
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  /** Monday first, the way the week is drawn. */
  weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};
