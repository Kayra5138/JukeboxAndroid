import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Dialog } from '../Dialog';
import { TimedRow } from '../TimedRow';
import { LEADING, SPACE, TYPE } from '../../lib/theme/measures';
import { TextPrompt } from '../TextPrompt';
import { useT } from '../../lib/i18n/index';
import { removeMark, setMarkNote, useMarks, type TapeMark } from '../../lib/tapes/marks';
import { makeStyles } from '../../lib/theme/index';
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
  const styles = useStyles();
  const said = t.player.marks;
  const marks = useMarks(trackId);
  const [editing, setEditing] = useState<TapeMark | null>(null);
  /*
    Held, a mark's note is asked for as the finger comes up rather than while
    it is still down (`TimedRow`): the box opened under a finger that then
    lifted, and the lifting went to the window the box replaced, so the first
    press in the box, its Save, was taken as the end of that touch and did
    nothing. The card is put away while the box is up.
  */
  return (
    <>
      <Dialog
        visible={visible && editing == null}
        onClose={onClose}
        title={said.heading}
        body={marks.length === 0 ? said.none : undefined}
        edge
        answers={[
          { label: t.common.close, kind: 'quiet', onPress: onClose },
          {
            label: said.all,
            onPress: () => {
              onClose();
              onAll();
            },
          },
        ]}>
        <ScrollView style={styles.list}>
          {marks.map((mark) => (
            <TimedRow
              key={mark.id}
              at={durationLabel(mark.positionSec)}
              text={mark.note ?? said.noNote}
              empty={!mark.note}
              accessibilityHint={said.goHint}
              holdLabel={said.editNote}
              onPress={() => {
                haptic('player', 'tick');
                onSeek(mark.positionSec);
                onClose();
              }}
              onHold={() => setEditing(mark)}
              removeLabel={said.remove(durationLabel(mark.positionSec))}
              onRemove={() => {
                haptic('choices', 'toggleOff');
                removeMark(mark.id);
              }}
            />
          ))}
        </ScrollView>
        {marks.length > 0 ? <Text style={styles.note}>{said.howTo}</Text> : null}
      </Dialog>
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
  // As tall as its marks, up to what the card allows, and scrolled past that.
  list: { flexGrow: 0 },
  note: { color: c.textMuted, fontSize: TYPE.hint, lineHeight: LEADING.hint, paddingHorizontal: SPACE.l },
}));
