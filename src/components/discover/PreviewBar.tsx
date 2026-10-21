import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PauseIcon } from '../Icons';
import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { useDiscoverActions } from '../../lib/discover/DiscoverProvider';
import type { DiscoverPreview } from '../../lib/discover/view';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlineWidth, usePressed } from '../../lib/theme/index';
import { barGlass } from '../UnderBars';

/**
 * What is coming out of the speaker when it is a preview.
 *
 * Where the bar that says what is playing would be, and in its place: a
 * preview is not in the player, so the player's own bar would go on naming
 * whatever was paused to make room for it — the wrong song, under the right
 * sound. This names the song that is being heard and says, before anything
 * else, that it is a preview of it and that the song itself is coming.
 *
 * One thing can be done to it, which is to stop it. There is nothing to open:
 * it has no place in the queue, no length worth a scrubber, and thirty
 * seconds from now it is the song or it is silence.
 */
export function PreviewBar({
  preview,
  column = false,
  width,
}: {
  preview: DiscoverPreview;
  column?: boolean;
  /** How wide the panel is when it stands down the side: the width of the bar it stands in for. */
  width?: number;
}) {
  const { play } = useDiscoverActions();
  const insets = useSafeAreaInsets();
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover.preview;
  return (
    <View
      style={[
        column ? styles.column : styles.bar,
        column && { width, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14, paddingRight: 12 + insets.right },
      ]}
      accessibilityLiveRegion="polite">
      {preview.coverUrl ? (
        <Image source={{ uri: preview.coverUrl }} style={column ? styles.artWide : styles.art} contentFit="cover" />
      ) : (
        <View style={[column ? styles.artWide : styles.art, styles.artEmpty]} />
      )}
      <View style={column ? styles.columnText : styles.text}>
        <View style={styles.heading}>
          <Text style={styles.label}>{t.format.upper(said.label)}</Text>
          <Text style={styles.title} numberOfLines={column ? 2 : 1}>
            {preview.title}
          </Text>
        </View>
        <Text style={styles.note} numberOfLines={column ? 3 : 1}>
          {[preview.artist, said.note].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {/* A tap on the row that is being previewed stops it, and this is that tap. The song goes on being fetched. */}
      <Pressable
        android_ripple={pressed}
        style={styles.stop}
        // Drawn at 44; this much further is the 48 a finger is owed.
        hitSlop={2}
        accessibilityRole="button"
        accessibilityLabel={said.stop}
        onPress={() => play(preview.id)}>
        <PauseIcon size={24} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  // The measures of the bar it stands in for, so that the screen above it does not move when one gives way to the other.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderTopColor: c.border,
    backgroundColor: c.surface,
    // As the bar's, in a theme of glass: laid over a list, and washed to be read over it.
    ...barGlass(c),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  column: {
    justifyContent: 'center',
    borderLeftWidth: Math.max(StyleSheet.hairlineWidth, outlineWidth(c)),
    borderLeftColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingTop: 14,
    gap: 10,
  },
  art: { width: 40, height: 40, borderRadius: 6 },
  artWide: { width: '100%', aspectRatio: 1, borderRadius: 7 },
  artEmpty: { backgroundColor: c.surfaceRaised },
  text: { flex: 1, minWidth: 0, gap: 2 },
  columnText: { gap: 3 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The one word that matters here, where the eye lands first and in the colour the app keeps for what is chosen.
  label: { color: c.accent, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  title: { color: c.text, fontSize: 14.5, flexShrink: 1 },
  note: { color: c.textMuted, fontSize: 12 },
  stop: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
}));
