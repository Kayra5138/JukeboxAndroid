/**
 * Reading a shift somebody typed.
 *
 * Seconds in, milliseconds out, because seconds are the unit the correction is
 * heard in — "it comes in about a second and a half late" — and milliseconds
 * are what the timings are kept in.
 */

/** Past this the file is not shifted, it is the wrong file. */
export const MAX_OFFSET_MS = 60_000;

/** Ten milliseconds is already finer than the difference can be heard. */
const GRANULARITY_MS = 10;

/**
 * The shift [text] describes, or null if it does not describe one.
 *
 * A comma is taken as a decimal point. Half the world writes `1,5` for one and
 * a half, and this phone's keyboard offers whichever its locale prefers — so
 * refusing one of them would make the field reject what the keyboard just
 * gave it.
 */
export function parseOffsetMs(text: string): number | null {
  const cleaned = text.trim().replace(',', '.');
  if (cleaned.length === 0) return null;

  // Deliberately stricter than Number(): that accepts `0x10`, `1e3`, `Infinity`
  // and an empty string, none of which anybody means by "a second and a half".
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;

  const seconds = Number(cleaned);
  if (!Number.isFinite(seconds)) return null;

  const milliseconds = Math.round((seconds * 1000) / GRANULARITY_MS) * GRANULARITY_MS;
  return Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, milliseconds));
}

/** `+1.5s`, `−0.25s`, `no shift`. */
export function formatOffset(milliseconds: number): string {
  if (milliseconds === 0) return 'no shift';
  const seconds = Math.abs(milliseconds) / 1000;
  // Trailing zeroes dropped, so a whole second is `1s` rather than `1.00s`.
  const digits = Number(seconds.toFixed(2));
  return `${milliseconds > 0 ? '+' : '−'}${digits}s`;
}
