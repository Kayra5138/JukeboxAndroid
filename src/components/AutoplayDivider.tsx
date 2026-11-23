import { StyleSheet, Text, View } from 'react-native';
import { SPACE, TYPE } from '../lib/theme/measures';

import { TextButton } from './Button';
import { useT } from '../lib/i18n/index';
import { sectionKind } from '../lib/player/autoplay/plan';
import { useAutoplayNote } from '../lib/player/autoplay/setting';
import { makeStyles } from '../lib/theme/index';

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
      <TextButton label={said.remove} strong accessibilityLabel={said.removeLabel} accessibilityHint={said.removeHint} onPress={onRemove} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.s, paddingHorizontal: SPACE.l },
    text: { flex: 1, gap: SPACE.xxs },
    heading: { color: c.textFaint, fontSize: TYPE.label, fontWeight: '600', letterSpacing: 0.8 },
    note: { color: c.textMuted, fontSize: TYPE.label },
  })
);
