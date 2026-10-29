import { withEffects } from '../effects.ts';
import type { Theme } from '../tokens.ts';
import { GLASS, GLASS_FINISH } from './glass.ts';

/**
 * Sundown glass: the night glass over the last of a sunset.
 *
 * The same panes as `glass`, over a sky that goes from a plum near black at
 * the top through magenta to an ember at the foot, with a pink glow high on
 * one side and the sun's own orange low on the other. The ink is the glass's,
 * warmed a little; the accent is a pale rose, which reads on every pane and is
 * nothing like the red that says something went wrong.
 */
export const sundown: Theme = {
  id: 'sundown',
  nameKey: 'sundown',
  group: 'effects',
  base: 'dark',
  colours: withEffects(
    {
      ...GLASS,
      bg: '#170a1c',
      onPrimary: '#170a1c',

      text: '#fbf1f6',
      textSecondary: '#f1e0ea',
      textMuted: '#ecd9e5',
      textFaint: '#e4cfdc',
      textDisabled: '#9a7f92',
      primary: '#fbf1f6',

      accent: '#ffd5e7',
      onAccent: '#170a1c',
      accentMuted: '#ffd5e752',
      accentSoft: '#ffd5e721',

      danger: '#ffd3c6',
      dangerSoft: '#ffc9b81a',
      warning: '#ffd99a',

      scrim: '#0b040e55',
      switchThumb: '#f1e0ea',
      onSelected: '#fbf1f6',
    },
    {
      ...GLASS_FINISH,
      backdrop: [
        'radial-gradient(circle at 86% 30%, #e0409a1c 0%, #e0409a00 55%)',
        'radial-gradient(circle at 12% 88%, #ff7a3d1c 0%, #ff7a3d00 50%)',
        'linear-gradient(180deg, #170a1c 0%, #33103c 38%, #4a1238 66%, #4f1a22 88%, #4a2214 100%)',
      ],
    }
  ),
};
