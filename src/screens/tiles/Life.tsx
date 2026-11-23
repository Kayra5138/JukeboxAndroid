import { memo } from 'react';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { styles } from './styles';

/**
 * One life, lit or spent.
 *
 * Reads the count off the board rather than off the score above, so it goes
 * out at the moment the key is lost rather than at the next time the figures
 * are copied over. A life is the one thing worth being exact about: the
 * difference between two left and one is the difference between carrying on
 * and being careful.
 */
export const Life = memo(function Life({
  slot,
  left,
  still,
}: {
  slot: number;
  left: SharedValue<number>;
  still: SharedValue<number>;
}) {
  /*
    Timed rather than switched, and on the size as well as the brightness.

    A dot that simply dims is a dot that has to be compared with its neighbours
    to be read at all. One that shrinks as it goes out, and swells as it comes
    back, says which way it moved -- and a life coming back is rare enough that
    it should be allowed to look like something.

    The spring on the way back is deliberately only on the way back: a life lost
    should not bounce.
  */
  /*
    Moved when this dot itself goes out or comes back, and not when another
    does: worked out in the style, every dot still lit swelled again each
    time one was lost.
  */
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useAnimatedReaction(
    () => slot < left.value,
    (on, was) => {
      if (was === on) return;
      if (still.value === 1 || was == null) {
        opacity.value = on ? 1 : 0.22;
        scale.value = on || still.value === 1 ? 1 : 0.62;
        return;
      }
      opacity.value = withTiming(on ? 1 : 0.22, { duration: 260 });
      scale.value = on
        ? withSequence(withTiming(1.45, { duration: 140 }), withTiming(1, { duration: 220 }))
        : withTiming(0.62, { duration: 260 });
    }
  );
  const lit = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.life, lit]} />;
});
