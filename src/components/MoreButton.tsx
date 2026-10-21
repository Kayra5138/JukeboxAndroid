import { StyleSheet, View } from 'react-native';

import { Pressable } from './Pressable';
import { makeStyles, usePressed } from '../lib/theme/index';
import { useMoreButtonShown } from '../lib/ui/moreButton';

/**
 * The three dots at the end of a row of tracks, which open the same menu a
 * hold does.
 *
 * A hold is the faster way, once somebody knows it is there; the dots are
 * how they find out. Drawn as three round views rather than a character,
 * because "⋮" is a different weight and height in every font a phone may
 * fall back on, and these have to sit in the middle of the row whatever the
 * language.
 *
 * Out of a screen reader's way: the row already offers its menu as one of
 * its own actions, and a second stop on every row saying the same thing
 * would double the length of every list read aloud.
 *
 * Settings → Look can take them away; the row is then as it was before.
 */
export function MoreButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const pressed = usePressed();
  if (!useMoreButtonShown()) return null;
  return (
    <Pressable
      android_ripple={{ ...pressed, borderless: true, radius: 20 }}
      style={styles.hit}
      // A finger's height, in a row that is taller than the dots by far.
      hitSlop={SLOP}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onPress={onPress}>
      <View style={styles.dot} />
      <View style={styles.dot} />
      <View style={styles.dot} />
    </Pressable>
  );
}

const SLOP = { top: 14, bottom: 14, left: 6, right: 10 };

const useStyles = makeStyles((c) => StyleSheet.create({
  hit: { width: 24, height: 32, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.textMuted },
}));
