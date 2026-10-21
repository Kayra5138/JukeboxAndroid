import { format } from './format.ts';

/**
 * Which of three wordings a Russian count takes.
 *
 * Russian tells three cases apart after a whole number, and goes by its last
 * one or two digits rather than by its size:
 *
 * - one: 1, 21, 31, 101 … but not 11 — «1 трек», «21 трек»;
 * - few: 2–4, 22–24, 102 … but not 12–14 — «2 трека», «24 трека»;
 * - many: 0, 5–20, 25–30, 11–14, 111 … — «5 треков», «11 треков».
 *
 * A number with a fractional part takes the `few` wording («2,5 трека»).
 * This is the language's own chooser, kept here and not in `write.ts`:
 * see the note on `oneOrMany` there.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(count)) return few;
  const n = Math.abs(count);
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** The number written the Russian way, and the noun in the form it takes after it: «1 234 трека». */
export const counted = (count: number, one: string, few: string, many: string) =>
  `${format.number(count)} ${plural(count, one, few, many)}`;
