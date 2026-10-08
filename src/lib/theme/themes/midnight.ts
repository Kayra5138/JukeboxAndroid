import type { Theme } from '../tokens.ts';

/**
 * Midnight blue: dark, with the sky left in.
 *
 * Every neutral is a navy — the page deepest, cards and chips coming up
 * towards a dusk blue — and the text is a white that has been outdoors. The
 * accent is the default's sky blue pulled a little towards the palette, so it
 * is at home here without stopping being the thing that stands out.
 *
 * The mock-up's muted blue-grey is kept, as the quietest level meant to be
 * read; the level above it is a new shade between that and the secondary.
 */
export const midnight: Theme = {
  id: 'midnight',
  nameKey: 'midnight',
  group: 'dark',
  base: 'dark',
  colours: {
    bg: '#0e1524',
    bar: '#121b2e',
    surface: '#172238',
    surfaceRaised: '#1b2a45',
    border: '#24344f',
    borderStrong: '#3a4d6e',

    text: '#e6ecf7',
    textSecondary: '#a9b6cf',
    textMuted: '#8c9bb6',
    textFaint: '#8291ad',
    textDisabled: '#5d6b87',

    primary: '#e6ecf7',
    onPrimary: '#0e1524',

    accent: '#6fb3ff',
    onAccent: '#0e1524',
    accentMuted: '#2a4a73',
    accentSoft: '#1a2c48',

    danger: '#ff8f8f',
    dangerSoft: '#33202b',
    success: '#7fd09a',
    successSoft: '#1b3a36',
    warning: '#ecc873',

    scrim: '#050912cc',
    pressed: '#ffffff14',

    switchTrack: '#24344f',
    switchThumb: '#6b7a96',

    selected: '#1b2a45',
    onSelected: '#e6ecf7',

    outline: '#00000000',
  },
};
