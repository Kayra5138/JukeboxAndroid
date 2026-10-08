import type { Theme } from '../tokens.ts';

/**
 * Peach: a light theme with the sun on it.
 *
 * Warm, and bright with it, which is what keeps it from being `sepia`: that
 * one is paper that has yellowed and has no white anywhere, and this one has
 * white cards on a page that is only just orange. Nor is it `pastel`, whose
 * warmth is pink. The colour here is the skin of the fruit — a coral that is
 * on its way to terracotta — and the greys are a cocoa.
 *
 * The accent is darker than the sketch's coral, which was under 4:1 on a chip;
 * the brighter orange is kept for the places that are only ever fills, the
 * track of a switch that is on and the wash behind a selected row.
 *
 * A coral accent sits next to red, as `sunset`'s orange does, and the answer
 * is the same one: bad news is moved round to a wine red, and is darker than
 * the accent as well, so that it reads as another colour and not as more of
 * this one.
 */
export const peach: Theme = {
  id: 'peach',
  nameKey: 'peach',
  group: 'light',
  base: 'light',
  colours: {
    bg: '#fff4ec',
    bar: '#fffaf5',
    surface: '#ffffff',
    surfaceRaised: '#fbe3d3',
    border: '#f5d9c7',
    borderStrong: '#e0b79e',

    text: '#4a3229',
    textSecondary: '#624539',
    textMuted: '#735547',
    textFaint: '#7c5d4f',
    textDisabled: '#b3968a',

    primary: '#4a3229',
    onPrimary: '#ffffff',

    accent: '#b04426',
    onAccent: '#ffffff',
    accentMuted: '#f6b79c',
    accentSoft: '#fde6d9',

    danger: '#a3214c',
    dangerSoft: '#fde6ea',
    success: '#2f7347',
    successSoft: '#e3f2e4',
    warning: '#855a0c',

    scrim: '#3a251d66',
    pressed: '#4a32290f',

    switchTrack: '#ecd5c7',
    switchThumb: '#ffffff',

    selected: '#fbe3d3',
    onSelected: '#4a3229',

    outline: '#00000000',
  },
};
