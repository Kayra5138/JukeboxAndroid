import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SPACE, TYPE } from '../lib/theme/measures';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../lib/theme/index';
import { haptic } from '../lib/ui/haptics';

/** How often a drag is allowed to reach the audio framework, in milliseconds. */
const SEND_EVERY_MS = 40;

/**
 * How far the finger may stray, in points, and still have been a tap.
 *
 * A press and a lift are never quite still, and a threshold of nothing would
 * call almost every tap a drag of a pixel or two. Kept well under half the
 * thumb, so a gesture that began on the thumb and was called a tap cannot move
 * the value past the thumb the finger is already covering.
 */
const TAP_SLOP = 6;

const THUMB = 22;

/** What a screen reader may ask of a slider: a step up and a step down. */
const ADJUST = [{ name: 'increment' }, { name: 'decrement' }];
const TRACK = 6;

/**
 * How far, in points, a drag has to carry the value away from a notch it was
 * felt at before that notch can be felt again. A finger resting on a notch
 * is never quite still, and without this a slider between two steps would
 * buzz for as long as it was held there.
 */
const REARM = 8;

/** Room for the arithmetic of a snapped value, which is not always exact. */
const EPSILON = 1e-9;

/** The values a slider is felt to stop at as it is dragged across them. */
type Notches = {
  centre?: number;
  notches?: readonly number[];
  notchEvery?: number;
};

function isNotch(value: number, { centre, notches, notchEvery }: Notches): boolean {
  const near = (notch: number) => Math.abs(value - notch) < EPSILON;
  if (centre !== undefined && near(centre)) return true;
  if (notches?.some(near)) return true;
  return !!notchEvery && near(Math.round(value / notchEvery) * notchEvery);
}

/**
 * The notch a move from one value to another came to, crossed or landed on,
 * or null. Leaving one is not coming to it: the drag that sets off from the
 * resting value has nothing yet to be felt.
 */
function notchReached(from: number, to: number, { centre, notches, notchEvery }: Notches): number | null {
  if (from === to) return null;
  const up = to > from;
  const reached = (notch: number) =>
    up ? from + EPSILON < notch && notch <= to + EPSILON : to - EPSILON <= notch && notch < from - EPSILON;
  let found: number | null = null;
  const consider = (notch: number) => {
    if (reached(notch) && (found === null || Math.abs(notch - to) < Math.abs(found - to))) found = notch;
  };
  if (centre !== undefined) consider(centre);
  notches?.forEach(consider);
  if (notchEvery) {
    const steps = up ? Math.floor(to / notchEvery + EPSILON) : Math.ceil(to / notchEvery - EPSILON);
    consider(steps * notchEvery);
  }
  return found;
}

/**
 * Sliders that follow the finger rather than the render loop.
 *
 * Three things make that so, and all three were learned from the seek bar.
 *
 * The fill and the thumb are driven by one `Animated.Value` on the native
 * driver, so a drag is redrawn by the compositor and never waits on
 * JavaScript. Nothing is a height or a width — those cannot leave the main
 * thread — so both are transforms, with the scaling compensated by a
 * translation to keep the edge that should not move from moving.
 *
 * The value shown is the slider's own. Lifting it into the parent on every
 * frame would re-render the whole screen twenty-five times a second, to say
 * something only this control is displaying.
 *
 * And the audio framework is told on a timer while dragging and once more on
 * release, which is often enough to hear the change as continuous and rare
 * enough that a fast drag across five bands cannot flood the bridge.
 */
type Common = {
  value: number;
  min: number;
  max: number;
  accent: string;
  /** Called while dragging. Should reach the player and nothing else. */
  onDrag: (value: number) => void;
  /** Called once the finger is lifted. This is the one that keeps state. */
  onSettle: (value: number) => void;
  format: (value: number) => string;
  /**
   * The nearest value the finger is allowed to stop on, where a control has
   * such a thing: a duration, at the steps it is kept at. Omitted, the sweep
   * is continuous, which is what a band wants.
   *
   * Applied here rather than left to the caller so that the thumb stops where
   * the value does. A control that snapped only on its way out would show a
   * thumb sitting between two values and a readout insisting it was on one of
   * them, and the finger would have nothing to feel.
   */
  snap?: (value: number) => number;
  /**
   * Values felt as the thumb crosses them, besides the centre, which always
   * is: the zero of a control that rests at its bottom end, say.
   */
  notches?: readonly number[];
  /** Felt at every multiple of this, for a control whose every step matters. */
  notchEvery?: number;
};

