import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PauseIcon, PlayIcon } from '../Icons';
import { Image } from '../Picture';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { useTrackArtwork } from '../../lib/media/artwork';
import type { EnrichedTrack } from '../../lib/media/merge';
import { useIsCurrent, usePlayingId } from '../../lib/player/current';
import { progressOf, type TapePlace } from '../../lib/tapes/places';
import { makeStyles, outlinedClip, useColours, usePressed } from '../../lib/theme/index';
import { haptic } from '../../lib/ui/haptics';
import { durationLabel } from '../../lib/youtube/types';

/**
 * A tape on its own in the tapes view, as a show's or a book's row is: its
 * picture, its name and whose it is, how far into it you are and how long
 * is left, and a button that carries it on, starts it, or pauses it while it
 * plays. The row itself plays it too; held, it opens the tape's menu. While
 * tapes are being chosen the row is a tick box and the button is not there.
 */
export const TapeItemRow = memo(function TapeItemRow({
  track,
  place,
  onPress,
  onPlay,
  onLongPress,
  selectable = false,
  selected = false,
}: {
  track: EnrichedTrack;
  place: TapePlace | null;
  onPress: (track: EnrichedTrack) => void;
  /** Its button: played, played on, or paused where it is the one playing. */
  onPlay: (track: EnrichedTrack) => void;
  onLongPress: (track: EnrichedTrack) => void;
  selectable?: boolean;
  selected?: boolean;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const artwork = useTrackArtwork(track);
  const progress = progressOf(place);
  // Asked by the row itself, as `TrackRow` does: its button is a pause while it plays.
  const on = usePlayingId() === track.id;
  // In the player, playing or not: said to a screen reader; the button says it to the eye, as a show's does.
  const current = useIsCurrent(track.id);
  const verb = on ? t.common.pause : progress != null ? t.search.tapes.podcasts.continue : t.search.tapes.podcasts.start;
  const state = place?.finished
    ? t.library.tapes.played
    : progress != null && place
      ? t.library.tapes.left(Math.max(1, Math.round((place.durationSec - place.positionSec) / 60)))
      : durationLabel(track.durationSec);
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : { selected: current }}
      accessibilityActions={selectable ? undefined : [{ name: 'longpress', label: t.library.trackMenu }]}
      onAccessibilityAction={() => onLongPress(track)}
      style={[styles.row, selected && styles.rowSelected]}
      onPress={() => onPress(track)}
      onLongPress={() => {
        haptic('holds', 'hold');
        onLongPress(track);
      }}>
      {selectable ? (
        <View style={[styles.checkbox, selected && styles.checkboxOn]}>
          {selected ? <Text style={styles.checkMark} importantForAccessibility="no">✓</Text> : null}
        </View>
      ) : null}
      {artwork ? <Image source={{ uri: artwork }} style={styles.art} contentFit="cover" /> : <View style={[styles.art, styles.artEmpty]} />}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
        {track.artist ? <Text style={styles.subtitle} numberOfLines={1}>{track.artist}</Text> : null}
        <View style={styles.progressLine}>
          {progress != null ? (
            <View style={styles.track}>
              <View style={[styles.done, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          ) : null}
          <Text style={[styles.left, place?.finished && styles.heard]} numberOfLines={1}>{state}</Text>
        </View>
      </View>
      {selectable ? null : (
        <Pressable
          android_ripple={pressed}
          accessibilityRole="button"
          accessibilityLabel={`${verb}, ${track.title}`}
          hitSlop={6}
          style={styles.play}
          onPress={() => onPlay(track)}>
          {on ? <PauseIcon size={14} color={c.text} /> : <PlayIcon size={14} color={c.text} />}
          <Text style={styles.playLabel}>{verb}</Text>
        </Pressable>
      )}
    </Pressable>
  );
});

const useStyles = makeStyles((c) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowSelected: { backgroundColor: c.accentSoft },
  // No colour of the theme's on the picture itself; see TrackRow's `art`.
  art: { width: 46, height: 46, borderRadius: 6 },
  artEmpty: { backgroundColor: c.surface },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { color: c.text, fontSize: 15.5 },
  subtitle: { color: c.textMuted, fontSize: 12.5 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, maxWidth: 90, height: 3, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden' },
  done: { height: 3, backgroundColor: c.accent },
  left: { color: c.textFaint, fontSize: 12 },
  heard: { color: c.textFaint },
  // As a show's row has it: a raised surface, not the theme's own colour, which in a dark theme is all but white.
  play: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: c.surfaceRaised, ...outlinedClip(c) },
  playLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
  // As a track's row has it: see TrackRow.
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: c.textDisabled, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.onAccent, fontSize: 13, fontWeight: '700', lineHeight: 15 },
}));
