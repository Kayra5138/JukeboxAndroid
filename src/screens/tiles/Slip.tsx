import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { styles } from './styles';

/**
 * The tap that landed on nothing, marked where the finger came down.
 *
 * A ring with a cross through it, under the finger rather than in the middle
 * of the column: how near it was to a key is the whole story of a tap like
 * this, and only the exact place tells it.
 */
export const Slip = memo(function Slip({
  on,
  x,
  y,
  lit,
  size,
}: {
  on: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  lit: SharedValue<number>;
  size: number;
}) {
  const place = useAnimatedStyle(() => ({
    opacity: on.value * lit.value,
    transform: [
      { translateX: x.value - size / 2 },
      { translateY: y.value - size / 2 },
      // Opens a little as it brightens, so it is seen arriving.
      { scale: 0.86 + 0.14 * lit.value },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.slip, { width: size, height: size, borderRadius: size / 2 }, place]}>
      <View style={[styles.slipBar, { width: size * 0.46, transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.slipBar, { width: size * 0.46, transform: [{ rotate: '-45deg' }] }]} />
    </Animated.View>
  );
});
