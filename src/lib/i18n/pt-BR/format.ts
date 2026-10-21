import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/**
 * How Brazilian Portuguese writes numbers and dates: the day first with
 * slashes, `23/09/2026`, thousands marked with full stops and decimals with a
 * comma, `12.345,6`.
 */
const date = (value: Date) =>
  `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, '.'),
  decimal: (value, places = 1) => fixed(value, places, ',', '.'),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /* Portuguese has no letter whose capital the engine gets wrong: á, ç, õ rise as they should. */
  upper: (line) => line.toUpperCase(),
  /*
    Capitalised, because they stand alone as the labels under a chart, and the
    chart also takes the first letter of each on its own.
  */
  monthsShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  weekdaysShort: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
};
