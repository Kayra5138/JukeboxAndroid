import { memo } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTrackArtwork } from '../lib/media/artwork';
import type { EnrichedTrack } from '../lib/media/merge';

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
  const subtitle = [track.artist ?? 'Unknown artist', ...track.tags.slice(0, 2)].join(' · ');

  return (
    <Pressable
      style={[styles.row, shared && styles.rowShared, selected && styles.rowSelected]}
      onPress={() => onPress(track)}
      onLongPress={onLongPress && (() => onLongPress(track))}>
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: TRACK_ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  rowShared: { flex: 1, minWidth: 0 },
  rowSelected: { backgroundColor: '#1d2733' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#5a5a5a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#7ab8ff', borderColor: '#7ab8ff' },
  checkMark: { color: '#121212', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  art: { width: 46, height: 46, borderRadius: 6, backgroundColor: '#1c1c1c' },
  artEmpty: { backgroundColor: '#1c1c1c' },
  text: { flex: 1, gap: 3 },
  title: { color: '#ededed', fontSize: 15.5 },
  titlePlaying: { color: '#7ab8ff' },
  subtitle: { color: '#7a7a7a', fontSize: 12.5 },
  duration: { color: '#5a5a5a', fontSize: 12, fontVariant: ['tabular-nums'] },
});
