import type { Theme } from '../tokens.ts';

/**
 * The app as it looked when it had only one look.
 *
 * Every screen used to carry its own greys, a hundred and nineteen of them
 * across the app, most a shade or two from a neighbour for no reason anybody
 * chose. These are the ones that were used most, each standing for the
 * handful around it.
 *
 * The two quietest levels of text are quieter than a contrast guideline would
 * have them — about 4:1 and 3:1 against a card. That is how the app was, it is
 * kept so that this theme is that app, and the test beside the registry says
 * which levels it is and holds the rest to the guideline.
 */
export const dark: Theme = {
  id: 'dark',
  nameKey: 'dark',
  group: 'basic',
  base: 'dark',
  colours: {
    bg: '#121212',
    bar: '#171717',
    surface: '#1c1c1c',
    surfaceRaised: '#242424',
    border: '#2a2a2a',
    borderStrong: '#3a3a3a',

    text: '#ededed',
    textSecondary: '#9a9a9a',
    textMuted: '#7a7a7a',
    textFaint: '#6a6a6a',
    textDisabled: '#5f5f5f',

    primary: '#ededed',
    onPrimary: '#121212',

    accent: '#7ab8ff',
    onAccent: '#121212',
    accentMuted: '#2f4a63',
    accentSoft: '#1d2733',

    danger: '#ff8a8a',
    dangerSoft: '#2a1a1a',
    success: '#7ac48a',
    successSoft: '#26372a',
    warning: '#e8c46a',

    scrim: '#000000cc',
    pressed: '#ffffff14',

    switchTrack: '#2a2a2a',
    switchThumb: '#6a6a6a',

    selected: '#242424',
    onSelected: '#ededed',

    outline: '#00000000',
  },
};
