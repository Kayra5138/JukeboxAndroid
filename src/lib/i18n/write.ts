/**
 * What the language files are written with.
 *
 * Numbers and dates are put together by hand here rather than asked of `Intl`.
 * React Native's engine has `Intl.NumberFormat` and `Intl.DateTimeFormat` on
 * Android, but it has no `Intl.PluralRules` and no `Intl.DisplayNames` at all,
 * and what the two it does have answer depends on the locale data of the phone
 * they are running on. The app's language is chosen in the app, not inherited
 * from the phone, so each language says for itself how it writes a number —
 * and the same lines can then be checked on a desk, where there is no phone.
 */

export const pad2 = (value: number) => String(value).padStart(2, '0');

/** A whole number with its thousands marked off: `12,345` or `12.345`. */
export function grouped(value: number, separator: string): string {
  const rounded = Math.round(value);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return rounded < 0 ? `-${digits}` : digits;
}

/** A number to a fixed count of decimal places: `1,234.5` or `1.234,5`. */
export function fixed(value: number, places: number, point: string, separator: string): string {
  const [whole, fraction] = Math.abs(value).toFixed(places).split('.');
  const digits = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  const sign = value < 0 && Number(Math.abs(value).toFixed(places)) !== 0 ? '-' : '';
  return fraction ? `${sign}${digits}${point}${fraction}` : `${sign}${digits}`;
}

/**
 * One of two wordings, for a language that tells one from many and nothing
 * else: English, German, Spanish.
 *
 * Deliberately not something every language file reaches for. Turkish does not
 * change a noun after a number at all and writes one wording; Russian and
 * Polish tell apart more cases than two and need a chooser of their own, kept
 * in their own folder. What a count does to a sentence is the language's
 * business, which is why the tables hold functions rather than this being
 * done once for everybody at the place the count is known.
 */
export const oneOrMany = (count: number, one: string, many: string) => (count === 1 ? one : many);
