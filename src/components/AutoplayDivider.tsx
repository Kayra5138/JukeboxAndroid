import { StyleSheet, Text, View } from 'react-native';

import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { sectionKind } from '../lib/player/autoplay/plan';
import { useAutoplayNote } from '../lib/player/autoplay/setting';
import { makeStyles, usePressed } from '../lib/theme/index';

/**
 * The heading over the songs picked to keep the music going, drawn in the
 * queue as a row of its own, with the button that takes them all away.
 *
 * Named for what the songs turned out to be rather than what the setting
 * asks for, so that it is right whatever had to fill in; and with one line
 * under it where new songs were wanted and the library stood in for them.
 */
export function AutoplayDivider({ ids, onRemove }: { ids: readonly string[]; onRemove: () => void }) {
  const t = useT();
  const styles = useStyles();
  const pressed = usePressed();
  const note = useAutoplayNote();
  const said = t.player.queue.auto;
  const heading = said[sectionKind(ids)];

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {/*
          A heading to a screen reader, so that it can be jumped to and from,
          and read as the words are written rather than in the capitals drawn.
        */}
        <Text style={styles.heading} numberOfLines={1} accessibilityRole="header" accessibilityLabel={heading}>
          {t.format.upper(heading)}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={1}>
            {said.notes[note]}
          </Text>
        ) : null}
      </View>
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        accessibilityLabel={said.removeLabel}
        accessibilityHint={said.removeHint}
        style={styles.button}
        hitSlop={SLOP}
        onPress={onRemove}>
        <Text style={styles.buttonLabel}>{said.remove}</Text>
      </Pressable>
    </View>
  );
}

/** The button is a short word in a tall row; this brings what takes a press for it to a finger's width. */
const SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
    text: { flex: 1, gap: 2 },
    heading: { color: c.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
    note: { color: c.textMuted, fontSize: 11.5 },
    button: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    buttonLabel: { color: c.accent, fontSize: 13.5, fontWeight: '600' },
  })
);
