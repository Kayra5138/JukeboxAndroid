import { ActivityIndicator, View, type ActivityIndicatorProps } from 'react-native';

import { useColours } from '../lib/theme/index';
import { useMotionReduced } from '../lib/ui/motion';

/** Android's own sizes for its spinner, which the still one keeps to. */
const SIZES = { small: 20, large: 36 } as const;

/**
 * Something being done: the phone's spinner, and while the decoration is
 * held still, the same ring standing still, a quarter of it open.
 *
 * Still and not gone, because it says something: that this is not done yet.
 * A spinner turns at every frame for as long as it is up, the window drawn
 * again under it each time; a still one is drawn once. Open at a quarter so
 * that it is not taken for an empty ring (a song waiting its turn in
 * Discover) or a whole one.
 */
export function Busy({ size = 'small', color, style, ...props }: ActivityIndicatorProps) {
  const c = useColours();
  const still = useMotionReduced();
  if (!still) return <ActivityIndicator size={size} color={color} style={style} {...props} />;
  const across = typeof size === 'number' ? size : SIZES[size];
  const ink = typeof color === 'string' ? color : c.textMuted;
  // Inside a box as big as the spinner's, so that nothing round it moves when one stands in for the other.
  return (
    <View
      style={[{ width: across, height: across, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      {...props}>
      <View
        style={{
          width: across * 0.8,
          height: across * 0.8,
          borderRadius: across,
          borderWidth: Math.max(2, across / 10),
          borderColor: ink,
          borderRightColor: 'transparent',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}