/**
 * The value a given fraction of the way along a control, in range and on a
 * step. Shared by the two gestures that can ask for one, so that a tap cannot
 * come to rest anywhere a drag could not.
 */
function valueAt(
  fraction: number,
  { min, span, snap }: { min: number; span: number; snap?: (value: number) => number }
) {
  const clamped = Math.min(1, Math.max(0, fraction));
  const swept = min + clamped * span;
  return snap ? snap(swept) : swept;
}

/**
 * Shared gesture handling.
 *
 * Returns the position the visuals read, `0` at one end and `1` at the other,
 * along with the handlers to spread onto the track.
 */
function useDrag({
  value,
  min,
  max,
  travel,
  invert,
  snap,
  tapPosition,
  centre,
  notches,
  notchEvery,
  onDrag,
  onSettle,
}: Notches & {
  value: number;
  min: number;
  max: number;
  /** Pixels the thumb can cross, which is what a pixel of movement is worth. */
  travel: number;
  /** True where more means up, since screen coordinates grow downwards. */
  invert: boolean;
  snap?: (value: number) => number;
  /**
   * Where along the track a page coordinate falls, `0` at one end and `1` at
   * the other, or null where the control cannot yet say — it has not been
   * measured, or it has no room to move.
   *
   * Given, a gesture that goes nowhere jumps the value to the finger instead
   * of leaving it where it was. Omitted, a control answers only to drags,
   * which is what a fader in a row of faders wants: the finger reaching for
   * one of them arrives over a neighbour often enough.
   */
  tapPosition?: (page: number) => number | null;
  onDrag: (value: number) => void;
  onSettle: (value: number) => void;
}) {
  const span = max - min;
  const at = useCallback(
    (raw: number) => (span === 0 ? 0 : (raw - min) / span),
    [min, span]
  );

  const position = useRef(new Animated.Value(at(value))).current;
  const [shown, setShown] = useState(value);
  const dragging = useRef(false);
  const sentAt = useRef(0);
  /*
    The last value the audio framework was given, so a snapped control can keep
    quiet while the finger crosses the width of one step. Continuous controls
    are unaffected — every frame of those is a different number anyway.
  */
  const sentValue = useRef(value);
  /*
    Where the finger left it. Read on release rather than reaching for `shown`,
    which is a render behind by then — and rather than calling out from inside
    a state updater, which React is allowed to run more than once and which
    would hand the settings a second copy of the same change.
  */
  const latest = useRef(value);
  /*
    The notch last felt, kept until the drag has carried the value far enough
    from it, so that the same notch is not felt over and over under a finger
    that has not really moved.
  */
  const felt = useRef<number | null>(null);

  /*
    Everything the responder reads lives in a ref. It is built once, on the
    first render, and would otherwise be answering with that render's value and
    that render's bounds for the life of the control.
  */
  const live = useRef({
    value,
    min,
    max,
    span,
    travel,
    invert,
    snap,
    tapPosition,
    notched: { centre, notches, notchEvery } as Notches,
    onDrag,
    onSettle,
    at,
  });
  live.current = {
    value,
    min,
    max,
    span,
    travel,
    invert,
    snap,
    tapPosition,
    notched: { centre, notches, notchEvery },
    onDrag,
    onSettle,
    at,
  };

  // Follows the value while nobody is holding it — a preset chosen, a reset,
  // the screen opening — and keeps its hands off while somebody is.
  useEffect(() => {
    if (dragging.current) return;
    position.setValue(at(value));
    setShown(value);
    latest.current = value;
    sentValue.current = value;
  }, [value, at, position]);

  const start = useRef({ page: 0, value: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Once this control has the gesture it keeps it. A scroll view that
        // took it back mid-drag would leave the band wherever the finger
        // happened to be when it did.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          dragging.current = true;
          /*
            Captured once, from the raw page coordinate. Recomputing an origin
            from `locationX`/`locationY` on every move reads it against
            whatever view is under the finger at that moment, which is how the
            seek bar came to jump.
          */
          start.current = {
            page: live.current.invert
              ? event.nativeEvent.pageY
              : event.nativeEvent.pageX,
            value: live.current.value,
          };
          felt.current = isNotch(live.current.value, live.current.notched) ? live.current.value : null;
        },
        onPanResponderMove: (event) => {
          const state = live.current;
          if (state.travel <= 0) return;

          const page = state.invert ? event.nativeEvent.pageY : event.nativeEvent.pageX;
          const moved = (page - start.current.page) / state.travel;
          const fraction = state.at(start.current.value) + (state.invert ? -moved : moved);
          const next = valueAt(fraction, state);

          if (
            felt.current !== null &&
            state.span !== 0 &&
            (Math.abs(next - felt.current) / Math.abs(state.span)) * state.travel > REARM
          ) {
            felt.current = null;
          }
          const notch = notchReached(latest.current, next, state.notched);
          if (notch !== null && notch !== felt.current) {
            felt.current = notch;
            haptic('notches', 'tick');
          }

          // The thumb is placed by the value rather than by the finger, which
          // is what makes a snapped control feel like it has notches in it.
          position.setValue(state.at(next));
          setShown(next);
          latest.current = next;

          const now = Date.now();
          if (next !== sentValue.current && now - sentAt.current >= SEND_EVERY_MS) {
            sentAt.current = now;
            sentValue.current = next;
            state.onDrag(next);
          }
        },
        onPanResponderRelease: (event, gesture) => {
          dragging.current = false;
          const state = live.current;

          /*
            A gesture that went nowhere was somebody pointing at a place on the
            track rather than pushing the thumb along it, and the only sensible
            answer to being pointed at is to go there. A drag stays relative:
            it is the same gesture that has to place a value to the step, and a
            thumb that teleported under the finger the moment it landed would
            take away the one control that makes that possible.
          */
          const tap = state.tapPosition;
          const pointed =
            tap && Math.hypot(gesture.dx, gesture.dy) <= TAP_SLOP
              ? tap(state.invert ? event.nativeEvent.pageY : event.nativeEvent.pageX)
              : null;

          if (pointed !== null) {
            const next = valueAt(pointed, state);
            if (next !== latest.current && isNotch(next, state.notched)) haptic('notches', 'tick');
            position.setValue(state.at(next));
            setShown(next);
            latest.current = next;
            /*
              Told to the player on the way out as well, which the throttle
              would otherwise have skipped entirely — a tap is over long before
              the first send is due, and the audio framework has to hear this
              arrive exactly as it hears a drag arrive.
            */
            if (next !== sentValue.current) state.onDrag(next);
          }

          sentValue.current = latest.current;
          state.onSettle(latest.current);
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          sentValue.current = latest.current;
          live.current.onSettle(latest.current);
        },
      }),
    [position]
  );

  /*
    A step one way or the other, for a screen reader, which has no finger to
    drag with and asks by swiping up or down instead.

    A notched control moves to the next notch rather than by some share of its
    range: a share smaller than the notch would snap straight back to where it
    was, and the swipe would do nothing at all. So it feels its way along in
    small amounts until the value changes, or the end is reached. A smooth
    control has no notches to find and goes a twentieth of the way.
  */
  const nudge = (direction: 1 | -1) => {
    const state = live.current;
    if (state.span === 0) return;
    const from = latest.current;
    let next = from;
    if (state.snap) {
      for (let tried = 1; tried <= 200 && next === from; tried++) {
        const fraction = state.at(from) + (direction * tried) / 200;
        next = valueAt(fraction, state);
        if (fraction <= 0 || fraction >= 1) break;
      }
    } else {
      next = valueAt(state.at(from) + direction / 20, state);
    }
    if (next === from) return;
    position.setValue(state.at(next));
    setShown(next);
    latest.current = next;
    sentValue.current = next;
    state.onDrag(next);
    state.onSettle(next);
  };

  return { position, shown, nudge, handlers: responder.panHandlers };
}

