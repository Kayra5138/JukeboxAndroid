import type { Theme } from '../tokens.ts';

/**
 * Forest: under the trees after dark.
 *
 * Green all the way down: a page that is nearly black and unmistakably green,
 * moss for the cards, lichen for the text.
 *
 * A green theme has one problem the others do not, which is that its accent
 * is the colour of good news. "It worked" is therefore a paler, mintier green
 * than the accent — the two are seldom side by side, and where they are the
 * difference in lightness is what tells them apart.
 */
export const forest: Theme = {
  id: 'forest',
  nameKey: 'forest',
  group: 'dark',
  base: 'dark',
  colours: {
    bg: '#101a14',
    bar: '#142019',
    surface: '#18261d',
    surfaceRaised: '#1e3025',
    border: '#27392d',
    borderStrong: '#3d5544',

    text: '#e4efe6',
    textSecondary: '#adc2b1',
    textMuted: '#8fa995',
    textFaint: '#86a08c',
    textDisabled: '#5f7765',

    primary: '#e4efe6',
    onPrimary: '#101a14',

    accent: '#7ccb8f',
    onAccent: '#101a14',
    accentMuted: '#2f5a3c',
    accentSoft: '#1c3324',

    danger: '#ff8f85',
    dangerSoft: '#33201c',
    success: '#a6e3b0',
    successSoft: '#1f3a27',
    warning: '#e8c46a',

    scrim: '#050a07cc',
    pressed: '#ffffff14',

    switchTrack: '#27392d',
    switchThumb: '#6b8571',

    selected: '#1e3025',
    onSelected: '#e4efe6',

    outline: '#00000000',
  },
};
