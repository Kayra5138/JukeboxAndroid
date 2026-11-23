import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { makeStyles } from '../lib/theme/index';
import { LEADING, SPACE, TYPE } from '../lib/theme/measures';

/** How much of what a thing says of itself is shown before it is a press away. */
const ABOUT_LINES = 3;
/** About as many letters as fill those lines on a phone, past which there is more to show. */
const ABOUT_LETTERS = 160;

/**
 * What a thing says of itself: the first lines of it, and the whole a press
 * away. A show's or a book's at the head of its page (`MediaHead`), an
 * episode's in its menu (`MenuHeader`).
 */
export function About({ text }: { text: string }) {
  const t = useT();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const long = text.length >= ABOUT_LETTERS;
  return (
    <Pressable accessibilityRole={long ? 'button' : undefined} disabled={!long} onPress={() => setOpen(!open)}>
      <Text style={styles.about} numberOfLines={open || !long ? undefined : ABOUT_LINES}>
        {text}
      </Text>
      {long ? <Text style={styles.more}>{open ? t.search.tapes.podcasts.less : t.search.tapes.podcasts.more}</Text> : null}
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    about: { color: c.textSecondary, fontSize: TYPE.small, lineHeight: LEADING.small },
    more: { color: c.accent, fontSize: TYPE.hint, fontWeight: '600', marginTop: SPACE.xs },
  })
);
