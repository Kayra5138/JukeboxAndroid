import { withEffects } from '../effects.ts';
import type { Palette, Theme } from '../tokens.ts';

/**
 * Night glass: panes of glass over a sky after dark.
 *
 * The page is a deep indigo going to teal at the foot, with two slow glows
 * in it, and nothing on it is a fill of its own: every card is white at a
 * few parts in a hundred, so it is the page seen through something, lighter
 * the nearer it is. That is the app's one rule about depth — nearer is
 * lighter — kept by stacking rather than by choosing shades.
 *
 * The glows keep clear of the top. A screen pushed over the tabs has the
 * phone's own bar above it in flat `bg`, and the page has to begin there.
 *
 * The neutrals are written for others to borrow: a theme that is the same
 * glass over a different sky takes `GLASS` and changes what is behind it.
 */
export const GLASS: Palette = {
  bg: '#0c1022',
  bar: '#ffffff0f',
  surface: '#ffffff14',
  surfaceRaised: '#ffffff1f',
  border: '#ffffff1f',
  borderStrong: '#ffffff52',

  text: '#f2f4fb',
  textSecondary: '#e0e3f0',
  textMuted: '#cfd3e4',
  textFaint: '#c4c9dd',
  textDisabled: '#7d86a4',

  primary: '#f2f4fb',
  onPrimary: '#0c1022',

  accent: '#c6e1ff',
  onAccent: '#0c1022',
  accentMuted: '#c6e1ff52',
  accentSoft: '#c6e1ff21',

  danger: '#ffc4c4',
  dangerSoft: '#ffc4c41a',
  success: '#b0efc4',
  successSoft: '#b0efc41a',
  warning: '#f5da98',

  scrim: '#060a1899',
  pressed: '#ffffff1f',

  switchTrack: '#ffffff26',
  switchThumb: '#e0e3f0',

  selected: '#ffffff29',
  onSelected: '#f2f4fb',

  // The rim: where a pane catches the light.
  outline: '#ffffff2e',
};

/** What glass does whatever is behind it: a little light along the top, and a soft standing-off. */
export const GLASS_FINISH = {
  sheen: 'linear-gradient(180deg, #ffffff1a 0px, #ffffff00 56px)',
  shadow: null,
  veil: 18,
  coverWash: 0.7,
} as const;

export const glass: Theme = {
  id: 'glass',
  nameKey: 'glass',
  group: 'effects',
  base: 'dark',
  colours: withEffects(
    { ...GLASS },
    {
      ...GLASS_FINISH,
      backdrop: [
        'radial-gradient(circle at 88% 38%, #5b3fd047 0%, #5b3fd000 55%)',
        'radial-gradient(circle at 8% 82%, #15747e47 0%, #15747e00 50%)',
        'linear-gradient(180deg, #0c1022 0%, #101736 50%, #0a2532 100%)',
      ],
    }
  ),
};
