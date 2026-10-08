import { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio';
import { makeStyles } from '../lib/theme/index';

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
  const styles = useStyles();
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

    Made once, with the travel turned about that holds a panel's writing
    still, and not again each time the row is drawn.
  */
  const { leftLit, rightLit, back } = useMemo(
    () => ({
      leftLit: shift.interpolate({
        inputRange: [0, TRIGGER * 0.75],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
      rightLit: shift.interpolate({
        inputRange: [-TRIGGER * 0.75, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
      back: Animated.multiply(shift, -1),
    }),
    [shift]
  );

  /*
    A panel is not lain under the row and uncovered. It stands off the side it
    comes from and is drawn in by the row's own edge, so it is only ever where
    the row is not; and its writing is moved back by as much, inside it, so
    the words stay where they were and are cut off at the edge as they would
    be were the row over them. It looks exactly like a panel being uncovered.

    What it buys is a row that need not be opaque. One that covered its
    panels had to be painted the colour of the page, and on a page that is
    not one colour that was a flat strip behind every row of the library.
  */
  return (
    <View style={[styles.frame, style]}>
      {left ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.panel,
            styles.panelLeft,
            { backgroundColor: left.colour, opacity: leftLit, transform: [{ translateX: shift }] },
          ]}>
          <Animated.Text
            style={[styles.label, styles.labelLeft, { color: left.tint, transform: [{ translateX: back }] }]}
            numberOfLines={1}>
            {left.label}
          </Animated.Text>
        </Animated.View>
      ) : null}
      {right ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.panel,
            styles.panelRight,
            { backgroundColor: right.colour, opacity: rightLit, transform: [{ translateX: shift }] },
          ]}>
          <Animated.Text
            style={[styles.label, styles.labelRight, { color: right.tint, transform: [{ translateX: back }] }]}
            numberOfLines={1}>
            {right.label}
          </Animated.Text>
        </Animated.View>
      ) : null}
      <Animated.View style={{ transform: [{ translateX: shift }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({
  frame: { overflow: 'hidden' },
  /*
    As wide as the row and wholly off one side of it, cutting its writing to
    its own shape. No padding of its own: the writing is put back by the
    panel's width, and that is counted from inside any padding there is.
  */
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  panelLeft: { left: '-100%', alignItems: 'flex-start' },
  panelRight: { left: '100%', alignItems: 'flex-end' },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2, marginHorizontal: 14 },
  // Over the row's own place again, a whole width from where the panel is.
  labelLeft: { left: '100%' },
  labelRight: { left: '-100%' },
}));
