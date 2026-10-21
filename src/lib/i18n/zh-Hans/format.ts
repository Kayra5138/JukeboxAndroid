import type { Strings } from '../en/index.ts';
import { fixed, grouped, pad2 } from '../write.ts';

/**
 * Simplified Chinese writes the year first, `2026/09/23`, and groups the
 * thousands with commas and the decimals with a point, as English does:
 * `12,345`, `1,234.5`.
 */
const date = (value: Date) =>
  `${value.getFullYear()}/${pad2(value.getMonth() + 1)}/${pad2(value.getDate())}`;

export const format: Strings['format'] = {
  number: (value) => grouped(value, ','),
  decimal: (value, places = 1) => fixed(value, places, '.', ','),
  date,
  dateTime: (value) => `${date(value)} ${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  /*
    Chinese characters have no capitals, so a heading in them is left as it
    is. Latin letters inside one (ListenBrainz, YouTube) are raised as the
    English ones are, so that a heading of mixed text still reads as a heading.
  */
  upper: (line) => line.toUpperCase(),
  /*
    The year chart labels each month by its number alone, `10` for `10月`
    (`narrowMonth` in `lib/stats/period.ts`).
  */
  monthsShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  weekdaysShort: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
};
