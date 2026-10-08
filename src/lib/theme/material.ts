import { mix } from './colour.ts';
import { repaired } from './repair.ts';
import type { Palette, SystemPalette } from './tokens.ts';

/**
 * A palette from the phone's own, for the theme that follows the wallpaper.
 *
 * Android 12 and later make four families of colour from the wallpaper and
 * hand each over as a ramp of thirteen tones, white to black. Material 3 says
 * which tone of which family each part of an app should be, and this follows
 * it in spirit: the first neutral family for the page, the surfaces and the
 * text, the second for the quieter text and the outlines, the first accent
 * family for the accent.
 *
 * In spirit, because the tokens here are not Material's roles. Material has
 * one surface and tints it; this app has a page, a bar, a card and a chip
 * that have to be told apart, and five levels of text where Material has two.
 * And the ramp has gaps exactly where a dark theme wants its surfaces —
 * nothing between a tone of ten and a tone of twenty — so those are mixed
 * from the two either side.
 */

/** The numbers the system gives the thirteen tones of a ramp, in the order they arrive. */
export const TONES = [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] as const;

type Tone = (typeof TONES)[number];

const RAMPS = ['accent1', 'accent2', 'neutral1', 'neutral2'] as const;

/**
 * The palette out of whatever the native side answered, or null if that is
 * not one.
 *
 * Checked rather than believed, because what is on the other side of the
 * bridge is whichever build is installed: an older one has no such function,
 * a phone before Android 12 answers null, and a colour that is not six
 * digits would be measured as black by everything downstream.
 */
export function systemPaletteFrom(raw: unknown): SystemPalette | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Partial<Record<(typeof RAMPS)[number], string[]>> = {};
  for (const name of RAMPS) {
    const ramp = (raw as Record<string, unknown>)[name];
    if (!Array.isArray(ramp) || ramp.length !== TONES.length) return null;
    const colours: string[] = [];
    for (const colour of ramp) {
      if (typeof colour !== 'string' || !/^#[0-9a-f]{6}$/i.test(colour)) return null;
      colours.push(colour.toLowerCase());
    }
    out[name] = colours;
  }
  return out as SystemPalette;
}

/** Whether two palettes are the same colours, so that being handed the same wallpaper again changes nothing. */
export function samePalette(a: SystemPalette | null, b: SystemPalette | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return RAMPS.every((name) => a[name].join() === b[name].join());
}

/**
 * The tokens for one base, from the phone's palette.
 *
 * The signal colours — wrong, right, careful — are not the wallpaper's to
 * choose: the system has no red of its own to offer, and a warning that took
 * its colour from a photograph of a beach would not be one. They, the scrim
 * and the press are the default theme's, handed in as `plain`.
 *
 * What comes out has been through `repaired`. The mapping below is readable
 * with ramps as Google draws them, but the ramps are whatever the phone's
 * maker decided a tone is and nobody here has seen them all; the check is
 * cheap, and the alternative is a phone on which the captions cannot be read
 * and nobody knows why.
 */
export function materialColours(
  system: SystemPalette,
  base: 'light' | 'dark',
  plain: Palette
): Palette {
  const at = (ramp: readonly string[], tone: Tone) => ramp[TONES.indexOf(tone)]!;
  const n1 = (tone: Tone) => at(system.neutral1, tone);
  const n2 = (tone: Tone) => at(system.neutral2, tone);
  const a1 = (tone: Tone) => at(system.accent1, tone);
  const a2 = (tone: Tone) => at(system.accent2, tone);

  const signals = {
    danger: plain.danger,
    dangerSoft: plain.dangerSoft,
    success: plain.success,
    successSoft: plain.successSoft,
    warning: plain.warning,
    scrim: plain.scrim,
    pressed: plain.pressed,
    // No edge round a card, as in the theme this is a wallpaper's version of.
    outline: plain.outline,
  };

  /*
    What is chosen is a chip's fill with the words' colour on it, as it is in
    every theme that is a look — but of this palette and after its mending,
    not of `plain`, whose greys are not the wallpaper's.
  */
  const finished = (made: Palette): Palette => ({
    ...made,
    selected: made.surfaceRaised,
    onSelected: made.text,
  });

  if (base === 'dark') {
    return finished(repaired({
      // Nearer is lighter: the page at the ramp's darkest but one, a chip a whole tone up.
      bg: n1(900),
      bar: mix(n1(900), n1(800), 0.2),
      surface: mix(n1(900), n1(800), 0.45),
      surfaceRaised: mix(n1(800), n1(700), 0.15),
      border: mix(n2(800), n2(700), 0.35),
      borderStrong: n2(600),

      text: n1(100),
      textSecondary: n2(200),
      textMuted: mix(n2(200), n2(300), 0.6),
      textFaint: n2(300),
      textDisabled: n2(500),

      primary: n1(100),
      onPrimary: n1(900),

      accent: a1(200),
      onAccent: a1(800),
      accentMuted: a1(700),
      accentSoft: mix(n1(900), a2(700), 0.5),

      ...signals,

      switchTrack: n2(700),
      switchThumb: n2(400),

      selected: plain.selected,
      onSelected: plain.onSelected,
    }, 'dark'));
  }

  return finished(repaired({
    // The light theme's arrangement: a white-ish card on a page a little off it, a chip greyer again.
    bg: n1(50),
    bar: mix(n1(10), n1(50), 0.4),
    surface: n1(10),
    surfaceRaised: mix(n1(50), n1(100), 0.6),
    border: n2(100),
    borderStrong: n2(300),

    text: n1(900),
    textSecondary: n2(700),
    textMuted: mix(n2(700), n2(600), 0.6),
    textFaint: n2(600),
    textDisabled: n2(400),

    primary: n1(900),
    onPrimary: n1(10),

    accent: a1(600),
    onAccent: a1(0),
    accentMuted: a1(200),
    accentSoft: mix(a2(50), a2(100), 0.5),

    ...signals,

    switchTrack: n2(200),
    switchThumb: n1(0),

    selected: plain.selected,
    onSelected: plain.onSelected,
  }, 'light'));
}
