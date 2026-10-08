import type { Theme } from '../tokens.ts';

/**
 * Dark pastel: `pastel` with the lamp turned down.
 *
 * Nothing here is black and nothing is saturated. The page is a charcoal with
 * blue in it, lighter than any other dark theme's, and the text a
 * white with a little lilac — so the distance between the two is as short as
 * it can be made while everything meant to be read still is. The softness is
 * in that, and in the colours: a pink-lilac for the accent, and the three
 * signals as a coral, a mint and a butter, each the pastel of what it is
 * elsewhere.
 *
 * A lighter page leaves less room under it, as `sepia`'s paper does from the
 * other side: the quiet levels of text are close together, and the quietest
 * is as dim as a card will let it be.
 *
 * The thumb of a switch that is off is lighter than its neighbours' too, for
 * the same reason — at their value it sank into this track.
 */
export const dusk: Theme = {
  id: 'dusk',
  nameKey: 'dusk',
  group: 'dark',
  base: 'dark',
  colours: {
    bg: '#1e2128',
    bar: '#22262e',
    surface: '#272b34',
    surfaceRaised: '#30353f',
    border: '#383d49',
    borderStrong: '#525868',

    text: '#ece7f0',
    textSecondary: '#bdb6c8',
    textMuted: '#a39cb0',
    textFaint: '#9a93a7',
    textDisabled: '#6f697c',

    primary: '#ece7f0',
    onPrimary: '#1e2128',

    accent: '#d7a9e3',
    onAccent: '#1e2128',
    accentMuted: '#5a4566',
    accentSoft: '#33293d',

    danger: '#f2a59d',
    dangerSoft: '#3a2628',
    success: '#a5dcb9',
    successSoft: '#23372d',
    warning: '#eed99a',

    scrim: '#0d0f14cc',
    pressed: '#ffffff14',

    switchTrack: '#383d49',
    switchThumb: '#7f7a8f',

    selected: '#30353f',
    onSelected: '#ece7f0',

    outline: '#00000000',
  },
};
