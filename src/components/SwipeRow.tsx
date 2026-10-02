import { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio';

/**
 * How far the finger must travel sideways before this is a swipe at all.
 *
 * The number that decides whether the list still scrolls properly. Too small
 * and every slightly crooked flick down the library snags on a row; this is
 * roughly a thumb's width, far enough that nobody reaches it by accident on
 * the way somewhere else.
 */
const CLAIM = 20;

/**
 * And how much more sideways than up-and-down it has to be.
 *
 * Checked as well as the distance, because a long diagonal passes any distance
 * test. Scrolling a list is never this far off vertical.
 */
const STRAIGHTNESS = 1.8;

/**
 * How far the row has to be pulled for letting go to mean yes.
 *
 * Set by the longer of the two labels rather than picked: the panel is there to
 * be read before the gesture counts, and a threshold the writing does not fit
 * inside is a row you commit to on faith. It makes for a deliberate pull, which
 * is the other thing wanted of it.
 */
const TRIGGER = 112;

/** Past the trigger it goes stiff, so the row cannot be dragged off-screen. */
const MAX = TRIGGER + 46;

export type SwipeAction = {
  label: string;
  /** The panel behind the row, and the writing on it. */
  colour: string;
  tint: string;
  onAct: () => void;
};

/**
 * A row you can pull sideways to do one of two things to it.
 *
 * The row moves under the finger and a panel is uncovered behind it, which is
 * how the gesture says what it will do before it has done it — a swipe that
 * only acts on release, with nothing shown on the way, is a gesture you have
 * to already know about.
 *
 * Living inside a scrolling list makes the claim the whole problem. The
 * responder is asked to take over only once the finger has gone {@link CLAIM}
 * sideways and is travelling mostly that way, and having taken over it refuses
 * to give the gesture back, so a list that starts scrolling mid-swipe cannot
 * snatch the row out from under the thumb. A tap is untouched: nothing is
 * claimed on the touch itself, so the row's own press handler still gets it.
 */
export function SwipeRow({
  children,
  left,
  right,
  enabled = true,
  style,
}: {
  children: React.ReactNode;
  /** Uncovered by pulling the row to the right. */
  left?: SwipeAction;
  /** Uncovered by pulling it to the left. */
  right?: SwipeAction;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const shift = useRef(new Animated.Value(0)).current;
  /** Whether the last move was far enough to act, so the click fires once. */
  const armed = useRef(false);

  // Mirrors for the responder, which is built once and would otherwise close
  // over whatever these were on the first render.
  const state = useRef({ left, right, enabled });
  state.current = { left, right, enabled };

  const pan = useMemo(() => {
    /** Sideways travel turned into how far the row actually moves. */
    const follow = (dx: number) => {
      const { left: l, right: r } = state.current;
      // Nothing to uncover that way, so the row does not budge.
      if (dx > 0 && !l) return 0;
      if (dx < 0 && !r) return 0;
      const far = Math.abs(dx);
      const moved = far <= TRIGGER ? far : TRIGGER + (far - TRIGGER) * 0.28;
      return Math.sign(dx) * Math.min(moved, MAX);
    };

    const settle = () => {
      armed.current = false;
      Animated.spring(shift, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 4,
      }).start();
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => {
        const { left: l, right: r, enabled: on } = state.current;
        if (!on) return false;
        const across = Math.abs(gesture.dx);
        if (across < CLAIM || across < Math.abs(gesture.dy) * STRAIGHTNESS) return false;
        return gesture.dx > 0 ? l != null : r != null;
      },
      /*
        Having claimed it, keep it. The list this row sits in will ask for the
        gesture back the moment it thinks it is a scroll, and handing it over
        mid-swipe leaves the row stranded halfway open.
      */
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_event, gesture) => {
        const moved = follow(gesture.dx);
        shift.setValue(moved);
        // The click of the row reaching the point where letting go means yes,
        // felt on the way past rather than read off the screen.
        const now = Math.abs(moved) >= TRIGGER;
        if (now !== armed.current) {
          armed.current = now;
          if (now) JukeboxAudio.tick?.();
        }
      },
      onPanResponderRelease: (_event, gesture) => {
        if (armed.current) {
          const action = gesture.dx > 0 ? state.current.left : state.current.right;
          action?.onAct();
        }
        settle();
      },
      onPanResponderTerminate: settle,
    });
  }, [shift]);

  /*
    Each panel fades in over the first stretch of its own side's travel and is
    fully lit by the time the row is far enough to act, so how bright it is
    says how close the gesture is to counting.
  */
  const leftLit = shift.interpolate({
    inputRange: [0, TRIGGER * 0.75],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rightLit = shift.interpolate({
    inputRange: [-TRIGGER * 0.75, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.frame, style]}>
      {left ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.panel, styles.panelLeft, { backgroundColor: left.colour, opacity: leftLit }]}>
          <Text style={[styles.label, { color: left.tint }]} numberOfLines={1}>
            {left.label}
          </Text>
        </Animated.View>
      ) : null}
      {right ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.panel, styles.panelRight, { backgroundColor: right.colour, opacity: rightLit }]}>
          <Text style={[styles.label, { color: right.tint }]} numberOfLines={1}>
            {right.label}
          </Text>
        </Animated.View>
      ) : null}
      <Animated.View
        style={[styles.moving, { transform: [{ translateX: shift }] }]}
        {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  // Opaque, or the panel it uncovers shows through the row that is meant to be
  // covering it.
  moving: { backgroundColor: '#121212' },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  panelLeft: { alignItems: 'flex-start' },
  panelRight: { alignItems: 'flex-end' },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
});
