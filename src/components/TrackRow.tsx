import { memo } from 'react';
import { Image } from './Picture';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Pressable';

import { useT } from '../lib/i18n/index';
import { useTrackArtwork } from '../lib/media/artwork';
import type { EnrichedTrack } from '../lib/media/merge';
import { makeStyles, outlined, usePressed } from '../lib/theme/index';

/** Fixed so the list can lay itself out without measuring every row. */
export const TRACK_ROW_HEIGHT = 68;

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Memoised because each row resolves its own cover, which means a native call
 * and a file read the first time. Re-rendering the list on every keystroke of a
 * search would otherwise repeat that work for rows that have not changed.
 *
 * The handlers are handed the track back rather than closing over it, so every
 * row can be given the same two functions. Closures built per row inside
 * `renderItem` are new objects on each pass and fail the shallow compare, which
 * left this memo costing a comparison and saving nothing.
 */
export const TrackRow = memo(function TrackRow({
  track,
  playing,
  onPress,
  onLongPress,
  selectable = false,
  selected = false,
  shared = false,
}: {
  track: EnrichedTrack;
  playing: boolean;
  onPress: (track: EnrichedTrack) => void;
  onLongPress?: (track: EnrichedTrack) => void;
  /** Shows a checkbox; the row is being chosen rather than played. */
  selectable?: boolean;
  selected?: boolean;
  /** True when the row is one of several across, and must share the width. */
  shared?: boolean;
}) {
  const artwork = useTrackArtwork(track);
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const subtitle = [track.artist ?? t.common.unknownArtist, ...track.tags.slice(0, 2)].join(' · ');

  return (
    <Pressable
      android_ripple={pressed}
      style={[styles.row, shared && styles.rowShared, selected && styles.rowSelected]}
      onPress={() => onPress(track)}
      onLongPress={onLongPress && (() => onLongPress(track))}
      // A long press is not something a screen reader's user can be expected
      // to find by trying. Named, it is in the reader's own list of actions.
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: t.library.trackMenu }] : undefined}
      onAccessibilityAction={
        onLongPress &&
        ((event) => {
          if (event.nativeEvent.actionName === 'longpress') onLongPress(track);
        })
      }>
      {selectable ? (
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
      ) : null}
      {artwork ? (
        <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" transition={120} />
      ) : (
        <View style={[styles.art, styles.artEmpty]} />
      )}

      <View style={styles.text}>
        <Text style={[styles.title, playing && styles.titlePlaying]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.duration}>{formatDuration(track.durationSec)}</Text>
    </Pressable>
  );
});

const useStyles = makeStyles((c) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: TRACK_ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  rowShared: { flex: 1, minWidth: 0 },
  rowSelected: { backgroundColor: c.accentSoft },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: c.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 13, fontWeight: '700', lineHeight: 15 },
  /*
    The picture's own style holds no colour of the theme's, only its shape.

    A cover is drawn by a native image view that loads what it shows. Given a
    new background when the theme changes — which reaches every row at once,
    on a tab that is out of sight at the time — some of those views let go of
    their picture and did not fetch it again: rows in the library lost their
    covers at random until the app was restarted, while the player, whose
    picture had no themed style, never did. The colour behind a cover that is
    missing belongs to the empty box, below, which is a plain view.
  */
  art: { width: 46, height: 46, borderRadius: 6 },
  artEmpty: { backgroundColor: c.surface, ...outlined(c) },
  text: { flex: 1, gap: 3 },
  title: { color: c.text, fontSize: 15.5 },
  // Heavier as well as coloured: the colour is the only thing that changes
  // otherwise, and not everybody is shown a colour.
  titlePlaying: { color: c.accent, fontWeight: '600' },
  subtitle: { color: c.textMuted, fontSize: 12.5 },
  duration: { color: c.textFaint, fontSize: 12, fontVariant: ['tabular-nums'] },
}));
