import { materialColours } from '../material.ts';
import type { Theme } from '../tokens.ts';
import { dark } from './dark.ts';
import { light } from './light.ts';

/**
 * System colours: the palette the phone made from its wallpaper, which is
 * what Android calls Material You.
 *
 * The one theme that is two. The phone's palette is neither light nor dark —
 * it is a set of ramps to make either from — so this follows the phone's own
 * setting the way "System" does, and is light by day on a phone that is.
 *
 * Only on Android 12 and later, and only on a build of the app that knows
 * how to ask; anywhere else it is not offered. Chosen and then carried to a
 * phone that cannot answer — a backup restored onto an older one — it is the
 * default theme of the right way up, which is "System" by another name.
 */
export const material: Theme = {
  id: 'material',
  nameKey: 'material',
  group: 'special',
  base: 'dark',
  colours: dark.colours,
  dynamic: {
    needs: ['system'],
    available: (around) => around.system != null,
    resolve: (around) => {
      const plain = around.scheme === 'light' ? light : dark;
      if (!around.system) return { base: plain.base, colours: plain.colours };
      return {
        base: around.scheme,
        colours: materialColours(around.system, around.scheme, plain.colours),
      };
    },
  },
};
