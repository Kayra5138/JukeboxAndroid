import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/**
 * How Japanese writes numbers and dates: thousands with a comma and decimals
 * with a point, as in English; the date year first with slashes, `2026/09/23`,
 * which is the compact form Japanese screens use where the English shows
 * `23/09/2026`.
 */
const date = (value: Date) =>
  `${value.getFullYear()}/${pad2(value.getMonth() + 1)}/${pad2(value.getDate())}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, ','),
  decimal: (value, places = 1) => fixed(value, places, '.', ','),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /*
    Japanese has no capitals, and Japanese headings are not raised: a section
    heading here is written as it is. The line is left alone rather than run
    through `toUpperCase`, which would raise only the Latin in it — a brand
    such as ListenBrainz, or an album's own name in a disc heading — and turn
    full-width letters into capitals no Japanese screen would show.
  */
  upper: (line) => line,
  monthsShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  weekdaysShort: ['月', '火', '水', '木', '金', '土', '日'],
};
