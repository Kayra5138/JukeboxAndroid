import type { Theme } from '../tokens.ts';

/**
 * Sweet pastel: white cards on a page with a blush in it.
 *
 * The pink of the mock-up, a strawberry-milk `#d9749c`, is the colour of this
 * theme and cannot be its accent as it stands: the accent is written as well
 * as filled — the name of what is playing, a link — and that pink on white is
 * under 3:1. So the accent is the same hue taken down until it reads on the
 * page, a card and a chip alike, and the pink the eye was promised is in the
 * places that are only ever fills: the chips, the track of a switch that is
 * on, the wash behind a selected row.
 *
 * The greys are all a little plum, text included; a true black here would be
 * the one hard thing on the screen.
 */
export const pastel: Theme = {
  id: 'pastel',
  nameKey: 'pastel',
  group: 'light',
  base: 'light',
  colours: {
    bg: '#fbf3f6',
    bar: '#fffafc',
    surface: '#ffffff',
    surfaceRaised: '#f6e4ec',
    border: '#efd9e3',
    borderStrong: '#d9b8c8',

    text: '#4a3f47',
    textSecondary: '#5e515a',
    textMuted: '#6f616a',
    textFaint: '#776872',
    textDisabled: '#a898a2',

    primary: '#4a3f47',
    onPrimary: '#ffffff',

    accent: '#a3446c',
    onAccent: '#ffffff',
    accentMuted: '#f0b8cf',
    accentSoft: '#fbe4ee',

    danger: '#b23a48',
    dangerSoft: '#fde8ea',
    success: '#2c774f',
    successSoft: '#e1f3e8',
    warning: '#8a5a14',

    scrim: '#3a2f3766',
    pressed: '#4a3f470f',

    switchTrack: '#e3d3db',
    switchThumb: '#ffffff',

    selected: '#f6e4ec',
    onSelected: '#4a3f47',

    outline: '#00000000',
  },
};
