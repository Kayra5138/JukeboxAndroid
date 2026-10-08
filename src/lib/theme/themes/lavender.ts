import type { Theme } from '../tokens.ts';

/**
 * Lavender: white cards on a page with violet in it.
 *
 * The cool sister of `pastel`: the same idea, a tinted page and greys that
 * all lean the way the page does, with the blush taken out and a violet put
 * in. The text is an aubergine rather than a black, and the accent a violet
 * of middling strength, dark enough to be written on a chip as it stands.
 *
 * Bad news is a plain red and not a rose. A rose beside this accent is a
 * warmer purple, and a warning ought not to look like a link.
 */
export const lavender: Theme = {
  id: 'lavender',
  nameKey: 'lavender',
  group: 'light',
  base: 'light',
  colours: {
    bg: '#f4f1fa',
    bar: '#faf8fd',
    surface: '#ffffff',
    surfaceRaised: '#e7e0f4',
    border: '#e0d8ee',
    borderStrong: '#c0b4d6',

    text: '#3a3350',
    textSecondary: '#4f4767',
    textMuted: '#5f5778',
    textFaint: '#686081',
    textDisabled: '#9d95b3',

    primary: '#3a3350',
    onPrimary: '#ffffff',

    accent: '#6b4fb3',
    onAccent: '#ffffff',
    accentMuted: '#c5b5ea',
    accentSoft: '#ebe4f8',

    danger: '#b63a3f',
    dangerSoft: '#fbe7e8',
    success: '#2f7350',
    successSoft: '#e0f2e7',
    warning: '#855a12',

    scrim: '#2a243c66',
    pressed: '#3a33500f',

    switchTrack: '#d6cfe4',
    switchThumb: '#ffffff',

    selected: '#e7e0f4',
    onSelected: '#3a3350',

    outline: '#00000000',
  },
};
