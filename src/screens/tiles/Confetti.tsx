import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CONFETTI_SEC, confettiFor, scrapAt, type Scrap } from '../../lib/tiles/confetti';
import { CONFETTI_PIECES } from './constants';
import { styles } from './styles';

/**
 * Paper in the air, for a run that reached the end of the record.
 *
 * One clock for all of it. Each scrap works out where it is from that clock and
 * its own handful of numbers, so there is one animation running rather than
 * seventy-two, and it takes itself off the screen when the clock runs out -- a
 * faded scrap is still a view with a style to work out.
 */
const CONFETTI = ['#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#f4f6fb'];

export const Confetti = memo(function Confetti({
  width,
  height,
  colour,
  clock,
  onDone,
}: {
  width: number;
  height: number;
  colour: string;
  /** The burst's own clock, in seconds. Held by the screen, which may have to stop it. */
  clock: SharedValue<number>;
  /** Called once the last scrap has gone, which is when this may be taken down. */
  onDone: () => void;
}) {
  const scraps = useMemo(() => confettiFor(CONFETTI_PIECES, width, height), [height, width]);
  // The record's own colour among them, so the paper belongs to the song.
  const colours = useMemo(() => [...CONFETTI, colour], [colour]);

  useEffect(() => {
    clock.value = 0;
    clock.value = withTiming(
      CONFETTI_SEC,
      { duration: CONFETTI_SEC * 1000, easing: Easing.linear },
      (done) => {
        // Only when it ran its course. Stopped half way, it is the screen
        // that is going, and the screen takes this down with it.
        if (done) runOnJS(onDone)();
      }
    );
    // Once, when the burst begins: `onDone` is a new function on every render
    // of the screen, and starting again each time would never let it land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {scraps.map((scrap, index) => (
        <Paper key={index} scrap={scrap} clock={clock} colour={colours[scrap.colour % colours.length]!} />
      ))}
    </View>
  );
});

const Paper = memo(function Paper({
  scrap,
  clock,
  colour,
}: {
  scrap: Scrap;
  clock: SharedValue<number>;
  colour: string;
}) {
  const flying = useAnimatedStyle(() => {
    const at = scrapAt(scrap, clock.value);
    return {
      opacity: at.opacity,
      transform: [
        { translateX: at.x },
        { translateY: at.y },
        { rotate: `${at.turn}rad` },
        { scaleY: at.flat },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.paper, { width: scrap.wide, height: scrap.tall, backgroundColor: colour }, flying]}
    />
  );
});
