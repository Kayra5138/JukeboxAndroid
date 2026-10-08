import type { Theme } from '../tokens.ts';

/**
 * Sepia: old paper, and ink that has gone brown.
 *
 * Nothing here is white and nothing is black. The lightest thing is a card
 * the colour of a page that has been kept out of the sun, the darkest is the
 * text, and every grey between them is a warm one — a neutral grey beside
 * these reads as blue, and looks like a mistake.
 *
 * The quiet levels of text are darker than the mock-up drew them. Paper is
 * not a bright ground, so there is less room under it than under white: a
 * brown that is plainly "muted" on white is unreadable here, and these are
 * the lightest that still clear 4.5:1 against the page. The accent, a
 * leather brown, is a shade down from the sketch for the sake of the chip.
 *
 * Good news is an olive rather than a green, and bad news a brick: the
 * colours an old printer would have had.
 */
export const sepia: Theme = {
  id: 'sepia',
  nameKey: 'sepia',
  group: 'light',
  base: 'light',
  colours: {
    bg: '#f1e6d2',
    bar: '#f6ecda',
    surface: '#faf2e2',
    surfaceRaised: '#e7d8bc',
    border: '#dccdb0',
    borderStrong: '#bfab88',

    text: '#4b3a28',
    textSecondary: '#5c4a36',
    textMuted: '#6b5842',
    textFaint: '#76634c',
    textDisabled: '#a08d72',

    primary: '#4b3a28',
    onPrimary: '#faf2e2',

    accent: '#8d4e18',
    onAccent: '#faf2e2',
    accentMuted: '#d9b58f',
    accentSoft: '#f0dcc0',

    danger: '#a3372a',
    dangerSoft: '#f3d9cc',
    success: '#4a6b2a',
    successSoft: '#e2e4c2',
    warning: '#7d5a10',

    scrim: '#2b201566',
    pressed: '#4b3a2812',

    switchTrack: '#d6c6a6',
    switchThumb: '#faf2e2',

    selected: '#e7d8bc',
    onSelected: '#4b3a28',

    outline: '#00000000',
  },
};
