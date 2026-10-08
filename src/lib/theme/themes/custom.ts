import { customColours, DEFAULT_SEEDS } from '../custom.ts';
import type { Theme } from '../tokens.ts';

/** What it is before any colours have been chosen, worked out once as the file loads. */
const untouched = customColours(DEFAULT_SEEDS);

/**
 * Custom: the theme somebody makes, from a page, an accent and perhaps a
 * card.
 *
 * Worked out like the cover's and the wallpaper's, and from as little: what
 * is around it is the two or three colours that were chosen, held with the
 * rest of the surroundings, and `customColours` makes everything else of
 * them. Which way up it is, is the page's to say, so this is a light theme
 * or a dark one according to what was picked and follows the phone in
 * nothing.
 *
 * Offered on every phone, since it needs nothing a phone might lack. Before
 * anybody has chosen a colour it is the default seeds' palette, which is a
 * theme in its own right and is what the picker shows.
 */
export const custom: Theme = {
  id: 'custom',
  nameKey: 'custom',
  group: 'special',
  base: untouched.base,
  colours: untouched.colours,
  dynamic: {
    needs: ['custom'],
    resolve: (around) => (around.custom ? customColours(around.custom) : untouched),
  },
};
