import { fromLch, inkOn, readableOn, toLch, withAlpha } from '../colour.ts';
import { accentFrom, coverColour } from '../coverAccent.ts';
import { flattened, withEffects } from '../effects.ts';
import type { Palette, Theme } from '../tokens.ts';
import { GLASS, GLASS_FINISH, glass } from './glass.ts';

/**
 * Cover glass: the night glass, over a sky made from the record that is on.
 *
 * `cover` moves the accent and leaves the furniture where it is, because a
 * page that changes colour every three minutes is tiring. This is the theme
 * for somebody who wants exactly that, and it can be had here without the
 * tiredness because of what the page is: glass has no colour of its own to
 * change, so all that moves is the light behind it, and that is kept low.
 *
 * The cover's colours are only ever hues to start from. A cover can be any
 * brightness, and white ink has to be read on whatever comes of it, so each
 * colour is brought down to a depth at which it is a dark sky of that hue —
 * the first stop nearly black, the last no brighter than dusk — and held to
 * a strength short of garish. The accent is the cover's as well, found the
 * way `cover` finds it, against the brightest the glass can be.
 *
 * With nothing playing, no cover, or a cover with no colour in it, this is
 * `glass` exactly.
 */

/** How light each part of the sky may be and how strong its colour, as OKLCH counts them. */
const DEPTHS = { top: 0.17, middle: 0.3, foot: 0.24, glow: 0.31 } as const;
const STRENGTH = { top: 0.05, middle: 0.1, foot: 0.08, glow: 0.11 } as const;

/** A colour's hue, at a lightness and no more than a strength. */
function placed(colour: string, l: number, most: number): string {
  const from = toLch(colour);
  return fromLch({ l, c: Math.min(from.c, most), h: from.h });
}

/** The glass over the sky of these stops, dark to light. Pure: the same stops, the same colours. */
export function auroraColours(stops: readonly string[]): Palette {
  const first = stops[0]!;
  const main = stops[Math.min(1, stops.length - 1)]!;
  const last = stops[stops.length - 1]!;

  const bg = placed(first, DEPTHS.top, STRENGTH.top);
  const middle = placed(main, DEPTHS.middle, STRENGTH.middle);
  const foot = placed(main, DEPTHS.foot, STRENGTH.foot);
  const glow = placed(last, DEPTHS.glow, STRENGTH.glow);

  const effects = {
    ...GLASS_FINISH,
    backdrop: [
      `radial-gradient(circle at 86% 40%, ${withAlpha(glow, 0.7)} 0%, ${withAlpha(glow, 0)} 58%)`,
      `linear-gradient(180deg, ${bg} 0%, ${middle} 58%, ${foot} 100%)`,
    ],
  };
  const sky: Palette = { ...GLASS, bg, onPrimary: bg, scrim: withAlpha(placed(first, 0.1, 0.03), 0.6) };

  /*
    The accent is the cover's, found the way `cover` finds it and then held
    to everything it is written on here: the page, a card and a chip, each
    as it comes out over every part of this sky. That is asked of the sky
    itself, drawn once without an accent, since what a card of glass comes
    to over a glow is not something to be worked out twice.
  */
  const grounds = flattened(withEffects({ ...sky }, effects)).flatMap((flat) => [
    flat.bg,
    flat.bar,
    flat.surface,
    flat.surfaceRaised,
  ]);
  const found = accentFrom(coverColour(stops), { ...GLASS, bg: glow, bar: glow, surface: glow, surfaceRaised: glow });
  const accent = readableOn(found?.accent ?? GLASS.accent, grounds, 4.5);

  return withEffects(
    {
      ...sky,
      accent,
      onAccent: inkOn(accent, bg, '#ffffff'),
      accentMuted: withAlpha(accent, 0.35),
      accentSoft: withAlpha(accent, 0.14),
    },
    effects
  );
}

export const aurora: Theme = {
  id: 'aurora',
  nameKey: 'aurora',
  group: 'effects',
  base: 'dark',
  colours: glass.colours,
  dynamic: {
    needs: ['cover'],
    resolve: (around) => ({
      base: 'dark',
      colours: around.cover && around.cover.length > 0 ? auroraColours(around.cover) : glass.colours,
    }),
  },
};
