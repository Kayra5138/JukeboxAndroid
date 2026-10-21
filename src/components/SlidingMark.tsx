import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motionReduced } from '../lib/ui/motion';

/** Where the mark is to be, in the switch's own coordinates. */
export type MarkPlace = { x: number; y: number; width: number; height: number };

/** How long the mark takes to get from one choice to another. */
const MOVE_MS = 220;

const samePlace = (one: MarkPlace, other: MarkPlace) =>
  one.x === other.x && one.y === other.y && one.width === other.width && one.height === other.height;

/**
 * The mark of the chosen one of a row of choices — the open tab, the library's
 * view — drawn once and moved, rather than drawn under each choice in turn.
 *
 * Moved, so that the eye follows it from where it was to where it went: a
 * mark that vanished under one tab and appeared under the next said which tab
 * was open, but not that anything had changed. On the UI thread, so a tab
 * change that is busy drawing its screen does not make it stutter. Where
 * animation is turned down, on the phone or in the app, it is put straight
 * where it goes.
 *
 * Its first place is drawn as a plain view, in the same frame as the choices
 * it marks, and only a later move goes to the UI thread. Drawn through the
 * animation from the start, a mark on a screen that was sliding in waited for
 * the slide's frames to let it be placed, and the switch stood empty for the
 * best part of a second after the choice under it had let go of its own fill.
 *
 * Laid behind the choices and taking no touches: the choices are what is pressed.
 */
export function SlidingMark({ place, style }: { place: MarkPlace | null; style: StyleProp<ViewStyle> }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  /** Where it was first drawn, as a plain view, while it has not moved from there. */
  const [first, setFirst] = useState<MarkPlace | null>(null);
  /** Whether it has moved since, and is drawn by the animation from then on. */
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!place) return;
    if (!first) {
      // The animation is made to start where the plain view stands, for when it is first wanted.
      x.value = place.x;
      y.value = place.y;
      width.value = place.width;
      height.value = place.height;
      setFirst(place);
      return;
    }
    if (!moving && samePlace(place, first)) return;
    // Read as it is needed rather than through the screen's focus: the tab bar is no screen.
    const still = motionReduced();
    const go = (value: { value: number }, to: number) => {
      value.value = still ? to : withTiming(to, { duration: MOVE_MS, easing: Easing.out(Easing.cubic) });
    };
    go(x, place.x);
    go(y, place.y);
    go(width, place.width);
    go(height, place.height);
    setMoving(true);
  }, [place, first, moving, x, y, width, height]);

  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    width: width.value,
    height: height.value,
  }));

  if (!place) return null;
  if (!moving) {
    // Where it is now, from what it was handed: no frame waits on anything.
    const here = first ?? place;
    const at = samePlace(place, here) ? place : here;
    return (
      <View
        pointerEvents="none"
        style={[styles.mark, style, { transform: [{ translateX: at.x }, { translateY: at.y }], width: at.width, height: at.height }]}
      />
    );
  }
  return <Animated.View pointerEvents="none" style={[styles.mark, style, moved]} />;
}

const styles = StyleSheet.create({
  mark: { position: 'absolute', left: 0, top: 0 },
});
