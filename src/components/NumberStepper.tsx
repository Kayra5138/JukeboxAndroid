import { useState } from 'react';
import { TYPE, RADIUS, SPACE } from '../lib/theme/measures';
import { StyleSheet, Text, View } from 'react-native';

import { MinusIcon, PlusIcon } from './Icons';
import { Pressable } from './Pressable';
import { TextPrompt } from './TextPrompt';
import { useT } from '../lib/i18n/index';
import { makeStyles, outlined, outlinedClip, useColours, usePressed } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';
import { clampTo, wholeIn, type Range } from '../lib/ui/range';

/**
 * A number chosen from a range, where a row of a few offered was: one less,
 * one more, and the number itself to press and type any other. For a setting
 * whose right answer is somebody's own — how many episodes, how many days —
 * and not one of four someone else thought of.
 *
 * [label] is how a number is said, where it is said otherwise than as itself:
 * nought days as "by hand", nought songs as "none".
 */
export function NumberStepper({
  value,
  range,
  onChange,
  label,
  name,
  disabled = false,
}: {
  value: number;
  range: Range;
  onChange: (value: number) => void;
  label?: (value: number) => string;
  /** The setting's own name, for a screen reader and over the box it is typed into. */
  name: string;
  disabled?: boolean;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const [typing, setTyping] = useState(false);
  const said = (number: number) => label?.(number) ?? t.format.number(number);

  const step = (by: 1 | -1) => {
    const next = clampTo(value + by, range);
    if (next === value) return;
    haptic('notches', 'tick');
    onChange(next);
  };

  const less = disabled || value <= range.min;
  const more = disabled || value >= range.max;

  return (
    <View
      style={[styles.row, disabled && styles.off]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={name}
      accessibilityValue={{ min: range.min, max: range.max, now: value, text: said(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate', label: t.common.typeNumber }]}
      onAccessibilityAction={(event) => {
        const action = event.nativeEvent.actionName;
        if (action === 'increment') step(1);
        else if (action === 'decrement') step(-1);
        else if (action === 'activate' && !disabled) setTyping(true);
      }}>
      <Pressable
        android_ripple={pressed}
        disabled={less}
        importantForAccessibility="no"
        style={[styles.button, less && styles.buttonOff]}
        onPress={() => step(-1)}>
        <MinusIcon size={18} color={c.text} />
      </Pressable>
      <Pressable
        android_ripple={pressed}
        disabled={disabled}
        importantForAccessibility="no"
        style={styles.value}
        onPress={() => setTyping(true)}>
        <Text style={styles.valueLabel} numberOfLines={1}>{said(value)}</Text>
      </Pressable>
      <Pressable
        android_ripple={pressed}
        disabled={more}
        importantForAccessibility="no"
        style={[styles.button, more && styles.buttonOff]}
        onPress={() => step(1)}>
        <PlusIcon size={18} color={c.text} />
      </Pressable>
      <TextPrompt
        visible={typing}
        heading={name}
        hint={t.common.wholeFrom(range.min, range.max)}
        placeholder={String(value)}
        initial={String(value)}
        keyboardType="number-pad"
        confirmLabel={t.common.ok}
        onSubmit={(typed) => {
          const number = wholeIn(typed, range);
          setTyping(false);
          if (number == null || number === value) return;
          haptic('choices', 'click');
          onChange(number);
        }}
        onClose={() => setTyping(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s, alignSelf: 'flex-start' },
  off: { opacity: 0.45 },
  button: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
    ...outlinedClip(c),
  },
  buttonOff: { opacity: 0.35 },
  value: {
    minWidth: 64,
    height: 40,
    paddingHorizontal: SPACE.m,
    borderRadius: RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    ...outlined(c),
  },
  valueLabel: { color: c.text, fontSize: TYPE.heading, fontWeight: '600', fontVariant: ['tabular-nums'] },
}));
