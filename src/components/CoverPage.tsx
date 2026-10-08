import { Image } from './Picture';
import { StyleSheet, View } from 'react-native';

import { effectsOf, makeStyles, useColours, withAlpha } from '../lib/theme/index';

/**
 * The cover of what is playing, out of focus, as the page the player is
 * drawn on. Only in a theme that asks for it; nothing at all in the rest.
 *
 * Laid over the page the player already has and under everything else on
 * it, so with no cover, or while one is being read, the player is on the
 * page it would have had anyway.
 *
 * The picture is drawn a quarter of the size and stretched back to fit. The
 * blur a picture can be given here stops at a fixed number of its own
 * pixels, which on a cover the width of the screen is a soft focus and not
 * a frosted one; a quarter of the pixels is four times the blur, and a
 * sixteenth of the work.
 *
 * Over it goes a wash of the page's own colour, most of the way to solid,
 * as far as the theme says. That is what makes it a page and not a picture:
 * whatever the cover is — white, black, a photograph of the sun — what is
 * written on the player is written on something near the colour the theme's
 * ink was chosen for.
 */
export function CoverPage({ uri }: { uri: string | null | undefined }) {
  const c = useColours();
  const styles = useStyles();
  if (!uri || !effectsOf(c)?.coverWash) return null;
  return (
    <View pointerEvents="none" style={styles.page}>
      <Image source={{ uri }} blurRadius={25} contentFit="cover" transition={500} style={styles.picture} />
      <View style={styles.wash} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
    // No colour of the theme's on the picture itself: one given a theme
    // colour loses what it was showing when the theme changes.
    picture: { width: '25%', height: '25%', transformOrigin: 'top left', transform: [{ scale: 4 }] },
    wash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: withAlpha(c.bg, effectsOf(c)?.coverWash ?? 1) },
  })
);
