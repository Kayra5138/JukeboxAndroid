import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from 'react-native';

import { makeStyles } from '../../lib/theme/index';

/** How often a drag is allowed to reach whoever is listening, in milliseconds. */
const TELL_EVERY_MS = 32;

/** How far the finger may stray, in points, and still have been a tap. As the app's other sliders have it. */
const TAP_SLOP = 6;

const THUMB = 26;
const TRACK = 14;

/** The colours a track runs through, left to right: two at the least, which is what a gradient is. */
export type TrackColours = readonly [string, string, ...string[]];

/**
 * A slider whose track is a picture of what it chooses: the hues in order, a
 * colour from grey to its strongest, a colour from black to white.
 *
 * The app's own `Slider` could not be given one. Its track is a rail with a
 * bar of the accent growing along it, which says "this much of something";
 * here there is no amount, only a place along a strip of colours, and a bar
 * over the strip would cover the very thing being chosen from.
 *
 * In the same manner otherwise, for the reasons `Fader.tsx` gives. The thumb
 * is placed by an `Animated.Value` and not by anything React draws, so it
 * keeps up with the finger whatever else a drag sets going; a drag is
 * relative to where it began, and a touch that goes nowhere is a tap that
 * jumps the thumb to the finger; and whoever is listening is told on a timer
 * while the finger moves and once more as it lifts.
 *
 * The gesture is taken with the view's own responder handlers rather than a
 * `PanResponder`. A responder made once has to read everything through refs,
 * and a component that hands functions reading refs to anything but a view
 * is one the React Compiler leaves alone, redrawn whole on every step of a
 * drag. Handlers given to the view are this render's, and need none.
 */
export function TrackSlider({
  label,
  value,
  min,
  max,
  track,
  thumb,
  written,
  step,
  onChange,
  onSettle,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  track: TrackColours;
  /** The colour the thumb is filled with: what is chosen, where the track is what could be. */
  thumb: string;
  /** The value as it is shown beside the label, and read out. */
  written: (value: number) => string;
  /** How far one step moves it, for somebody working it without dragging. */
  step: number;
  /** Called while dragging. Should be cheap: it is the one called often. */
  onChange: (value: number) => void;
  /** Called once the finger is lifted. This is the one that keeps anything. */
  onSettle: (value: number) => void;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const travel = Math.max(0, width - THUMB);
  const span = max - min;
  const at = (raw: number) => (span === 0 ? 0 : Math.min(1, Math.max(0, (raw - min) / span)));

  const [position] = useState(() => new Animated.Value(at(value)));
  const rail = useRef<View>(null);
  /** The track's left edge on the screen; see `Slider` in `Fader.tsx` for why it is measured and not taken from the touch. */
  const left = useRef(0);
  const dragging = useRef(false);
  const start = useRef({ page: 0, value: 0 });
  /** Where the finger left it, which a throttled `onChange` may not have been told. */
  const latest = useRef(value);
  const toldAt = useRef(0);

  // Follows the value while nobody is holding it — a colour picked from the
  // row above, a code typed in — and keeps its hands off while somebody is.
  useEffect(() => {
    if (dragging.current) return;
    position.setValue(span === 0 ? 0 : Math.min(1, Math.max(0, (value - min) / span)));
    latest.current = value;
  }, [value, min, span, position]);

  const measure = () => {
    rail.current?.measureInWindow((x) => {
      left.current = x;
    });
  };

  const place = (fraction: number): number => {
    const next = min + Math.min(1, Math.max(0, fraction)) * span;
    position.setValue(at(next));
    latest.current = next;
    return next;
  };

  const grant = (event: GestureResponderEvent) => {
    measure();
    dragging.current = true;
    start.current = { page: event.nativeEvent.pageX, value: latest.current };
  };

  const move = (event: GestureResponderEvent) => {
    if (travel <= 0) return;
    const moved = (event.nativeEvent.pageX - start.current.page) / travel;
    const next = place(at(start.current.value) + moved);
    const now = Date.now();
    if (now - toldAt.current >= TELL_EVERY_MS) {
      toldAt.current = now;
      onChange(next);
    }
  };

  const release = (event: GestureResponderEvent) => {
    dragging.current = false;
    // Measured along the thumb's travel, so that the ends of the range are the ends of the track.
    if (travel > 0 && Math.abs(event.nativeEvent.pageX - start.current.page) <= TAP_SLOP) {
      place((event.nativeEvent.pageX - left.current - THUMB / 2) / travel);
    }
    onSettle(latest.current);
  };

  const terminate = () => {
    dragging.current = false;
    onSettle(latest.current);
  };

  /** For a screen reader, which has no finger to drag with: a step up or a step down. */
  const stepped = (event: AccessibilityActionEvent) => {
    const direction =
      event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
    if (direction === 0 || span === 0) return;
    onSettle(place(at(latest.current) + (direction * step) / span));
  };

  return (
    <View style={styles.slider}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{written(value)}</Text>
      </View>

      <View
        ref={rail}
        style={styles.track}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: written(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={stepped}
        onLayout={(event) => {
          setWidth(event.nativeEvent.layout.width);
          measure();
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Once this has the gesture it keeps it: a scroll view that took it
        // back mid-drag would leave the colour wherever the finger was.
        onResponderTerminationRequest={() => false}
        onResponderGrant={grant}
        onResponderMove={move}
        onResponderRelease={release}
        onResponderTerminate={terminate}>
        <View style={styles.strip} pointerEvents="none">
          <LinearGradient
            colors={track}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradient}
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              backgroundColor: thumb,
              transform: [
                { translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  slider: { gap: 4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: c.textSecondary, fontSize: 13.5 },
  value: { color: c.textFaint, fontSize: 13, fontVariant: ['tabular-nums'] },
  // Taller than what is drawn in it: the strip is thin and a fingertip is not.
  track: { height: THUMB + 14, justifyContent: 'center' },
  /*
    Inset by half a thumb at each end, so that the thumb's middle — which is
    where it points — runs from the strip's first colour to its last.
  */
  strip: {
    marginHorizontal: THUMB / 2 - TRACK / 2,
    height: TRACK,
    borderRadius: TRACK / 2,
    overflow: 'hidden',
    // An edge in this theme's colours: a strip that passes through the card's own colour would have a hole in it.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  gradient: { flex: 1 },
  /*
    Ringed in the colour of the words, which is the furthest thing in the
    theme from the card the strip lies on, so that the thumb shows whatever
    colour it is filled with and whatever colour is under it.
  */
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    borderColor: c.text,
    elevation: 2,
  },
}));
