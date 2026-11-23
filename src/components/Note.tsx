import type { ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { makeStyles } from '../lib/theme/index';
import { LEADING, TYPE } from '../lib/theme/measures';

/**
 * A line saying how something went, where it was done: [tone] `good` for
 * what went well, `bad` for what failed, `warn` for what went but not
 * wholly, `muted` for what is only so. A failure is said at once to a
 * screen reader, as it appears; the rest as soon as it is free to.
 *
 * Each page said these its own way: a failure in red here and in orange
 * there, at four sizes, and to a screen reader by five means or none. What
 * is said for a moment and then goes, at the foot of the screen, is
 * `tell` (`ui/undo.ts`); this is what stays beside what it is about.
 */
export function Note({
  tone = 'muted',
  children,
  numberOfLines,
  style,
}: {
  tone?: 'good' | 'bad' | 'warn' | 'muted';
  children: ReactNode;
  numberOfLines?: number;
  /** Where it stands: its room round it, and nothing of how it looks. */
  style?: StyleProp<TextStyle>;
}) {
  const styles = useStyles();
  return (
    <Text
      accessibilityRole={tone === 'bad' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'bad' ? 'assertive' : 'polite'}
      numberOfLines={numberOfLines}
      style={[styles.note, styles[tone], style]}>
      {children}
    </Text>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    note: { fontSize: TYPE.hint, lineHeight: LEADING.hint },
    good: { color: c.success },
    bad: { color: c.danger },
    warn: { color: c.warning },
    muted: { color: c.textMuted },
  })
);
