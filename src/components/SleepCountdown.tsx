import { StyleSheet, Text } from 'react-native';
import { RADIUS, SPACE, TYPE } from '../lib/theme/measures';

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
export function SleepCountdown({ tape, live = true, onPress }: { tape: boolean; live?: boolean; onPress: () => void }) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  // Not counting while the player is covered by a page, as nothing else on it is.
  const { timer, now } = useSleepTimer(live);
  const line = describeTimer(timer, now, t, tape);
  if (!line) return null;
  const left = remainingMs(timer, now);
  /*
    Said in whole minutes, the time left rounded up: the words a reader is
    told of again whenever they change, and said by the second, they were
    read out every second for as long as the timer ran.
  */
  const spoken = left != null ? describeTimer(timer, now - ((60_000 - (left % 60_000)) % 60_000), t, tape) ?? line : line;
  return (
    <Pressable
      android_ripple={pressed}
      accessibilityRole="button"
      accessibilityLabel={spoken}
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
    gap: SPACE.xs,
    flexShrink: 1,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.s,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
    ...outlinedClip(c),
  },
  label: { color: c.text, fontSize: TYPE.hint, fontWeight: '600', fontVariant: ['tabular-nums'], flexShrink: 1 },
}));
