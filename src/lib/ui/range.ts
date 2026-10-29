/**
 * A number somebody chooses, from a range rather than a few offered: any
 * whole number from the least to the most. See `NumberStepper` for choosing
 * one, and the settings that keep one for what each range is.
 */
export type Range = { min: number; max: number };

/** [value] as a whole number inside [range], or null where it is not one: something stored long ago, or typed wrong. */
export function wholeIn(value: unknown, range: Range): number | null {
  const number = typeof value === 'string' ? (value.trim() === '' ? NaN : Number(value)) : typeof value === 'number' ? value : NaN;
  return Number.isInteger(number) && number >= range.min && number <= range.max ? number : null;
}

/** [value] brought inside [range], whole: for a step past either end, which stops there. */
export function clampTo(value: number, range: Range): number {
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}
