import { accentFrom, coverColour } from '../coverAccent.ts';
import type { Theme } from '../tokens.ts';
import { dark } from './dark.ts';

/**
 * From the cover: the default dark theme, with the accent of whatever is
 * playing.
 *
 * Everything neutral is `dark`'s and stays put. Only the accent moves — what
 * is playing, what is on, what is selected — and it moves to the colour of
 * the record on the turntable, so the app is a little different for every
 * song without the furniture being rearranged each time one ends.
 *
 * Only the accent, on purpose: a page that changes colour every three
 * minutes is tiring in a way an accent that does is not.
 *
 * With nothing playing, no cover, or a cover with no colour in it, this is
 * `dark` exactly, sky blue and all.
 */
export const cover: Theme = {
  id: 'cover',
  nameKey: 'cover',
  group: 'special',
  base: 'dark',
  colours: dark.colours,
  dynamic: {
    needs: ['cover'],
    resolve: (around) => {
      const accent = accentFrom(coverColour(around.cover), dark.colours);
      return { base: 'dark', colours: accent ? { ...dark.colours, ...accent } : dark.colours };
    },
  },
};
