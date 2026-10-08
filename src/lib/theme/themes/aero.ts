import { withEffects } from '../effects.ts';
import type { Theme } from '../tokens.ts';

/**
 * Aero: a clear sky over grass, and everything on it polished.
 *
 * The look of a desktop from the years when a button was a drop of water:
 * the page runs from sky through aqua to a lawn, with the sun off to one
 * side, and every surface is white glass with a band of gloss across its
 * top — a hard-edged one, as if something bright were reflected in it,
 * where the other glass themes have a soft glow. On a chip the band is half
 * of it and it is a bead; on a card it is a shine along the upper edge.
 *
 * It is the one glass theme with a colour of its own for the button that
 * matters, a blue, because a black button has never been polished. The ink
 * is a deep navy, and the accent that same blue taken down until it can be
 * read as text over the lawn as well as over the sky.
 */
export const aero: Theme = {
  id: 'aero',
  nameKey: 'aero',
  group: 'effects',
  base: 'light',
  colours: withEffects(
    {
      bg: '#bfe3fb',
      bar: '#ffffff8c',
      surface: '#ffffff99',
      surfaceRaised: '#ffffffb8',
      border: '#0b2a4a24',
      borderStrong: '#0b2a4a66',

      text: '#0b2a4a',
      textSecondary: '#1d3b5a',
      textMuted: '#274664',
      textFaint: '#2d4c69',
      textDisabled: '#62809c',

      primary: '#0f6fc8',
      onPrimary: '#ffffff',

      accent: '#084f98',
      onAccent: '#ffffff',
      accentMuted: '#084f9866',
      accentSoft: '#084f9824',

      danger: '#9a1a14',
      dangerSoft: '#9a1a1424',
      success: '#0c5226',
      successSoft: '#0c522624',
      warning: '#5e3b00',

      scrim: '#0b2a4a4d',
      pressed: '#0b2a4a1a',

      switchTrack: '#0b2a4a33',
      switchThumb: '#ffffff',

      selected: '#ffffffe6',
      onSelected: '#0b2a4a',

      outline: '#ffffffcc',
    },
    {
      backdrop: [
        'radial-gradient(circle at 84% 30%, #ffffffb3 0%, #ffffff00 34%)',
        'linear-gradient(180deg, #bfe3fb 0%, #8fd0f5 42%, #7fdcc4 76%, #9be27f 100%)',
      ],
      sheen: 'linear-gradient(180deg, #ffffff59 0px, #ffffff14 22px, #ffffff00 23px)',
      shadow: 'inset 0 1px 0 0 #ffffffe6',
      veil: 16,
      coverWash: 0.8,
    }
  ),
};
