import { memo } from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { BODY_BASE, BOX } from './constants';
import { styles } from './styles';

/**
 * The key that was let past, coloured in where it stands.
 *
 * Built exactly the way a key is -- a frame hung above the bottom, a body
 * stretched from its foot -- and placed by the same arithmetic, so it lies on
 * the key it is marking to the pixel however long that key is. Costs nothing
 * during a run: none of what it reads changes until one ends.
 */
export const Lost = memo(function Lost({
  lane,
  atMs,
  holdMs,
  now,
  lit,
  span,
  travel,
  width,
  height,
}: {
  lane: SharedValue<number>;
  atMs: SharedValue<number>;
  holdMs: SharedValue<number>;
  now: SharedValue<number>;
  lit: SharedValue<number>;
  span: SharedValue<number>;
  travel: SharedValue<number>;
  width: number;
  height: number;
}) {
  const frame = useAnimatedStyle(() => {
    if (lane.value < 0 || span.value <= 0) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const foot = ((now.value - (atMs.value - span.value)) / span.value) * travel.value;
    return {
      opacity: lit.value,
      transform: [{ translateX: lane.value * width }, { translateY: foot - BOX }],
    };
  });
  const body = useAnimatedStyle(() => {
    const tail = span.value > 0 ? (holdMs.value / span.value) * travel.value : 0;
    return { transform: [{ scaleY: (tail + height) / BODY_BASE }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.tile, { width, left: 0 }, frame]}>
      <Animated.View style={[styles.lost, body]} />
    </Animated.View>
  );
});
