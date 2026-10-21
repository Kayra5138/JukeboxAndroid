import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/**
 * German puts a space between a number and its unit or a percent sign —
 * `12 %`, `4 h 12 min`, `2,5 s` — and that space must not break a line. This
 * is the narrow one, which keeps the figures as tight as the English ones in
 * the cards and chips they sit in.
 */
export const NNBSP = ' ';

/**
 * A figure the code hands over as a plain number, written with a decimal
 * comma: `0.25` becomes `0,25`. Whole numbers are left as they are, without
 * a thousands point, because these are amounts a person may type back in.
 */
export const comma = (value: number) => String(value).replace('.', ',');

/** German writes the date with full stops and the thousands with them too: `23.09.2026`, `12.345`. */
const date = (value: Date) =>
  `${pad2(value.getDate())}.${pad2(value.getMonth() + 1)}.${value.getFullYear()}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, '.'),
  decimal: (value, places = 1) => fixed(value, places, ',', '.'),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /*
    ß has no everyday capital: in capitals it is written SS. It is changed by
    hand first rather than trusting the engine's own mapping to know that.
  */
  upper: (line) => line.replace(/ß/g, 'SS').toUpperCase(),
  /** Three letters without a full stop, as calendars and charts write them. */
  monthsShort: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  /** Monday first; the two-letter forms are the standard German ones. */
  weekdaysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
};
