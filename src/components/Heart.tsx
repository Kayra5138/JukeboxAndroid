import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { HeartIcon } from './Icons';
import { Pressable } from './Pressable';
import { useT } from '../lib/i18n/index';
import { useColours, usePressed } from '../lib/theme/index';
import { flightsOf, MOST_AT_ONCE, NO_RUN, pressed as pressedAt, type Flight } from '../lib/ui/heart';
import { motionReduced } from '../lib/ui/motion';

/**
 * The player's heart.
 *
 * It is not a like. Nothing is counted, sent or kept. A press fills it and
 * the next empties it, and it is empty again for the next song and whenever
 * the player is opened: it remembers nothing at all. It is here to be
 * pressed, and to answer being pressed a great many times in a row with
 * more than it was asked for.
 *
 * The hearts it lets go are drawn beside the button and rise from it. The
 * button is late in the player's page, so what it draws lies over the cover
 * and the controls above it, which is where they go.
 */

export function HeartButton({
  size,
  on,
  off,
  style,
}: {
  size: number;
  /** The ink of a heart that has been pressed, and of one that has not. */
  on: string;
  off: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const c = useColours();
  const ripple = usePressed();
  const { width, height } = useWindowDimensions();
  const [flights, setFlights] = useState<Flight[]>([]);
  // Where the middle of the button is on the screen, for the hearts that are placed by the screen and not by it.
  const [middle, setMiddle] = useState({ x: 0, y: 0 });
  const anchor = useRef<View | null>(null);
  const [full, setFull] = useState(false);
  const run = useRef(NO_RUN);
  const [beat] = useState(() => new Animated.Value(1));

  const press = () => {
    const next = pressedAt(run.current, Date.now());
    run.current = next;
    /*
      Filled by one press and emptied by the next. A press that empties it
      lets nothing go, unless it is one of a run: pressing again and again
      is asking for hearts, whichever way the button happens to be left.
    */
    const filling = !full;
    setFull(filling);
    anchor.current?.measureInWindow((x, y, wide, tall) => {
      const found = { x: x + wide / 2, y: y + tall / 2 };
      setMiddle((had) => (Math.abs(had.x - found.x) < 1 && Math.abs(had.y - found.y) < 1 ? had : found));
    });
    beat.stopAnimation();
    beat.setValue(1);
    Animated.sequence([
      Animated.timing(beat, { toValue: 1.32, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(beat, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
    if (motionReduced() || (!filling && next.count < 2)) return;
    const let_go = flightsOf(next);
    setFlights((flying) => [...flying, ...let_go].slice(-MOST_AT_ONCE));
  };

  const landed = (key: string) => setFlights((flying) => flying.filter((flight) => flight.key !== key));

  return (
    <View ref={anchor} collapsable={false}>
    <Pressable
      android_ripple={ripple}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={t.player.sheet.heart}
      accessibilityState={{ selected: full }}
      onPress={press}>
      <Animated.View style={{ transform: [{ scale: beat }] }}>
        <HeartIcon size={size} color={full ? on : off} full={full} />
      </Animated.View>
    </Pressable>
      {/* Beside the button and not in it: a round button cuts what it holds to its own shape. */}
      <View pointerEvents="none" style={styles.sky}>
        {flights.map((flight) => (
          <Rising
            key={flight.key}
            flight={flight}
            size={size}
            reach={Math.min(340, height * 0.36)}
            // From the middle of the button to where on the screen it was told to be.
            place={flight.at ? { x: flight.at.x * width - middle.x, y: flight.at.y * height - middle.y } : null}
            colour={colourOf(flight, c.accent)}
            onLanded={landed}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * What a heart wears. The theme's accent, until a run of presses has earned
 * something else: then reds and pinks, and at its height every colour there
 * is. These are the only colours in the app that no theme chose, and they
 * are meant to look it.
 */
function colourOf(flight: Flight, accent: string): string {
  const mood = flight.mood;
  // Gold and near white among the colours, which is most of what glitter is.
  if (mood === 'glory') {
    if (flight.spark) return flight.shade % 3 === 0 ? '#ffffff' : `hsl(${40 + (flight.shade % 20)}, 100%, ${76 + (flight.shade % 16)}%)`;
    return flight.shade % 4 === 0 ? `hsl(${42 + (flight.shade % 14)}, 100%, 72%)` : `hsl(${flight.shade % 360}, 96%, 68%)`;
  }
  if (mood === 'frenzy') return `hsl(${flight.shade % 360}, 92%, 64%)`;
  if (mood === 'storm') return `hsl(${325 + (flight.shade % 40)}, 90%, ${58 + (flight.shade % 14)}%)`;
  return accent;
}

function Rising({
  flight,
  size,
  reach,
  place,
  colour,
  onLanded,
}: {
  flight: Flight;
  size: number;
  reach: number;
  place: { x: number; y: number } | null;
  colour: string;
  onLanded: (key: string) => void;
}) {
  const [along] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const going = Animated.timing(along, {
      toValue: 1,
      duration: flight.ms,
      delay: flight.wait,
      easing: flight.swell ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    going.start(({ finished }) => {
      if (finished) onLanded(flight.key);
    });
    return () => going.stop();
    // One flight, begun once: what it was made with does not change under it,
    // and beginning it again whenever the list around it is redrawn would send
    // every heart in the air back to the button.
  }, []);

  const drawn = size * flight.size;

  /*
    One of the shower: where it was put, coming and going in brightness three
    times before it is gone, swelling a little each time and drifting up. A
    heart has a paler, larger one behind it, which is as near to a glow as a
    shape that is a picture can be given.
  */
  if (place) {
    const glitter = {
      opacity: along.interpolate({ inputRange: [0, 0.12, 0.3, 0.48, 0.66, 0.84, 1], outputRange: [0, 1, 0.35, 1, 0.4, 1, 0] }),
      transform: [
        { translateX: place.x },
        { translateY: along.interpolate({ inputRange: [0, 1], outputRange: [place.y, place.y - 46] }) },
        { rotate: along.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${flight.turn}deg`] }) },
        { scale: along.interpolate({ inputRange: [0, 0.12, 0.3, 0.48, 0.66, 0.84, 1], outputRange: [0.2, 1.15, 0.85, 1.2, 0.9, 1.15, 0.6] }) },
      ],
    };
    return (
      <Animated.View style={[styles.flight, { marginLeft: -drawn / 2, marginTop: -drawn / 2 }, glitter]}>
        {flight.spark ? (
          <Text allowFontScaling={false} style={{ color: colour, fontSize: drawn, lineHeight: drawn * 1.15 }}>
            ✦
          </Text>
        ) : (
          <>
            <View style={[styles.glow, { left: -drawn * 0.3, top: -drawn * 0.3 }]}>
              <HeartIcon size={drawn * 1.6} color={colour} full />
            </View>
            <HeartIcon size={drawn} color={colour} full />
          </>
        )}
      </Animated.View>
    );
  }

  const style = flight.swell
    ? {
        opacity: along.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
        transform: [
          { translateY: along.interpolate({ inputRange: [0, 1], outputRange: [0, -reach * flight.rise] }) },
          { scale: along.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.25] }) },
        ],
      }
    : {
        opacity: along.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: along.interpolate({ inputRange: [0, 1], outputRange: [0, -reach * flight.rise] }) },
          // Out to one side and a little way back, the way a thing let go in the air goes.
          {
            translateX: along.interpolate({
              inputRange: [0, 0.35, 0.7, 1],
              outputRange: [0, flight.drift * 54, flight.drift * 34, flight.drift * 70],
            }),
          },
          { rotate: along.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${flight.turn}deg`] }) },
          { scale: along.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.3, 1.1, 0.85] }) },
        ],
      };

  return (
    <Animated.View style={[styles.flight, { marginLeft: -drawn / 2, marginTop: -drawn / 2 }, style]}>
      <HeartIcon size={drawn} color={colour} full />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Nothing of its own size: the hearts are placed from the middle of the button and are not held to it.
  sky: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, overflow: 'visible' },
  flight: { position: 'absolute', left: 0, top: 0 },
  glow: { position: 'absolute', opacity: 0.28 },
});
