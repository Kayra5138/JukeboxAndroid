import type { Theme } from '../tokens.ts';

/**
 * Sunset: the last of the light, on a wall that is already dark.
 *
 * The neutrals are a plum that is nearly a brown, warm enough that the text
 * can be a cream instead of a white, and the accent is the orange of the sun
 * itself.
 *
 * An orange accent sits close to red, and red is what "something went wrong"
 * is written in. So the red here is moved round towards pink, away from the
 * accent: beside the orange it reads as a different colour and not as a
 * darker one.
 */
export const sunset: Theme = {
  id: 'sunset',
  nameKey: 'sunset',
  group: 'dark',
  base: 'dark',
  colours: {
    bg: '#1d1418',
    bar: '#22171c',
    surface: '#2a1c22',
    surfaceRaised: '#352329',
    border: '#3d2a31',
    borderStrong: '#5c4048',

    text: '#f6e9e4',
    textSecondary: '#cdb5b4',
    textMuted: '#b0959a',
    textFaint: '#a68b90',
    textDisabled: '#7a6166',

    primary: '#f6e9e4',
    onPrimary: '#1d1418',

    accent: '#ff8a5b',
    onAccent: '#1d1418',
    accentMuted: '#6e3a2a',
    accentSoft: '#3d2420',

    danger: '#ff8a9a',
    dangerSoft: '#3d1c26',
    success: '#8fcf9a',
    successSoft: '#223528',
    warning: '#f0c75e',

    scrim: '#0a0507cc',
    pressed: '#ffffff14',

    switchTrack: '#3d2a31',
    switchThumb: '#8a6f74',

    selected: '#352329',
    onSelected: '#f6e9e4',

    outline: '#00000000',
  },
};
