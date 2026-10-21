import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/*
  Russian writes the thousands apart with a space and the decimals after a
  comma: «12 345», «1 234,5». The space is a no-break one (U+00A0), so that a
  number is never split across two lines. The date is day first with full
  stops, «23.09.2026», and the time follows it on the 24-hour clock.
*/
const SPACE = '\u00A0';

const date = (value: Date) =>
  `${pad2(value.getDate())}.${pad2(value.getMonth() + 1)}.${value.getFullYear()}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, SPACE),
  decimal: (value, places = 1) => fixed(value, places, ',', SPACE),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /* Cyrillic has no letter whose capital depends on the language, ё included. */
  upper: (line) => line.toUpperCase(),
  /*
    Three letters each, as charts and calendars abbreviate them; the year
    chart takes the first letter alone. Standalone, so in the nominative.
  */
  monthsShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  weekdaysShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
};
