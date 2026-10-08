import type { Theme } from '../tokens.ts';

/**
 * Ice: the light theme with the window open.
 *
 * Where `light` leans blue so slightly it is only not-yellow, this one means
 * it: the page is a grey-blue, the text a slate rather than a black, and the
 * accent a steel blue that is nearly a grey itself. Cold, and quiet — the
 * accent is deliberately not the bright blue of the default, which on this
 * page would be the only loud thing in the room.
 *
 * The accent and the quietest text are each a step darker than the mock-up,
 * which is what it takes for them to read on the page and on a chip.
 */
export const ice: Theme = {
  id: 'ice',
  nameKey: 'ice',
  group: 'light',
  base: 'light',
  colours: {
    bg: '#eceff4',
    bar: '#f5f7fa',
    surface: '#ffffff',
    surfaceRaised: '#dde3ec',
    border: '#d8dee9',
    borderStrong: '#b4bdcc',

    text: '#2e3440',
    textSecondary: '#434c5e',
    textMuted: '#566072',
    textFaint: '#5f697b',
    textDisabled: '#8f98a8',

    primary: '#2e3440',
    onPrimary: '#ffffff',

    accent: '#416392',
    onAccent: '#ffffff',
    accentMuted: '#a9c1de',
    accentSoft: '#e1eaf5',

    danger: '#b23b46',
    dangerSoft: '#f8e6e8',
    success: '#3f7150',
    successSoft: '#e1f0e5',
    warning: '#8a6116',

    scrim: '#2e344066',
    pressed: '#2e34400f',

    switchTrack: '#cdd4df',
    switchThumb: '#ffffff',

    selected: '#dde3ec',
    onSelected: '#2e3440',

    outline: '#00000000',
  },
};
