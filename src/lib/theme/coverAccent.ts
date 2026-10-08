import { contrast, fromLch, inkOn, mix, readableOn, toLch } from './colour.ts';
import type { Palette } from './tokens.ts';

/** The four tokens that are the accent: the colour, what is written on it, and its two quieter fills. */
export type Accent = Pick<Palette, 'accent' | 'onAccent' | 'accentMuted' | 'accentSoft'>;

/**
 * Below this much chroma a colour is a grey with an opinion. An accent made
 * from one is a grey accent, which says nothing about what is selected.
 */
const GREY = 0.035;

/**
 * Where an accent has to sit to be one on a dark theme.
 *
 * Light enough to be read as text on a card, and no lighter than leaves it a
 * colour: past the top of this it is on its way to white. The default
 * accent's own lightness is about 0.77, in the middle of the range.
 *
 * Strong enough to be told from the text beside it, and no stronger than the
 * default is: a cover in full-strength magenta should colour the app, not
 * shout over the cover.
 */
const LIGHTEST = 0.84;
const DARKEST = 0.72;
const WEAKEST = 0.09;
const STRONGEST = 0.15;

/**
 * An accent from a cover's colour, on the neutrals it will be used with.
 *
 * The cover's colour is only ever a hue to start from. Covers are dark more
 * often than not, and a colour lifted straight off one — a navy, an oxblood —
 * is a fine colour and no accent at all: as text on a dark card it cannot be
 * read. So the hue is kept and the rest is chosen: the lightness and the
 * strength are brought inside a range in which any hue reads as an accent,
 * and then checked, and lifted further if need be, until it clears 4.5:1 on
 * every ground an accent is written on.
 *
 * Null for no colour or for a grey, and the caller keeps the accent it had:
 * a black-and-white cover has nothing to say about colour.
 */
export function accentFrom(cover: string | null | undefined, neutrals: Palette): Accent | null {
  if (!cover) return null;
  const from = toLch(cover);
  // A colour that could not be read comes back as black, which is a grey.
  if (from.c < GREY) return null;

  const placed = fromLch({
    l: Math.max(DARKEST, Math.min(LIGHTEST, from.l)),
    c: Math.max(WEAKEST, Math.min(STRONGEST, from.c)),
    h: from.h,
  });
  const accent = readableOn(
    placed,
    [neutrals.bg, neutrals.bar, neutrals.surface, neutrals.surfaceRaised],
    4.5
  );

  return {
    accent,
    onAccent: inkOn(accent, neutrals.bg, '#ffffff'),
    // The proportions the default theme's own two fills are of its accent and its page.
    accentMuted: mix(neutrals.bg, accent, 0.32),
    accentSoft: mix(neutrals.bg, accent, 0.12),
  };
}

/**
 * The one colour of a cover to make an accent of, out of the few it gave.
 *
 * The cover is read as three stops, dark to light. The first two are the hue
 * most of the cover is; the last may be a second hue altogether, there for a
 * gradient to run to. The accent wants the main one, and of its two stops the
 * middle, which is the one with the most colour left in it.
 */
export function coverColour(stops: readonly string[] | null | undefined): string | null {
  if (!stops || stops.length === 0) return null;
  return stops[Math.min(1, stops.length - 1)] ?? null;
}

/** A cover as it was read: the stops, and where it is known the colour they were made from. */
export type CoverReading = { stops: readonly string[]; main?: string | null };

/**
 * The stops of a cover that has a colour, and nothing for one that has not.
 *
 * The stops cannot be asked. They are made for a gradient, which must never
 * be colourless, so the reader gives every cover's a saturation whether the
 * cover had one or not; and a grey's hue being nought, which is red's, a
 * black-and-white cover arrives here as three shades of brick. The grey
 * check in `accentFrom` then passes it, quite correctly.
 *
 * `main` is the colour the stops were made from, untouched, and it is the
 * one judged — by the same measure, since a grey is a grey whoever asks. A
 * grey one means no cover as far as an accent goes, and the theme keeps its
 * own.
 *
 * An older build of the app answers the stops alone. There is then nothing
 * to judge by and they are passed on as they always were.
 */
export function colouredStops(
  reading: CoverReading | readonly string[] | null | undefined
): readonly string[] | null {
  if (!reading) return null;
  const { stops, main }: CoverReading = isStops(reading) ? { stops: reading } : reading;
  if (!stops || stops.length === 0) return null;
  if (typeof main === 'string' && toLch(main).c < GREY) return null;
  return stops;
}

/** `Array.isArray` loses a readonly array's type; this keeps it. */
function isStops(reading: CoverReading | readonly string[]): reading is readonly string[] {
  return Array.isArray(reading);
}

/** Whether what is written on an accent can be read there; for the tests, and for anyone doubting. */
export function accentReads(accent: Accent, neutrals: Palette): boolean {
  return (
    contrast(accent.onAccent, accent.accent) >= 4.5 &&
    contrast(accent.accent, neutrals.surface) >= 4.5 &&
    contrast(neutrals.text, accent.accentSoft) >= 4.5
  );
}
