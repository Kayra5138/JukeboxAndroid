import { Image as Plain, type ImageProps } from 'expo-image';
import type { Ref } from 'react';

import { useTheme } from '../lib/theme/index';

/**
 * The app's `Image`: expo-image's, made afresh when the theme becomes a
 * different theme.
 *
 * A picture is drawn by a native view that fetches what it shows and holds
 * on to it. A change of theme can take such a view out of the window and put
 * it back — a wrapper somewhere above it that had nothing to draw is given a
 * border or a fill by the new theme, or loses one, and everything inside it
 * is handed from one parent to another — and a view that has been through
 * that does not always fetch its picture again. Covers went missing from
 * rows at random, twice: once on leaving the theme that outlines everything,
 * and again on going between a flat theme and one of glass.
 *
 * Keeping the theme's colours out of a picture's own style, which was the
 * first answer, is still right and was never the whole of it. This is: a
 * view made new has nothing to have lost. The pictures come back out of
 * memory, so it costs a short fade.
 *
 * By the theme's name and not its colours, on purpose. A theme that follows
 * the record changes its colours at every track and nothing about what has
 * a border; making every cover again each time a song ended would be the
 * flicker this is here to avoid.
 */
export function Image(props: ImageProps & { ref?: Ref<Plain> }) {
  return <Plain key={useTheme().id} {...props} />;
}
