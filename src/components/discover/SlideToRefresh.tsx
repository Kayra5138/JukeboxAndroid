import { useState } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { RefreshIcon } from '../Icons';
import { Pressable } from '../Pressable';
import { useT } from '../../lib/i18n/index';
import { makeStyles, outlinedClip, useColours, usePressed } from '../../lib/theme/index';
import { SPACE, TYPE } from '../../lib/theme/measures';
import { haptic } from '../../lib/ui/haptics';
import { motionReduced, unlessStill } from '../../lib/ui/motion';

const HEIGHT = 28;
/** Room round the knob inside the track. */
const ROOM = 2;
const KNOB = HEIGHT - ROOM * 2;
/** Thin as it is, a finger's height to take hold of. */
const SLOP = { top: 8, bottom: 8 };
/** How much of the way the knob has to go before letting go makes a new list. */
const FAR_ENOUGH = 0.85;

/**
 * A knob slid along a track for a new list, as a phone is slid open: where
 * the button was, while there is a list a touch that was a slip would have
 * lost.
 *
 * Slid sideways, so the list it lies over, which is moved up and down, never
 * has the finger: a finger going up or down from it moves the list, as from
 * anywhere else. The knob follows the finger along, its arrows turning and
 * the track filling behind it, and once it has gone far enough the track
 * says that letting go makes a new list; let go short of that, it goes back.
 * The track touched, the knob starts along it and back, to show which way it
 * goes. A screen reader, which cannot slide, presses it.
 */
export function SlideToRefresh({
  onRefresh,
  disabled = false,
  ready,
  style,
}: {
  onRefresh: () => void;
  /** A list being made: shown, and not to be slid. */
  disabled?: boolean;
  /**
   * Some of a new list ready to be shown: the track is then that, at a touch,
   * with [ready] on it ("Show it now"), in the place of sliding for a new one
   * a second time, and in the same room rather than a button more.
   */
  ready?: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  const c = useColours();
  const styles = useStyles();
  const pressed = usePressed();
  const said = t.discover.panel;
  /** How wide the inside of the track is, and how far the knob goes along it. */
  const [inside, setInside] = useState(0);
  const run = Math.max(1, inside - KNOB - ROOM * 2);
  const [along] = useState(() => new Animated.Value(0));
  const [far, setFar] = useState(false);

  const back = () => {
    unlessStill(Animated.spring(along, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }), along, 0);
  };
  const slide = Gesture.Pan()
    .runOnJS(true)
    .enabled(!disabled)
    .hitSlop(SLOP)
    // Along the track, rightwards; up or down it is the list's.
    .activeOffsetX(6)
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      const at = Math.min(run, Math.max(0, event.translationX));
      along.setValue(at);
      const now = at >= run * FAR_ENOUGH;
      if (now !== far) {
        haptic('choices', 'tick');
        setFar(now);
      }
    })
    .onEnd((event) => {
      if (event.translationX >= run * FAR_ENOUGH) {
        haptic('choices', 'click');
        onRefresh();
      }
    })
    .onFinalize(() => {
      setFar(false);
      back();
    });
  const nudge = Gesture.Tap()
    .runOnJS(true)
    .enabled(!disabled)
    .hitSlop(SLOP)
    .onEnd(() => {
      // Held still, the words on the track say which way it goes.
      if (motionReduced()) return;
      Animated.sequence([
        Animated.timing(along, { toValue: Math.min(run, KNOB), duration: 160, useNativeDriver: true }),
        Animated.spring(along, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }),
      ]).start();
    });

  if (ready) {
    return (
      <Pressable
        android_ripple={pressed}
        accessibilityRole="button"
        style={[styles.track, styles.ready, style]}
        hitSlop={SLOP}
        onPress={() => {
          haptic('choices', 'click');
          onRefresh();
        }}>
        <Text style={styles.readyLabel} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {ready}
        </Text>
      </Pressable>
    );
  }

  return (
    <GestureDetector gesture={Gesture.Exclusive(slide, nudge)}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={said.refresh}
        accessibilityHint={said.slideToRefresh}
        accessibilityActions={[{ name: 'activate' }]}
        accessibilityState={{ disabled, busy: disabled }}
        onAccessibilityAction={() => {
          if (!disabled) onRefresh();
        }}
        style={[styles.track, disabled && styles.off, style]}>
        <View style={StyleSheet.absoluteFill} onLayout={(event) => setInside(event.nativeEvent.layout.width)} />
        {/* The track filled behind the knob: as wide as the track, and slid along with it. */}
        <Animated.View
          style={[
            styles.fill,
            far && styles.fillFar,
            { width: inside, transform: [{ translateX: Animated.add(along, KNOB + ROOM * 2 - inside) }] },
          ]}
        />
        <Animated.Text
          style={[
            styles.label,
            { opacity: along.interpolate({ inputRange: [0, run * 0.6], outputRange: [1, 0.25], extrapolate: 'clamp' }) },
            far && styles.labelFar,
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}>
          {far ? said.releaseToRefresh : said.slideToRefresh}
        </Animated.Text>
        <Animated.View style={[styles.knob, { transform: [{ translateX: along }] }]}>
          <Animated.View
            style={{ transform: [{ rotate: along.interpolate({ inputRange: [0, run], outputRange: ['0deg', '360deg'] }) }] }}>
            <RefreshIcon size={13} color={c.onPrimary} />
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    track: {
      height: HEIGHT,
      borderRadius: HEIGHT / 2,
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: c.surface,
      ...outlinedClip(c),
    },
    fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: HEIGHT / 2, backgroundColor: c.selected },
    fillFar: { backgroundColor: c.accentMuted },
    label: { color: c.textMuted, fontSize: TYPE.hint, textAlign: 'center', paddingLeft: KNOB + ROOM * 2, paddingRight: ROOM * 2 + 6 },
    labelFar: { color: c.text, fontWeight: '600', opacity: 1 },
    off: { opacity: 0.45 },
    // Filled, as the knob is: the thing to press, where before there was a thing to slide.
    ready: { alignItems: 'center', paddingHorizontal: SPACE.m, backgroundColor: c.primary, ...outlinedClip(c, c.primary) },
    readyLabel: { color: c.onPrimary, fontSize: TYPE.hint, fontWeight: '600' },
    knob: {
      position: 'absolute',
      left: ROOM,
      width: KNOB,
      height: KNOB,
      borderRadius: KNOB / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
  })
);
