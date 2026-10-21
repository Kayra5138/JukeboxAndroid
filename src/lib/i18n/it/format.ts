import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/*
  Italian writes the date day first with slashes, `23/09/2026`, groups the
  thousands with full stops and puts a comma before the decimals: `12.345,6`.
*/
const date = (value: Date) =>
  `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, '.'),
  decimal: (value, places = 1) => fixed(value, places, ',', '.'),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /* Italian has no letters the engine raises wrongly; accented ones (à, è) come out as À, È. */
  upper: (line) => line.toUpperCase(),
  /*
    Standalone labels under a chart, so capitalised as a label is; the year
    view shows only the first letter.
  */
  monthsShort: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
  weekdaysShort: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'],
};
