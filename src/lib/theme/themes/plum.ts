import type { Theme } from '../tokens.ts';

/**
 * Plum: the dark of the fruit, and the bloom on it.
 *
 * Purple all the way down, as `midnight` is blue and `forest` green: a page
 * that is nearly black and plainly violet, cards coming up towards an
 * aubergine, text a white with the same tint. `sunset`'s neutrals are a plum
 * as well, but a brown one, and warm; these are a cold one, and the accent
 * settles it — an orchid, bright against all that dark.
 *
 * Bad news is a coral. A pink, which is where `sunset` moves its red to, would
 * here be the accent again with the blue left out.
 */
export const plum: Theme = {
  id: 'plum',
  nameKey: 'plum',
  group: 'dark',
  base: 'dark',
  colours: {
    bg: '#1a1220',
    bar: '#1f1626',
    surface: '#251a2e',
    surfaceRaised: '#30223b',
    border: '#3a2a46',
    borderStrong: '#574066',

    text: '#f1e8f5',
    textSecondary: '#c6b4cf',
    textMuted: '#a995b3',
    textFaint: '#a08ca9',
    textDisabled: '#73607d',

    primary: '#f1e8f5',
    onPrimary: '#1a1220',

    accent: '#c77dff',
    onAccent: '#1a1220',
    accentMuted: '#5b3580',
    accentSoft: '#33204a',

    danger: '#ff8f8f',
    dangerSoft: '#3b1a24',
    success: '#86d3a0',
    successSoft: '#1c3529',
    warning: '#eec76a',

    scrim: '#08040bcc',
    pressed: '#ffffff14',

    switchTrack: '#3a2a46',
    switchThumb: '#856f90',

    selected: '#30223b',
    onSelected: '#f1e8f5',

    outline: '#00000000',
  },
};
