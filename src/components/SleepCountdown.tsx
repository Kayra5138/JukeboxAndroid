import { StyleSheet, Text } from 'react-native';

import { MoonIcon } from './Icons';
import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { describeTimer, formatRemaining, remainingMs } from '../lib/player/sleep';
import { useSleepTimer } from '../lib/player/useSleepTimer';
import { makeStyles, outlinedClip, useColours, usePressed } from '../lib/theme/index';

/**
 * The sleep timer, while one is set, between the player's two times: a moon
 * and the time left, counting down where it can be seen rather than only in
 * the sheet it was set in, or what it waits for — the end of the track or the
 * chapter — where there is no time to count. Read out whole to a screen
 * reader. Pressed, it opens that sheet. Nothing at all with no timer.
 */
export function SleepCountdown({ tape, onPress }: { tape: boolean; onPress: () => void }) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const { timer, now } = useSleepTimer();
  const line = describeTimer(timer, now, t, tape);
  if (!line) return null;
  const left = remainingMs(timer, now);
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityLabel={line}
      accessibilityLiveRegion="polite"
      style={styles.pill}
      onPress={onPress}>
      <MoonIcon size={13} color={c.text} />
      <Text style={styles.label} numberOfLines={1}>{left != null ? formatRemaining(left) : line}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
    ...outlinedClip(c),
  },
  label: { color: c.text, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
}));
