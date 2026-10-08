import { withEffects } from '../effects.ts';
import type { Theme } from '../tokens.ts';

/**
 * Frosted glass: the same panes by day.
 *
 * A pale page, blue going to lilac, and cards that are white at a little
 * over half: enough of the page comes through for a card to be glass and
 * not paper, and little enough that ink on it reads as it does on white.
 * The rim is white, which on a light page is the edge of a pane seen from
 * the lit side.
 *
 * The ink is a navy and not a black, so that it belongs to the page it is
 * seen against, and every level of it meant to be read clears 4.5:1 over
 * the deepest part of either glow.
 */
export const frost: Theme = {
  id: 'frost',
  nameKey: 'frost',
  group: 'effects',
  base: 'light',
  colours: withEffects(
    {
      bg: '#e9eef7',
      bar: '#ffffff73',
      surface: '#ffffff8c',
      surfaceRaised: '#ffffff99',
      border: '#1b254a1f',
      borderStrong: '#1b254a59',

      text: '#161a2b',
      textSecondary: '#363c54',
      textMuted: '#444b64',
      textFaint: '#4d546d',
      textDisabled: '#8089a6',

      primary: '#161a2b',
      onPrimary: '#ffffff',

      accent: '#1f4fbd',
      onAccent: '#ffffff',
      accentMuted: '#1f4fbd66',
      accentSoft: '#1f4fbd1f',

      danger: '#a3221b',
      dangerSoft: '#a3221b1f',
      success: '#165c30',
      successSoft: '#165c301f',
      warning: '#6e4706',

      scrim: '#1b254a4d',
      pressed: '#1b254a14',

      switchTrack: '#1b254a2e',
      switchThumb: '#ffffff',

      selected: '#ffffffd9',
      onSelected: '#161a2b',

      outline: '#ffffffb3',
    },
    {
      backdrop: [
        'radial-gradient(circle at 88% 36%, #b3d0ff99 0%, #b3d0ff00 55%)',
        'radial-gradient(circle at 8% 84%, #f0c4e699 0%, #f0c4e600 50%)',
        'linear-gradient(180deg, #e9eef7 0%, #dfe8f7 50%, #e7e0f5 100%)',
      ],
      sheen: 'linear-gradient(180deg, #ffffff80 0px, #ffffff00 48px)',
      shadow: null,
      veil: 18,
      coverWash: 0.8,
    }
  ),
};
