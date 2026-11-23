import { useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { CrossIcon } from './Icons';
import { RowControl } from './MediaRow';
import { Pressable } from './Pressable';
import { makeStyles, useColours, usePressed } from '../lib/theme/index';
import { LEADING, SPACE, TIME_COLUMN, TYPE } from '../lib/theme/measures';

/**
 * A point in something long, to go to: a mark in a tape, a chapter of a
 * book. Its time down a column of its own, [text] beside it a few lines at
 * most ([lines]), and [detail] under that (when a mark was made). [empty]
 * where the text is only what stands for none ("No note"), faint; [on] where
 * it is the one playing now, in the accent. [onHold] is a long press, told
 * when the finger lifts so that the lifting does not land on whatever it
 * opens; [onRemove] puts a cross at the end. The marks' page, the player's
 * marks and its chapters each drew their own.
 */
export function TimedRow({
  at,
  text,
  detail,
  empty = false,
  on = false,
  lines = 3,
  onPress,
  onHold,
  onRemove,
  removeLabel,
  accessibilityHint,
  holdLabel,
  style,
}: {
  at: string;
  text: string;
  detail?: string;
  empty?: boolean;
  on?: boolean;
  lines?: number;
  onPress: () => void;
  onHold?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  accessibilityHint?: string;
  /** What the long press does, said to a screen reader as an action of the row's. */
  holdLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const held = useRef(false);
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityState={on ? { selected: true } : undefined}
      accessibilityHint={accessibilityHint}
      accessibilityActions={onHold && holdLabel ? [{ name: 'longpress', label: holdLabel }] : undefined}
      onAccessibilityAction={onHold ? () => onHold() : undefined}
      style={[styles.row, style]}
      onPress={onPress}
      onLongPress={
        onHold
          ? () => {
              held.current = true;
            }
          : undefined
      }
      onPressOut={
        onHold
          ? () => {
              if (held.current) onHold();
              held.current = false;
            }
          : undefined
      }>
      <Text style={[styles.time, on && styles.on]}>{at}</Text>
      <View style={styles.words}>
        <Text style={[styles.text, empty && styles.empty, on && styles.on]} numberOfLines={lines}>
          {text}
        </Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {onRemove ? (
        <RowControl accessibilityLabel={removeLabel} onPress={onRemove}>
          <CrossIcon size={14} color={c.textMuted} />
        </RowControl>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.m, paddingHorizontal: SPACE.l, paddingVertical: SPACE.s + SPACE.xxs },
    time: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.body, fontVariant: ['tabular-nums'], minWidth: TIME_COLUMN },
    words: { flex: 1, minWidth: 0, gap: SPACE.xxs },
    text: { color: c.text, fontSize: TYPE.body, lineHeight: LEADING.body },
    empty: { color: c.textFaint },
    on: { color: c.accent, fontWeight: '600' },
    detail: { color: c.textFaint, fontSize: TYPE.hint },
  })
);
