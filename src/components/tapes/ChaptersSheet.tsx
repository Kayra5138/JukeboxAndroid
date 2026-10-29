import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { usePlayerPosition } from '../../lib/player/PlayerProvider';
import { chapterAt, type Chapter } from '../../lib/tapes/extras';
import { makeStyles, outlined, usePressed } from '../../lib/theme/index';
import { scrimOf, useWindowVeil } from '../../lib/theme/Veil';
import { haptic } from '../../lib/ui/haptics';
import { durationLabel } from '../../lib/youtube/types';

/**
 * The chapters of the tape playing, from the player: each where it begins
 * and what it is called, the one it is in picked out. A chapter pressed is
 * gone to; and the sleep timer can be set to the end of the one it is in.
 */
export function ChaptersSheet({
  visible,
  chapters,
  durationSec,
  onSeek,
  onSleepAt,
  onClose,
}: {
  visible: boolean;
  chapters: readonly Chapter[];
  durationSec: number;
  onSeek: (seconds: number) => void;
  /** The sleep timer set to stop at [positionSec] in the tape: the end of this chapter, however long it takes to get there. */
  onSleepAt: (positionSec: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.player.chapters;
  const { positionSec } = usePlayerPosition(visible);
  const at = chapterAt(chapters, positionSec);
  const end = chapters[at + 1]?.startSec ?? durationSec;
  useWindowVeil(visible);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <Text accessibilityRole="header" style={styles.heading}>{said.heading(chapters.length)}</Text>
          <ScrollView style={styles.list}>
            {chapters.map((chapter, index) => (
              <Pressable
                key={`${index}-${chapter.startSec}`}
                android_ripple={pressed}
                accessibilityRole="button"
                accessibilityState={{ selected: index === at }}
                style={styles.row}
                onPress={() => {
                  haptic('player', 'tick');
                  onSeek(chapter.startSec);
                  onClose();
                }}>
                <Text style={[styles.time, index === at && styles.on]}>{durationLabel(chapter.startSec) || '0:00'}</Text>
                <Text style={[styles.title, index === at && styles.on]} numberOfLines={3}>
                  {chapter.title || said.untitled(index + 1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            {at >= 0 && end > positionSec ? (
              <Pressable
                android_ripple={pressed}
                style={styles.button}
                accessibilityRole="button"
                onPress={() => {
                  haptic('choices', 'toggleOn');
                  onSleepAt(end);
                  onClose();
                }}>
                <Text style={styles.buttonAccent}>{said.sleepAtEnd}</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable android_ripple={pressed} style={styles.button} accessibilityRole="button" onPress={onClose}>
              <Text style={styles.buttonLabel}>{t.common.close}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: scrimOf(c), alignItems: 'center', justifyContent: 'center', padding: 28 },
  sheet: { backgroundColor: c.surface, borderRadius: 14, paddingVertical: 18, gap: 12, alignSelf: 'stretch', maxHeight: '80%', ...outlined(c) },
  heading: { color: c.text, fontSize: 15, fontWeight: '600', paddingHorizontal: 18 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
  time: { color: c.textMuted, fontSize: 13.5, fontVariant: ['tabular-nums'], minWidth: 56, paddingTop: 1 },
  title: { flex: 1, color: c.text, fontSize: 14.5, lineHeight: 20 },
  on: { color: c.accent, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, overflow: 'hidden' },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
  buttonAccent: { color: c.accent, fontSize: 14, fontWeight: '600' },
}));
