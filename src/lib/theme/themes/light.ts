import type { Theme } from '../tokens.ts';

/**
 * The light one, drawn for itself rather than turned inside out.
 *
 * Inverting the dark theme would put cards darker than the page, and they are
 * not: a card is nearer than what it lies on in both, so here it is white on a
 * page a little off white, and what sits on a card is a touch greyer again.
 *
 * The greys lean very slightly blue, which keeps a mostly white screen from
 * looking like paper left in the sun. The accent is the same blue taken a long
 * way down, because the sky blue that glows on black is unreadable as text on
 * white; this one clears 4.5:1 against the page, a card and a chip alike, as
 * does every level of text meant to be read.
 */
export const light: Theme = {
  id: 'light',
  nameKey: 'light',
  group: 'basic',
  base: 'light',
  colours: {
    bg: '#f4f4f6',
    bar: '#fbfbfc',
    surface: '#ffffff',
    surfaceRaised: '#ececf0',
    border: '#e2e2e7',
    borderStrong: '#c4c4cb',

    text: '#18181b',
    textSecondary: '#45454b',
    textMuted: '#57575e',
    textFaint: '#64646b',
    textDisabled: '#8e8e96',

    primary: '#18181b',
    onPrimary: '#ffffff',

    accent: '#1a62c2',
    onAccent: '#ffffff',
    accentMuted: '#a9cbf2',
    accentSoft: '#e1ecfb',

    danger: '#b93229',
    dangerSoft: '#fbe9e7',
    success: '#1c723a',
    successSoft: '#e2f3e7',
    warning: '#85560a',

    scrim: '#00000066',
    pressed: '#0000000f',

    switchTrack: '#d2d2d9',
    switchThumb: '#ffffff',

    selected: '#ececf0',
    onSelected: '#18181b',

    outline: '#00000000',
  },
};
