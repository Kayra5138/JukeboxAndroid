import type { Strings } from '../en/index.ts';
import { fixed, pad2 } from '../write.ts';

/*
  Spanish writes the decimals with a comma and the thousands with a full stop:
  `12.345`, `1.234,5`. A number of four figures is left unbroken, `1234`, as
  the RAE and the CLDR data for Spanish both have it; the stop only appears
  from five figures up. The date is day first with slashes, `23/09/2026`.
*/
const groupedWhole = (digits: string) =>
  digits.length > 4 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : digits;

const date = (value: Date) =>
  `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;

export const format: Strings['format'] = {
  number: (value) => {
    const rounded = Math.round(value);
    const digits = groupedWhole(String(Math.abs(rounded)));
    return rounded < 0 ? `-${digits}` : digits;
  },
  decimal: (value, places = 1) =>
    fixed(value, places, ',', '').replace(/^(-?)(\d+)/, (_, sign: string, whole: string) => sign + groupedWhole(whole)),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /* The engine's own capitals are right for Spanish: ñ to Ñ, and accents kept (Á, É). */
  upper: (line) => line.toUpperCase(),
  /*
    Capitalised, because they stand alone as chart labels and in a title
    (`Sept 2026`); the year chart takes the first letter of each, E F M A M J J
    A S O N D, which is how Spanish abbreviates the months to one letter.
  */
  monthsShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'],
  weekdaysShort: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
};