/**
 * One equalizer band: a vertical fader that fills away from the middle.
 *
 * Away from the middle rather than up from the bottom, because the middle is
 * what the band does when it is doing nothing. A bar filling from the floor
 * would say a cut of six decibels and a boost of six looked like different
 * amounts of the same thing.
 */
export function Fader({
  value,
  min,
  max,
  accent,
  label,
  height,
  snap,
  notches,
  notchEvery,
  onDrag,
  onSettle,
  format,
}: Common & { label: string; height: number }) {
  const styles = useStyles();
  const travel = height - THUMB;
  const { position, shown, handlers } = useDrag({
    value,
    min,
    max,
    travel,
    invert: true,
    snap,
    notches,
    notchEvery,
    onDrag,
    onSettle,
  });

  const half = height / 2;
  /*
    Each half of the fill is a rectangle from the centre line to one end,
    scaled about its own middle and slid back by half of whatever the scaling
    took off — which pins the edge that sits on the centre line, so the bar
    grows away from the middle in the direction the value went.
  */
  const grow = (upward: boolean) => ({
    transform: [
      {
        translateY: position.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: upward ? [half / 2, half / 2, 0] : [0, -half / 2, -half / 2],
        }),
      },
      {
        scaleY: position.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: upward ? [0, 0, 1] : [1, 0, 0],
        }),
      },
    ],
  });

  return (
    <View style={styles.band}>
      <Text
        style={[styles.bandValue, format(shown) !== format(0) && { color: accent }]}
        numberOfLines={1}>
        {format(shown)}
      </Text>

      <View style={[styles.faderTrack, { height }]} {...handlers}>
        <View style={[styles.rail, { height }]} />
        <View style={styles.centreLine} />

        <Animated.View
          style={[styles.fill, { height: half, top: 0, backgroundColor: accent }, grow(true)]}
        />
        <Animated.View
          style={[styles.fill, { height: half, bottom: 0, backgroundColor: accent }, grow(false)]}
        />

        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: accent,
              transform: [
                {
                  translateY: position.interpolate({
                    inputRange: [0, 1],
                    outputRange: [travel / 2, -travel / 2],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <Text style={styles.bandLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A horizontal amount, running either from nothing to all of it or away from a
 * value it rests at.
 *
 * `centre` is what decides which, and it is the same argument the band fader
 * makes about its middle. A bar filling from the left says more is more of
 * something; that is true of a bass boost and false of a playback speed, where
 * the resting value sits a third of the way along and a two-thirds-full bar
 * would insist something was switched on when nothing is.
 */
export function Slider({
  value,
  min,
  max,
  accent,
  label,
  centre,
  snap,
  notches,
  notchEvery,
  onDrag,
  onSettle,
  format,
}: Common & { label: string; centre?: number }) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const travel = Math.max(0, width - THUMB);

  /*
    The track's left edge in page coordinates, which the layout event does not
    carry — its `x` is measured against the parent. Taken this way rather than
    from the touch's own `locationX`, which is relative to whichever view the
    finger actually landed on: a tap that caught the thumb would be measured
    from the thumb's own left edge instead, and land a thumb's width out.
  */
  const track = useRef<View>(null);
  const left = useRef(0);

  /*
    Taken again as the finger lands, not only at layout. A sheet that is still
    sliding into place answers a layout-time measurement with where it was
    rather than where it is about to be, and a slider inside one would spend
    its first taps measuring from the wrong edge. Held in a ref so the reading
    is in place by the time the finger lifts, without a render in between.
  */
  const measure = () => {
    track.current?.measureInWindow((x) => {
      left.current = x;
    });
  };

  /*
    Measured along the thumb's travel rather than the width, for the same
    reason the fill is: the thumb starts half of itself in from either end, so
    a fraction taken from the edges would never quite reach the ends of the
    range and would drift by half a thumb in the middle.
  */
  const tapPosition = (page: number) =>
    travel <= 0 ? null : (page - left.current - THUMB / 2) / travel;

  const { position, shown, nudge, handlers } = useDrag({
    value,
    min,
    max,
    travel,
    invert: false,
    snap,
    tapPosition,
    centre,
    notches,
    notchEvery,
    onDrag,
    onSettle,
  });

  const span = max - min;
  /*
    Where the resting value sits along the track, as a fraction. Null at either
    end of the range as well as when there is no such value, since a bar
    growing away from the very edge is the ordinary bar and is already drawn.
  */
  const middle = centre === undefined || span === 0 ? null : (centre - min) / span;
  const rest = middle !== null && middle > 0 && middle < 1 && width > 0 ? middle : null;

  /*
    Measured along the thumb's travel rather than the full width. The two
    differ by half a thumb at each end, which nobody can see where a bar starts
    at the edge — but at the resting point it is the difference between a bar
    that disappears and one that leaves a sliver behind to say nothing is
    happening.
  */
  const away =
    rest === null
      ? null
      : {
          transform: [
            {
              translateX: position.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  THUMB / 2 + (rest * travel) / 2 - width / 2,
                  THUMB / 2 + ((rest + 1) * travel) / 2 - width / 2,
                ],
              }),
            },
            {
              scaleX: position.interpolate({
                inputRange: [0, rest, 1],
                outputRange: [(rest * travel) / width, 0, ((1 - rest) * travel) / width],
              }),
            },
          ],
        };

  // Grey until it is doing something, which for a centred control means until
  // it has left its resting value — not until it has left the bottom of its
  // range, where such a control spends no time at all.
  const idle = format(rest === null || centre === undefined ? min : centre);

  return (
    <View style={styles.slider}>
      {/* Said by the track below, which a screen reader stops on; read here as
          well, the name and the figure would be heard twice over. */}
      <View style={styles.sliderHead} importantForAccessibility="no-hide-descendants">
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={[styles.sliderValue, format(shown) !== idle && { color: accent }]}>
          {format(shown)}
        </Text>
      </View>

      <View
        ref={track}
        style={styles.sliderTrack}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: format(shown) }}
        accessibilityActions={ADJUST}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') nudge(1);
          else if (event.nativeEvent.actionName === 'decrement') nudge(-1);
        }}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          measure();
        }}
        {...handlers}
        onResponderGrant={(event) => {
          measure();
          /*
            What the grant answers is passed on: it is what tells the phone
            to keep a scroller round this from taking the touch. Dropped, a
            drag along the track was given up to the page at the first
            sideways wobble of the finger.
          */
          return handlers.onResponderGrant?.(event);
        }}>
        <View style={styles.railWide} />
        {/* The notch the detent snaps to, so the resting value can be aimed
            for rather than hunted for. */}
        {rest === null ? null : (
          <View style={[styles.restMark, { left: THUMB / 2 + rest * travel - 0.5 }]} />
        )}
        <Animated.View
          style={[
            styles.fillWide,
            { backgroundColor: accent },
            away ?? {
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width / 2, 0],
                  }),
                },
                { scaleX: position },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.thumb,
            styles.thumbWide,
            {
              backgroundColor: accent,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, travel],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  band: { flex: 1, minWidth: 0, alignItems: 'center', gap: SPACE.s },
  bandValue: { color: c.textFaint, fontSize: TYPE.label, fontVariant: ['tabular-nums'] },
  bandLabel: { color: c.textFaint, fontSize: TYPE.label },

  faderTrack: { width: 34, alignItems: 'center', justifyContent: 'center' },
  rail: { position: 'absolute', width: TRACK, borderRadius: TRACK / 2, backgroundColor: c.borderStrong },
  centreLine: { position: 'absolute', width: 16, height: 1, backgroundColor: c.textDisabled },
  fill: { position: 'absolute', width: TRACK, borderRadius: TRACK / 2 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    // Lifted off the rail so the fill running underneath does not read as part
    // of the thumb.
    borderWidth: 3,
    borderColor: c.bg,
  },

  slider: { gap: SPACE.s },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sliderLabel: { color: c.text, fontSize: TYPE.body },
  sliderValue: { color: c.textFaint, fontSize: TYPE.small, fontVariant: ['tabular-nums'] },
  sliderTrack: { height: THUMB + 14, justifyContent: 'center' },
  railWide: { height: TRACK, borderRadius: TRACK / 2, backgroundColor: c.borderStrong },
  // Taller than the rail on purpose: buried inside it, the mark would be lost
  // the moment the thumb rested on top of it.
  restMark: { position: 'absolute', width: 1, height: 14, backgroundColor: c.textDisabled },
  fillWide: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK,
    borderRadius: TRACK / 2,
  },
  // Pinned to the left edge and moved from there, rather than centred: the
  // thumb has to be able to reach both ends of the rail.
  thumbWide: { left: 0 },
}));
