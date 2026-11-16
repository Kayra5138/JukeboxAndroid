/**
 * Records in the order of the colours of their covers, as a rainbow: the
 * reds, through orange, yellow, green and blue to violet and pink, and after
 * them the covers with no colour to speak of, black to white. A cover whose
 * colour is not known yet goes after all of them.
 *
 * For the rack (`CoverFlow`), where a run of covers shading into one another
 * is the point. See `albumColours.ts` for where the colours come from.
 */

/** Hue (0–360), saturation and lightness (0–1) of a `#rrggbb` colour; null for anything else. */
export function hslOf(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** Below this much colour, or this near black or white, a cover is counted as having none. */
const GREY = 0.14;
const DARK = 0.08;
const LIGHT = 0.94;
/**
 * Where the rainbow starts: just short of red, so that the pinks that lean
 * towards it end the run rather than splitting the reds.
 */
const START = 345;

/**
 * A number that puts a colour in its place: the colours by hue from red round
 * to pink, in [0, 1); the colourless after them by lightness, in [1, 2).
 */
export function colourRank(hex: string): number | null {
  const hsl = hslOf(hex);
  if (!hsl) return null;
  if (hsl.s < GREY || hsl.l < DARK || hsl.l > LIGHT) return 1 + hsl.l;
  return (((hsl.h - START + 360) % 360) / 360) * 0.999;
}

/**
 * [items] in the order of their colours, as {@link colourRank} has it; the
 * ones [colourOf] has no colour for at the end, in the order they came.
 */
export function byColour<T>(items: readonly T[], colourOf: (item: T) => string | null | undefined): T[] {
  return items
    .map((item, at) => {
      const hex = colourOf(item);
      return { item, at, rank: hex ? colourRank(hex) : null };
    })
    .sort((a, b) => (a.rank ?? 3) - (b.rank ?? 3) || a.at - b.at)
    .map((entry) => entry.item);
}
