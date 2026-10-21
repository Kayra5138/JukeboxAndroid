import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/**
 * French groups the thousands with a narrow no-break space and marks the
 * decimals with a comma: `12 345`, `1 234,5`. The date is day first with
 * slashes, `23/09/2026`, and the time is on the 24-hour clock, `14:05`, which
 * reads naturally in France and in Canada alike.
 */
const date = (value: Date) =>
  `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, ' '),
  decimal: (value, places = 1) => fixed(value, places, ',', ' '),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /*
    French keeps its accents on capitals (É, À, Ç), and the engine's own
    capitals do that already.
  */
  upper: (line) => line.toUpperCase(),
  /*
    Capitalised because they stand alone as labels on a chart, and a year's
    worth is cut to the first letter. Abbreviated the usual French way, with a
    full stop wherever letters were dropped.
  */
  monthsShort: ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'],
  weekdaysShort: ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'],
};
