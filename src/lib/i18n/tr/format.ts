import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/** Turkish writes the date with full stops and the thousands with them too: `23.09.2026`, `12.345`. */
const date = (value: Date) =>
  `${pad2(value.getDate())}.${pad2(value.getMonth() + 1)}.${value.getFullYear()}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, '.'),
  decimal: (value, places = 1) => fixed(value, places, ',', '.'),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /*
    Turkish has two letters i, and the engine's own capitals know of one: left
    to it, "dinlenme" comes out as DINLENME. Both are changed by hand first.
  */
  upper: (line) => line.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase(),
  monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  weekdaysShort: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
};
