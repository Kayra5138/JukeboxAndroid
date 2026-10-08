/**
 * Reading a shift somebody typed.
 *
 * Seconds in, milliseconds out, because seconds are the unit the correction is
 * heard in — "it comes in about a second and a half late" — and milliseconds
 * are what the timings are kept in.
 */

import { strings, type Strings } from '../i18n/languages.ts';

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

/** `+1.5s`, `−0.25s`, `no shift`; in Turkish `+1,5 sn`. */
export function formatOffset(milliseconds: number, t: Strings = strings()): string {
  const said = t.details.lyrics;
  if (milliseconds === 0) return said.noShift;
  const seconds = Math.abs(milliseconds) / 1000;
  // Trailing zeroes dropped, so a whole second is `1s` rather than `1.00s`.
  // The language is told how many places are left so that it writes the
  // same figure with its own decimal mark, and adds none back.
  const digits = Number(seconds.toFixed(2));
  const places = (String(digits).split('.')[1] ?? '').length;
  const written = t.format.decimal(digits, places);
  return milliseconds > 0 ? said.shiftedLater(written) : said.shiftedEarlier(written);
}
