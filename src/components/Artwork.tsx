import { StyleSheet, View } from 'react-native';

import { Image } from './Picture';
import { makeStyles } from '../lib/theme/index';
import { RADIUS, ROW_COVER, SPACE } from '../lib/theme/measures';

/**
 * A cover in a row: the one the app has, where there were eleven sizes of
 * them, five ways of rounding a corner and four colours for one missing.
 *
 * Always drawn from the small copy of the picture made for the size it is
 * drawn at (`drawnAt`), never the whole of it for a few dozen points.
 *
 * [progress], from nought to one, is how far into a tape it is, along the
 * foot of the cover over a darker strip so that it reads on any picture.
 *
 * Inside a view of its own always, so that the strip coming and going never
 * hands the picture from one parent to another, which a native picture does
 * not always come back from.
 */
export function Artwork({ uri, size = ROW_COVER, progress = null }: { uri: string | null | undefined; size?: number; progress?: number | null }) {
  const styles = useStyles();
  const shape = { width: size, height: size };
  return (
    <View collapsable={false}>
      {/*
        The picture's own style holds no colour of the theme's, only its
        shape: given a new background when the theme changed, some native
        pictures let go of what they showed and did not fetch it again. The
        colour behind a missing cover belongs to the empty box, a plain view.
      */}
      {uri ? <Image source={{ uri }} style={[styles.art, shape]} contentFit="cover" transition={FADE_MS} drawnAt={size} /> : <View style={[styles.art, styles.empty, shape]} />}
      {progress != null ? (
        <View style={styles.track} importantForAccessibility="no">
          <View style={[styles.done, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

/** How long a cover takes to fade in once it has been read. */
const FADE_MS = 120;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    art: { borderRadius: RADIUS.cover },
    empty: { backgroundColor: c.surfaceRaised },
    track: {
      position: 'absolute',
      left: SPACE.xs,
      right: SPACE.xs,
      bottom: SPACE.xs,
      height: SPACE.xs,
      borderRadius: SPACE.xxs,
      backgroundColor: 'rgba(0,0,0,0.55)',
      overflow: 'hidden',
    },
    done: { height: SPACE.xs, backgroundColor: c.accent },
  })
);
