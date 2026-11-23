import { StyleSheet, View } from 'react-native';

import { TickIcon } from './Icons';
import { Pressable } from './Pressable';
import { makeStyles, useColours } from '../lib/theme/index';
import { CHECK, RADIUS, TOUCH } from '../lib/theme/measures';

/**
 * A tick box, or a round choice of one among several: the one the app has.
 * There were six of them, in four sizes and three edges, and four ways of
 * drawing "some of these".
 *
 * - `box`: one of many that may be chosen together. [mixed] where it stands
 *   for several and only some of them are chosen.
 * - `radio`: the one of a few that is chosen; choosing another unchooses it.
 *
 * Given [onPress], it is pressed by itself, by a finger's room round it; a
 * row that is pressed as a whole to tick it draws one without, and says what
 * it is itself.
 */
export function Check({
  on,
  mixed = false,
  shape = 'box',
  onPress,
  accessibilityLabel,
}: {
  on: boolean;
  mixed?: boolean;
  shape?: 'box' | 'radio';
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const filled = on || mixed;
  const mark = (
    <View style={[styles.mark, shape === 'radio' ? styles.radio : styles.box, filled && (shape === 'radio' ? styles.radioOn : styles.boxOn)]}>
      {shape === 'radio' ? (on ? <View style={styles.dot} /> : null) : mixed && !on ? <View style={styles.dash} /> : on ? <Tick /> : null}
    </View>
  );
  if (!onPress) return mark;
  return (
    <Pressable
      accessibilityRole={shape === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: mixed && !on ? 'mixed' : on }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={SLOP}
      onPress={onPress}>
      {mark}
    </Pressable>
  );
}

function Tick() {
  const c = useColours();
  return <TickIcon size={CHECK - 4} color={c.onAccent} />;
}

/** What a box a finger's width is given round it. */
const SLOP = (TOUCH.normal - CHECK) / 2;

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    mark: { width: CHECK, height: CHECK, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.textMuted },
    box: { borderRadius: RADIUS.check },
    boxOn: { backgroundColor: c.accent, borderColor: c.accent },
    radio: { borderRadius: CHECK / 2 },
    radioOn: { borderColor: c.accent },
    dot: { width: CHECK / 2, height: CHECK / 2, borderRadius: CHECK / 4, backgroundColor: c.accent },
    dash: { width: CHECK / 2, height: 2, borderRadius: 1, backgroundColor: c.onAccent },
  })
);
