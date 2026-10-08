import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { styles } from './styles';

/**
 * How far through the record the run has got.
 *
 * Driven from the same clock the board is, on the same thread, so it moves
 * with the keys rather than in steps as a poll comes in — and costs no render
 * at all, which a bar redrawn sixty times a second through React would.
 */
export const Progress = memo(function Progress({
  at,
  ofMs,
}: {
  at: SharedValue<number>;
  ofMs: number;
}) {
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: ofMs > 0 ? Math.min(1, Math.max(0, at.value / ofMs)) : 0 }],
  }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
});
