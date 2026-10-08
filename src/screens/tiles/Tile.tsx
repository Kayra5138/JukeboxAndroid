import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import {
  BODY_BASE,
  F_FILL,
  F_FLASH,
  F_GLOW,
  F_KEPT,
  F_LIT,
  F_ON,
  F_TAIL,
  F_Y,
  FIELDS,
  GAUGE_BASE,
  GAUGE_GAP,
} from './constants';
import { styles } from './styles';

/**
 * One tile out of the pool.
 *
 * Nothing here is laid out per frame: the frame gives it a place to stand and
 * how long its tail is, and both are transforms, so a frame never reaches
 * layout at all.
 */
export const Tile = memo(function Tile({
  slot,
  lane,
  view,
  width,
  height,
  shades,
}: {
  slot: number;
  lane: number;
  view: SharedValue<number[]>;
  width: number;
  height: number;
  shades: readonly [string, string, string];
}) {
  const base = slot * FIELDS;
  /*
    One style for the whole frame, opacity included.

    It was two, and that is why a struck key never dimmed: both of them set
    `opacity` on the same view, so each frame they overwrote one another and
    whichever landed second won. The brightness was being worked out correctly
    the whole time and thrown away. Two animated styles may not name the same
    property, and the fix is to have one that does.

    Lent and unlent are the same multiplication: an unused slot is zeroed, so
    both halves are nought and so is the result.
  */
  /*
    Lent or not, and where. Deliberately *not* how bright.

    The dimming of a struck key used to live here, and that is why its flash
    could not be seen: the light is drawn inside this frame, so a frame at
    the spent brightness of some quarter took the flash down to a quarter with
    it -- the light was being put out by the very thing it was announcing. The
    brightness belongs to the parts that are the key, and the light is not one
    of them.
  */
  const frame = useAnimatedStyle(() => ({
    opacity: view.value[base + F_ON]!,
    transform: [{ translateY: view.value[base + F_Y]! }],
  }));
  /** What the key itself is worth looking at: full while waiting, dim once struck. */
  const ink = useAnimatedStyle(() => ({ opacity: view.value[base + F_LIT]! }));
  /*
    Stretched rather than resized.

    Height is a layout property: setting it sixty times a second on a dozen
    tiles puts layout back in the frame loop, and the board was visibly
    stepping rather than sliding because of it. A bar one point tall scaled
    from its foot costs nothing but a transform.
  */
  /*
    One surface for the whole key, hold and all.

    It used to be two: a tail stacked on top of a key, each with its own
    gradient and a bright edge drawn between them. That edge was the hairline
    of white everybody could see, and the two gradients were why the bottom of
    a held key looked like an ordinary key with something else attached above
    it. One view stretched over both is one piece of material, which is what it
    was always meant to look like.
  */
  const body = useAnimatedStyle(() => ({
    opacity: view.value[base + F_LIT]!,
    transform: [{ scaleY: (view.value[base + F_TAIL]! + height) / BODY_BASE }],
  }));
  /*
    The gauge, as long as the whole key it belongs to.

    From the top of the hold to the bottom of the key, less the same gap at
    each end. Only holds have one -- a tap has no tail, so there is nothing to
    be kept down and nothing to show.
  */
  const gauge = useAnimatedStyle(() => {
    const tall = view.value[base + F_TAIL]! + height - GAUGE_GAP * 2;
    return {
      opacity: view.value[base + F_TAIL]! > 0 ? view.value[base + F_LIT]! : 0,
      transform: [{ scaleY: tall > 0 ? tall / GAUGE_BASE : 0 }],
    };
  });
  /*
    How much of the hold has been kept, growing from the key upwards.

    Upwards from the bottom because that is the end which has already gone past
    the line: below is time served and above is time still to serve. Brighter
    while a finger is actually down, so holding reads as doing something rather
    than as waiting for something.
  */
  const fill = useAnimatedStyle(() => {
    const glow = view.value[base + F_GLOW]!;
    return {
      opacity: glow > 0 ? glow : 0.62,
      transform: [{ scaleY: view.value[base + F_FILL]! }],
    };
  });
  /*
    The light of a struck key, thrown outward and gone.

    Drawn over the key rather than inside it and allowed past the lane's own
    width, which is what makes it read as light coming off the thing rather
    than as the thing changing colour. It starts exactly the size of the key at
    the instant of the strike, so there is no moment where it is visibly a
    separate object; then it opens and fades.
  */
  const spark = useAnimatedStyle(() => {
    const flash = view.value[base + F_FLASH]!;
    return {
      opacity: flash * 0.85,
      transform: [{ scale: 1 + (1 - flash) * 0.3 }],
    };
  });

  /*
    The light of a hold kept to the end.

    The whole length of the key at once, which is what the tap's light could
    not be, opening sideways past the edges of its column as it fades. It grows
    from the same foot the key does and is stretched by the same amount, so at
    the instant it appears it is exactly the key, turned white.

    Squared on the way out, so it lingers bright for a moment and then goes
    quickly -- struck and let ring, rather than faded like a lamp on a dimmer.
  */
  const crown = useAnimatedStyle(() => {
    const kept = view.value[base + F_KEPT]!;
    return {
      opacity: kept * kept * 0.92,
      transform: [
        { scaleY: (view.value[base + F_TAIL]! + height) / BODY_BASE },
        { scaleX: 1 + (1 - kept * kept) * 0.6 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.tile, { width, left: lane * width }, frame]}>
      {/*
        One piece of material from the top of the hold to the foot of the key,
        with one gradient over the whole of it. Nothing is drawn where the two
        used to meet, because there is no longer a join there to draw.
      */}
      <Animated.View style={[styles.body, body]}>
        <LinearGradient
          colors={shades}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />
        {/*
          A band of light across the face. The whole difference between a
          coloured rectangle and something with a surface for light to fall on.
        */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0)']}
          locations={[0.14, 0.33, 0.58]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* A shadow along the foot, so one key sits on the next rather than
            dissolving into it. Inside the body, so it is the only edge there
            is and it stretches with nothing. */}
        <View style={styles.underside} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.spark, { height }, spark]} />
      {/*
        Two layers. What has to be held is the dark one; what has been held is
        the bright one drawn over it from the bottom up. So a hold let go of
        early keeps a dark top for the rest of its fall, and that darkness is
        the whole of how a player sees afterwards that they let go.
      */}
      <Animated.View style={[styles.gauge, gauge]}>
        <Animated.View style={[styles.gaugeFill, fill]} />
      </Animated.View>
      {/* Last, so it is over the gauge as well: the whole key lights, not the
          key with its gauge showing through. */}
      <Animated.View pointerEvents="none" style={[styles.crown, crown]} />
    </Animated.View>
  );
})
