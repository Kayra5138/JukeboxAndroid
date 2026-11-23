import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Busy } from './Busy';
import { Pressable } from './Pressable';
import { makeStyles, outlined, useColours, usePressed } from '../lib/theme/index';
import { DISABLED, LEADING, RADIUS, SPACE, TOUCH, TYPE } from '../lib/theme/measures';

/**
 * A button: the one the app has, in its kinds, drawn from the app's measures
 * (`theme/measures.ts`). Every button is this; a place that wants one to look
 * other than these asks for a kind or an option here, and does not draw its own.
 *
 * - `primary`: the thing the screen is for (Save, Download all). One a screen.
 * - `secondary`: anything else to do there (Cancel, Stop, Choose a picture).
 * - `outline`: a choice beside the primary that is not a lesser one.
 * - `danger`: what cannot be taken back (Delete the copies).
 *
 * Busy, it says so with a spinner in place of its icon and is not pressed
 * again; switched off, it is faint and not pressed at all.
 *
 * [mark] draws it as a mark alone, in the colour it is handed, round, with
 * [label] kept for a screen reader: play, shuffle, put at the end of the
 * queue, which a mark says in any language and in less room than a word.
 */
export type ButtonKind = 'primary' | 'secondary' | 'outline' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'primary',
  size = 'normal',
  shape = 'rounded',
  wide = false,
  disabled = false,
  busy = false,
  hint,
  icon,
  mark,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  /** `normal` is a finger's height, 44; `small` is for a row or a card's corner. */
  size?: 'normal' | 'small';
  shape?: 'rounded' | 'pill';
  /** Takes the width it is given, sharing it with any other wide one beside it. */
  wide?: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** A line under the label, saying what the press will do. */
  hint?: string;
  icon?: ReactNode;
  mark?: (color: string) => ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const c = useColours();
  const pressed = usePressed();
  const off = disabled || busy;
  const ink = kind === 'primary' ? c.onPrimary : kind === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint ?? hint}
      accessibilityState={{ disabled: off, busy }}
      android_ripple={pressed}
      disabled={off}
      onPress={onPress}
      style={[
        styles.button,
        styles[kind],
        size === 'small' ? styles.small : styles.normal,
        shape === 'pill' && styles.pill,
        mark && (size === 'small' ? styles.markedSmall : styles.marked),
        wide && styles.wide,
        hint != null && styles.withHint,
        disabled && styles.off,
        style,
      ]}>
      <View style={styles.line}>
        {busy ? <Busy size={16} color={ink} /> : mark ? mark(ink) : icon}
        {mark ? null : <Text
          style={[styles.label, size === 'small' && styles.labelSmall, kind !== 'primary' && kind !== 'danger' && styles.labelQuiet, { color: ink }]}
          numberOfLines={2}>
          {label}
        </Text>}
      </View>
      {hint != null ? <Text style={[styles.hint, { color: kind === 'primary' || kind === 'danger' ? ink : c.textMuted }]}>{hint}</Text> : null}
    </Pressable>
  );
}

/**
 * Words that act, in the accent: Select all, Undo, Show all. Small, and given
 * a finger's height to be pressed by whatever room is round it.
 */
export function TextButton({
  label,
  onPress,
  tone = 'accent',
  size = 'small',
  strong = false,
  disabled = false,
  expanded,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'plain' | 'danger';
  /** Where it opens and shuts something under it: whether that is open, for a screen reader. */
  expanded?: boolean;
  size?: 'small' | 'body';
  strong?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const c = useColours();
  const ink = tone === 'accent' ? c.accent : tone === 'danger' ? c.danger : c.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      hitSlop={TEXT_SLOP}
      onPress={onPress}
      style={[styles.text, disabled && styles.off, style]}>
      <Text style={[size === 'body' ? styles.textBody : styles.textSmall, strong && styles.textStrong, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

/** What words a line high are given round them to make a finger's 44. */
const TEXT_SLOP = { top: 12, bottom: 12, left: SPACE.s, right: SPACE.s };

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    button: { alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.control },
    normal: { minHeight: TOUCH.normal, paddingHorizontal: SPACE.l, paddingVertical: SPACE.s },
    small: { minHeight: TOUCH.small, paddingHorizontal: SPACE.m, paddingVertical: SPACE.xs },
    pill: { borderRadius: RADIUS.pill },
    // A mark alone, round: as wide as it is high, a finger's size, and nothing to make it wider down a narrow column.
    marked: { width: TOUCH.normal, paddingHorizontal: 0, borderRadius: RADIUS.pill },
    markedSmall: { width: TOUCH.small, paddingHorizontal: 0, borderRadius: RADIUS.pill },
    wide: { flex: 1 },
    withHint: { paddingVertical: SPACE.m, alignItems: 'stretch' },
    off: { opacity: DISABLED },
    primary: { backgroundColor: c.primary, ...outlined(c, c.primary) },
    secondary: { backgroundColor: c.surfaceRaised, ...outlined(c) },
    outline: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong },
    danger: { backgroundColor: c.dangerSoft, ...outlined(c, c.danger) },
    line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.s },
    label: { fontSize: TYPE.body, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
    labelSmall: { fontSize: TYPE.small },
    labelQuiet: { fontWeight: '500' },
    hint: { fontSize: TYPE.hint, lineHeight: LEADING.hint, marginTop: SPACE.xxs, opacity: 0.85, textAlign: 'center' },
    text: { paddingVertical: SPACE.xs, alignSelf: 'flex-start' },
    textSmall: { fontSize: TYPE.small, fontWeight: '500' },
    textBody: { fontSize: TYPE.body, fontWeight: '500' },
    textStrong: { fontWeight: '600' },
  })
);
