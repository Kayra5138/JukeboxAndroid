import { contrast, fromLch, mix, toLch } from '../theme/colour.ts';

/**
 * The colours the recap cards are drawn in, and the rule that keeps their
 * writing readable.
 *
 * Every word on a card is white, or white let partly through: the headings and
 * figures at full strength, the lines under them at `CARD_SOFT_ALPHA`. Both
 * have to be read on every colour a card's gradient passes through, the
 * brightest included, because the gradient runs corner to corner and the
 * writing sits all over it. Measured against the three stops alone, which is
 * enough: between two stops a gradient is never lighter than the lighter of
 * them.
 *
 * The bright ends the palettes first had — amber, aqua, a light blue — carried
 * white at less than two to one. They are the same hues still, taken down in
 * lightness only until the writing clears the line, so the cards keep their
 * colours and lose only the glare.
 */

/** How strongly the quieter lines of a card are written: white, this much of the way over the card. */
export const CARD_SOFT_ALPHA = 0.85;

/** What every word on a card has to clear against every stop: WCAG's AA, for ordinary text. */
export const CARD_READ_RATIO = 4.5;

/**
 * A palette per card, and they are meant to clash.
 *
 * A recap read one card at a time has nothing but colour to tell the reader
 * they have moved on; a single house palette across seven cards reads as one
 * long card. Each is three stops rather than two so the corner the heading
 * sits in is darker than the middle.
 */
export const CARD_PALETTES = {
  opening: ['#1B1040', '#4C1D95', '#8E36D9'],
  tracks: ['#052E2B', '#07736B', '#007568'],
  artists: ['#3B0A2A', '#9D174D', '#B2357C'],
  genres: ['#2A1403', '#A94B00', '#866300'],
  clock: ['#07182E', '#1D4ED8', '#2268B8'],
  numbers: ['#170B2E', '#5B21B6', '#7946DF'],
  closing: ['#2B0A3D', '#7209B7', '#C30064'],
} as const satisfies Record<string, readonly [string, string, string]>;

/** The quieter writing as it comes out over [stop]: the white let through, the stop under it. */
export function softOver(stop: string): string {
  return mix(stop, '#ffffff', CARD_SOFT_ALPHA);
}

/** Whether both kinds of writing on a card can be read on [stop]. */
export function readableUnder(stop: string): boolean {
  return (
    contrast('#ffffff', stop) >= CARD_READ_RATIO && contrast(softOver(stop), stop) >= CARD_READ_RATIO
  );
}

/**
 * Stops a card can be written on, from any stops at all.
 *
 * For the colours read out of a cover, which can be as light as the cover is.
 * Each stop is taken down in lightness, its hue and as much of its colour as
 * fits kept, by the least that lets the writing clear the line; one that
 * already does comes back as it was.
 */
export function legibleStops(
  stops: readonly [string, string, string]
): readonly [string, string, string] {
  return [legible(stops[0]), legible(stops[1]), legible(stops[2])];
}

function legible(stop: string): string {
  if (readableUnder(stop)) return stop;
  const lch = toLch(stop);
  for (let l = lch.l; l >= 0; l -= 0.005) {
    const candidate = fromLch({ ...lch, l });
    if (readableUnder(candidate)) return candidate;
  }
  return '#000000';
}
