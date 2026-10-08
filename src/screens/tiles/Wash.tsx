import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/**
 * The whole board lit for a moment, in one colour.
 *
 * Behind everything and deaf to touch: this is weather, not a control. Kept as
 * its own component so the board itself does not re-render to show it — the
 * tint is a shared value and never crosses to React at all.
 */
export const Wash = memo(function Wash({
  tint,
  colour,
}: {
  tint: SharedValue<number>;
  colour: string;
}) {
  const lit = useAnimatedStyle(() => ({ opacity: tint.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colour }, lit]}
    />
  );
});
