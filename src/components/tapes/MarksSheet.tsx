import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CrossIcon } from '../Icons';
import { Pressable } from '../Pressable';
import { TextPrompt } from '../TextPrompt';
import { useT } from '../../lib/i18n/index';
import { removeMark, setMarkNote, useMarks, type TapeMark } from '../../lib/tapes/marks';
import { makeStyles, outlined, useColours, usePressed } from '../../lib/theme/index';
import { scrimOf, useWindowVeil } from '../../lib/theme/Veil';
import { haptic } from '../../lib/ui/haptics';
import { durationLabel } from '../../lib/youtube/types';

/**
 * The places marked in the tape playing, in the order they come in it, from
 * the player. A mark pressed is gone to; held, its note is written again;
 * its cross takes it away. Every mark of every tape is a press further, on a
 * screen of their own.
 */
export function MarksSheet({
  visible,
  trackId,
  onSeek,
  onAll,
  onClose,
}: {
  visible: boolean;
  trackId: string | null;
  onSeek: (seconds: number) => void;
  /** Every mark, of every tape. */
  onAll: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.player.marks;
  const marks = useMarks(trackId);
  const [editing, setEditing] = useState<TapeMark | null>(null);
  /*
    Held, a mark's note is asked for as the finger comes up rather than while
    it is still down: the box opened under a finger that then lifted, and the
    lifting went to the window the box replaced, so the first press in the
    box, its Save, was taken as the end of that touch and did nothing.
  */
  const held = useRef<TapeMark | null>(null);
  useWindowVeil(visible && editing == null);

  return (
    <>
      <Modal visible={visible && editing == null} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
          <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
            <Text accessibilityRole="header" style={styles.heading}>{said.heading}</Text>
            {marks.length === 0 ? <Text style={styles.note}>{said.none}</Text> : null}
            <ScrollView style={styles.list}>
              {marks.map((mark) => (
                <Pressable
                  key={mark.id}
                  android_ripple={pressed}
                  accessibilityRole="button"
                  accessibilityHint={said.goHint}
                  accessibilityActions={[{ name: 'longpress', label: said.editNote }]}
                  onAccessibilityAction={() => setEditing(mark)}
                  style={styles.row}
                  onPress={() => {
                    haptic('player', 'tick');
                    onSeek(mark.positionSec);
                    onClose();
                  }}
                  onLongPress={() => {
                    held.current = mark;
                  }}
                  onPressOut={() => {
                    if (held.current) setEditing(held.current);
                    held.current = null;
                  }}>
                  <Text style={styles.time}>{durationLabel(mark.positionSec)}</Text>
                  <Text style={[styles.text, !mark.note && styles.textNone]} numberOfLines={3}>
                    {mark.note ?? said.noNote}
                  </Text>
                  <Pressable
                    android_ripple={pressed}
                    accessibilityRole="button"
                    accessibilityLabel={said.remove(durationLabel(mark.positionSec))}
                    hitSlop={8}
                    style={styles.remove}
                    onPress={() => {
                      haptic('choices', 'toggleOff');
                      removeMark(mark.id);
                    }}>
                    <CrossIcon size={14} color={c.textMuted} />
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
            {marks.length > 0 ? <Text style={styles.note}>{said.howTo}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                android_ripple={pressed}
                style={styles.button}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  onAll();
                }}>
                <Text style={styles.buttonAccent}>{said.all}</Text>
              </Pressable>
              <Pressable android_ripple={pressed} style={styles.button} accessibilityRole="button" onPress={onClose}>
                <Text style={styles.buttonLabel}>{t.common.close}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <TextPrompt
        visible={editing != null}
        heading={editing ? said.noteAt(durationLabel(editing.positionSec)) : ''}
        placeholder={said.notePlaceholder}
        initial={editing?.note ?? ''}
        optional
        onSubmit={(note) => {
          if (editing) setMarkNote(editing.id, note);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: scrimOf(c), alignItems: 'center', justifyContent: 'center', padding: 28 },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: 14,
    paddingVertical: 18,
    gap: 12,
    alignSelf: 'stretch',
    maxHeight: '80%',
    ...outlined(c),
  },
  heading: { color: c.text, fontSize: 15, fontWeight: '600', paddingHorizontal: 18 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
  time: { color: c.accent, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 52, paddingTop: 1 },
  text: { flex: 1, color: c.text, fontSize: 14.5, lineHeight: 20 },
  textNone: { color: c.textFaint },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  note: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 18 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18 },
  button: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, overflow: 'hidden' },
  buttonLabel: { color: c.textSecondary, fontSize: 14 },
  buttonAccent: { color: c.accent, fontSize: 14, fontWeight: '600' },
}));
