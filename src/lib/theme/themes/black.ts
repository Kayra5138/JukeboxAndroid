import type { Theme } from '../tokens.ts';

/**
 * Pure black: the dark theme for a screen whose black is a pixel switched off.
 *
 * The page, the bars and so everything behind a list are `#000000` exactly —
 * not nearly, because on an OLED the difference between black and almost
 * black is the difference between off and on, and it is the whole reason to
 * choose this over `dark`.
 *
 * Cards are barely there: enough of a grey to see where one ends in a dark
 * room and no more. A chip is a touch lighter than the mock-up had it, since
 * at the sketch's value it could not be told from the card it sits on. The
 * quiet text is lighter than `dark`'s, which this theme has no history to
 * excuse; and a finger is answered a little more strongly, because a faint
 * wash over black is fainter than the same wash over grey.
 */
export const black: Theme = {
  id: 'black',
  nameKey: 'black',
  group: 'dark',
  base: 'dark',
  colours: {
    bg: '#000000',
    bar: '#000000',
    surface: '#0e0e0e',
    surfaceRaised: '#181818',
    border: '#1f1f1f',
    borderStrong: '#3a3a3a',

    text: '#ededed',
    textSecondary: '#a0a0a0',
    textMuted: '#8a8a8a',
    textFaint: '#808080',
    textDisabled: '#5f5f5f',

    primary: '#ededed',
    onPrimary: '#000000',

    accent: '#7ab8ff',
    onAccent: '#000000',
    accentMuted: '#25405c',
    accentSoft: '#0f1a26',

    danger: '#ff8a8a',
    dangerSoft: '#240f0f',
    success: '#7ac48a',
    successSoft: '#0f2415',
    warning: '#e8c46a',

    scrim: '#000000cc',
    pressed: '#ffffff1f',

    switchTrack: '#262626',
    switchThumb: '#6a6a6a',

    selected: '#181818',
    onSelected: '#ededed',

    outline: '#00000000',
  },
};
