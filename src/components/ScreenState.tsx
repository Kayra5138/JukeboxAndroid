import { StyleSheet, Text, View } from 'react-native';

import { Busy } from './Busy';
import { Button } from './Button';
import { useT } from '../lib/i18n/index';
import { makeStyles, useColours } from '../lib/theme/index';
import { LEADING, SPACE, TYPE } from '../lib/theme/measures';

/**
 * What a page or a list says when it has nothing to show yet, or nothing at
 * all, or could not get it: one thing, where there were a spinner in eleven
 * places, a "Try again" in five, and some ten ways of writing "nothing here".
 *
 * - `loading`: a spinner, and nothing else, so that it says nothing wrong
 *   before there is anything to say.
 * - `empty`: [text], quietly, under [title] where the page has a name for
 *   its emptiness (nothing played yet, no downloads).
 * - `error`: [text] as a failure, and a button to try again where [onRetry]
 *   is given.
 *
 * In the middle of the room it is given: a list's empty slot, or a page.
 */
export function ScreenState({
  kind,
  title,
  text,
  onRetry,
}: {
  kind: 'loading' | 'empty' | 'error';
  title?: string;
  text?: string;
  onRetry?: () => void;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  return (
    <View style={styles.place}>
      {kind === 'loading' ? <Busy color={c.textMuted} accessibilityLabel={text} /> : null}
      {kind !== 'loading' && title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {kind !== 'loading' && text ? (
        <Text
          style={[styles.text, kind === 'error' && styles.bad]}
          accessibilityRole={kind === 'error' ? 'alert' : undefined}>
          {text}
        </Text>
      ) : null}
      {kind === 'error' && onRetry ? <Button label={t.common.tryAgain} kind="secondary" size="small" onPress={onRetry} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    place: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.m, paddingVertical: SPACE.xl },
    title: { color: c.text, fontSize: TYPE.heading, fontWeight: '600', textAlign: 'center' },
    text: { color: c.textMuted, fontSize: TYPE.small, lineHeight: LEADING.small, textAlign: 'center' },
    bad: { color: c.danger },
  })
);
