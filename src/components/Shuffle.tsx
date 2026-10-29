import { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ShuffleIcon } from './Icons';
import { Pressable } from './Pressable';
import { usePressed } from '../lib/theme/index';
import { moodOf, NO_RUN, pressed as pressedAt, type Mood } from '../lib/ui/heart';
import { motionReduced } from '../lib/ui/motion';

/**
 * The player's shuffle button, which deals the queue again at each press.
 *
 * Pressed once, it lights up and turns. Pressed again and again, it counts
 * the presses the way the heart does (`ui/heart.ts`) and turns the more for
 * it; what the rest of the player does about a run — the screen shaking
 * harder and harder, and at the very end the songs thrown all over and put
 * back — is the player's, told by [onDeal] how far into a run each press is.
 */
export function ShuffleButton({
  size,
  on,
  off,
  style,
  hitSlop,
  label,
  onPress,
  onDeal,
}: {
  size: number;
  /** The ink of the button lit up for a moment, and at rest. */
  on: string;
  off: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  label: string;
  onPress: () => void;
  /** Told at each press how far into a run of them it is. */
  onDeal?: (mood: Mood) => void;
}) {
  const ripple = usePressed();
  const run = useRef(NO_RUN);
  const [dealt] = useState(() => new Animated.Value(1));
  const [turns, setTurns] = useState(1);

  const press = () => {
    onPress();
    const next = pressedAt(run.current, Date.now());
    run.current = next;
    const mood = moodOf(next);
    onDeal?.(mood);
    if (motionReduced()) return;
    setTurns(TURNS[mood]);
    dealt.stopAnimation();
    dealt.setValue(0);
    Animated.timing(dealt, {
      toValue: 1,
      duration: 520 + TURNS[mood] * 60,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const light = dealt.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const turn = dealt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 * turns}deg`] });
  const swell = dealt.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1 + 0.12 * (turns + 1), 1] });

  return (
    <Pressable
      android_ripple={ripple}
      style={style}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={press}>
      <Animated.View style={{ transform: [{ rotate: turn }, { scale: swell }] }}>
        <ShuffleIcon size={size} color={off} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: light }]} pointerEvents="none">
          <ShuffleIcon size={size} color={on} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** How many times the button turns at a press, by how far into a run it is. */
const TURNS: Record<Mood, number> = { one: 1, flurry: 2, storm: 3, frenzy: 4, glory: 6 };
