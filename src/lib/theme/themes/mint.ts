import type { Theme } from '../tokens.ts';

/**
 * Mint: a light theme with a leaf held up to it.
 *
 * The page is a white with green in it, the cards are white, and the text is
 * a green so deep it is nearly a grey. Fresh, and not loud: the accent is a
 * leaf green and no brighter, a shade down from the sketch because the sketch's
 * could be read on the page and on a card but not on a chip.
 *
 * This is `forest`'s problem the other way up: the accent is the colour of
 * good news. So "it worked" is moved round towards teal, a green with blue in
 * it, and is told from the accent by hue where `forest` does it by lightness —
 * on a light page there is no room to go paler and still be read.
 */
export const mint: Theme = {
  id: 'mint',
  nameKey: 'mint',
  group: 'light',
  base: 'light',
  colours: {
    bg: '#eef6f0',
    bar: '#f6faf7',
    surface: '#ffffff',
    surfaceRaised: '#ddeee2',
    border: '#d5e6da',
    borderStrong: '#b0c9b8',

    text: '#24382c',
    textSecondary: '#3a5043',
    textMuted: '#4d6355',
    textFaint: '#566c5e',
    textDisabled: '#8ba294',

    primary: '#24382c',
    onPrimary: '#ffffff',

    accent: '#2a7549',
    onAccent: '#ffffff',
    accentMuted: '#a8d5b8',
    accentSoft: '#dff1e5',

    danger: '#b23a3a',
    dangerSoft: '#fbe8e6',
    success: '#1f6f6b',
    successSoft: '#dcf0ee',
    warning: '#80590f',

    scrim: '#1c2b2266',
    pressed: '#24382c0f',

    switchTrack: '#cbdcd0',
    switchThumb: '#ffffff',

    selected: '#ddeee2',
    onSelected: '#24382c',

    outline: '#00000000',
  },
};
