import { fromLch, inkOn, readableOn, toLch, withAlpha } from '../colour.ts';
import { accentFrom, coverColour } from '../coverAccent.ts';
import { effectsOf, flattened, withEffects } from '../effects.ts';
import type { Palette, Theme } from '../tokens.ts';
import { frost } from './frost.ts';

/**
 * Cover glass by day: the frosted glass, over a sky made from the record
 * that is on.
 *
 * The same thought as `aurora` the other way up. The cover's colours are
 * hues to start from and nothing more: each is brought up to a pale wash of
 * itself, light enough that the navy ink of the frosted glass reads on it as
 * it does on the plain page, and kept faint, since a bright page that changes
 * colour with every song would be loud where the dark one is only a mood.
 * The accent is the cover's, made dark enough for the palest the glass can be.
 *
 * With nothing playing, no cover, or a cover with no colour in it, this is
 * `frost` exactly.
 */

/** How light each part of the sky is and how strong its colour, as OKLCH counts them. */
const DEPTHS = { top: 0.95, middle: 0.92, foot: 0.93, glow: 0.88 } as const;
const STRENGTH = { top: 0.02, middle: 0.04, foot: 0.035, glow: 0.07 } as const;

/** A colour's hue, at a lightness and no more than a strength. */
function placed(colour: string, l: number, most: number): string {
  const from = toLch(colour);
  return fromLch({ l, c: Math.min(from.c, most), h: from.h });
}

/** The frosted glass over the sky of these stops, dark to light. Pure: the same stops, the same colours. */
export function auroraLightColours(stops: readonly string[]): Palette {
  const first = stops[0]!;
  const main = stops[Math.min(1, stops.length - 1)]!;
  const last = stops[stops.length - 1]!;

  const bg = placed(first, DEPTHS.top, STRENGTH.top);
  const middle = placed(main, DEPTHS.middle, STRENGTH.middle);
  const foot = placed(main, DEPTHS.foot, STRENGTH.foot);
  const glow = placed(last, DEPTHS.glow, STRENGTH.glow);

  const effects = {
    ...effectsOf(frost.colours)!,
    backdrop: [
      `radial-gradient(circle at 86% 40%, ${withAlpha(glow, 0.8)} 0%, ${withAlpha(glow, 0)} 58%)`,
      `linear-gradient(180deg, ${bg} 0%, ${middle} 58%, ${foot} 100%)`,
    ],
  };
  const sky: Palette = { ...frost.colours, bg };

  // The accent held to everything it is written on here, as `aurora` holds its own.
  const grounds = flattened(withEffects({ ...sky }, effects)).flatMap((flat) => [
    flat.bg,
    flat.bar,
    flat.surface,
    flat.surfaceRaised,
  ]);
  const found = accentFrom(coverColour(stops), { ...frost.colours, bg: glow, bar: glow, surface: glow, surfaceRaised: glow });
  const accent = readableOn(found?.accent ?? frost.colours.accent, grounds, 4.5);

  return withEffects(
    {
      ...sky,
      accent,
      onAccent: inkOn(accent, '#ffffff', frost.colours.text),
      accentMuted: withAlpha(accent, 0.4),
      accentSoft: withAlpha(accent, 0.12),
    },
    effects
  );
}

export const auroraLight: Theme = {
  id: 'auroraLight',
  nameKey: 'auroraLight',
  group: 'effects',
  base: 'light',
  colours: frost.colours,
  dynamic: {
    needs: ['cover'],
    resolve: (around) => ({
      base: 'light',
      colours: around.cover && around.cover.length > 0 ? auroraLightColours(around.cover) : frost.colours,
    }),
  },
};
