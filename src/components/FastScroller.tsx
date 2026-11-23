import { useEffect, useMemo, useState } from "react";
import { RADIUS, SPACE, TYPE } from '../lib/theme/measures';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { TrackCover } from "./looks/shared";
import type { EnrichedTrack } from "../lib/media/merge";
import { makeStyles } from "../lib/theme/index";
import { haptic } from "../lib/ui/haptics";
import { unlessStill } from "../lib/ui/motion";
import { useScrollBarMode } from "../lib/ui/scrollBar";

/**
 * A long list's own scroll bar, to be taken hold of: it comes up down the
 * right edge as the list is scrolled and goes again when it stops, and
 * dragged it runs the list from end to end, with the letter, month or count
 * of where it is in a bubble beside the finger, and the cover there.
 *
 * Only on a list several screens long; a short one is quicker scrolled.
 *
 * The list tells it where it is through {@link useFastScroll}: its
 * `onScrollEvent` is the list's `onScroll` (on an `Animated.FlatList`), and
 * its two other handlers the list calls from its own.
 *
 * Where the bar stands is worked out by the phone itself from the list's own
 * scrolling (React Native's `Animated`, driven natively), and goes with the
 * list at every frame. Told it from JavaScript, it came a step or two behind
 * and in jumps whenever that was busy with the rows coming up; read by
 * Reanimated as the list scrolled, every step of a scroll cost a twelfth of a
 * second, and the lists went at a few frames a second.
 */
export type FastScroll = {
  /** Where the list is, for JavaScript to read: told at each step. */
  offset: Held<number>;
  /** Where the list is, for the bar to stand by, natively: see above. */
  scrollY: Animated.Value;
  contentY: Animated.Value;
  viewportY: Animated.Value;
  /** The list's `onScroll`. */
  onScrollEvent: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Something more the list wants told of each step it scrolls, beside the bar: its own handler. */
  also: (listener: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | null) => void;
  content: Held<number>;
  viewport: Held<number>;
  /** Told by the list of each step it scrolls. */
  onScroll: (y: number) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  /** The bar, asking to be woken by each scroll; answers with how to stop. */
  listen: (wake: () => void) => () => void;
  /** The bar, asking to be told when the list or its frame changes size; answers with how to stop. */
  measured: (told: () => void) => () => void;
};

/*
  Who is listening to each list's scrolling, kept apart from React: the bar,
  to come up, and the list's own handler (see `also`). Read from inside the
  scroll event, which is made once as the list is first drawn.
*/
type Listening = {
  wake: (() => void) | null;
  extra: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | null;
  /** Told when the list or its frame changes size: for a bar that stands there whether it moves or not. */
  sized: (() => void) | null;
};
const listeners = new WeakMap<object, Listening>();
function listeningOf(token: object): Listening {
  let held = listeners.get(token);
  if (!held) {
    held = { wake: null, extra: null, sized: null };
    listeners.set(token, held);
  }
  return held;
}

/*
  A value kept on the JavaScript side alone, read and written in the shape a
  shared value is. These were shared values, and nothing on the thread that
  draws ever read them: but one written from here and read back from here is
  asked of that thread, and waited on, every time -- some sixty times a
  second while a list was flung, the moment its rows wanted the thread most.
*/
export type Held<T> = { get: () => T; set: (value: T) => void };

function keptHere<T>(initial: T): Held<T> {
  let value = initial;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}

export function useFastScroll(): FastScroll {
  const [offset] = useState(() => keptHere(0));
  const [content] = useState(() => keptHere(0));
  const [viewport] = useState(() => keptHere(0));
  const [token] = useState(() => ({}));
  const [scrollY] = useState(() => new Animated.Value(0));
  const [contentY] = useState(() => new Animated.Value(0));
  const [viewportY] = useState(() => new Animated.Value(0));
  return useMemo(
    () => ({
      offset,
      scrollY,
      contentY,
      viewportY,
      onScrollEvent: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          offset.set(event.nativeEvent.contentOffset.y);
          const heard = listeningOf(token);
          heard.extra?.(event);
          heard.wake?.();
        },
      }),
      also: (listener: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | null) => {
        listeningOf(token).extra = listener;
      },
      content,
      viewport,
      listen: (next: () => void) => {
        listeningOf(token).wake = next;
        return () => {
          const heard = listeningOf(token);
          if (heard.wake === next) heard.wake = null;
        };
      },
      onScroll: (y: number) => {
        offset.set(y);
        listeningOf(token).wake?.();
      },
      measured: (told: () => void) => {
        listeningOf(token).sized = told;
        return () => {
          const heard = listeningOf(token);
          if (heard.sized === told) heard.sized = null;
        };
      },
      onContentSizeChange: (_width: number, height: number) => {
        content.set(height);
        contentY.setValue(height);
        listeningOf(token).sized?.();
      },
      onLayout: (event: LayoutChangeEvent) => {
        viewport.set(event.nativeEvent.layout.height);
        viewportY.setValue(event.nativeEvent.layout.height);
        listeningOf(token).sized?.();
      },
    }),
    [content, contentY, offset, scrollY, token, viewport, viewportY],
  );
}

const THUMB = 52;
const HIT = 40;
/** How many screens long a list is before the bar is offered. */
const LONG = 4;

export function FastScroller({
  fast,
  count,
  labelAt,
  coverAt,
  scrollTo,
  indexAt,
  top = 0,
  bottom = 0,
}: {
  fast: FastScroll;
  /** How many entries the list has, for the one under the finger to be worked out. */
  count: number;
  labelAt: (index: number) => string;
  coverAt?: (index: number) => EnrichedTrack | null | undefined;
  scrollTo: (offset: number) => void;
  /** The entry at a scroll offset, where the list knows; otherwise worked out from how far down the bar is. */
  indexAt?: (offset: number) => number;
  /** Room at the top and the foot of the list that the bar keeps out of. */
  top?: number;
  bottom?: number;
}) {
  const styles = useStyles();
  // Always there, there while the list moves, or never: Settings → Look & feel (`ui/scrollBar.ts`).
  const mode = useScrollBarMode();
  const [moving, setShown] = useState(false);
  // Long enough to be worth a bar: told as the list and its frame are measured, and as it scrolls.
  const [long, setLong] = useState(false);
  const shown = mode === 'always' ? long : mode === 'moving' && moving;
  const [held, setHeld] = useState<number | null>(null);
  // Held rather than refs, being read and written in the drag's callbacks; never shared values: see `Held`.
  const [hide] = useState(() => keptHere<ReturnType<typeof setTimeout> | null>(null));
  const [dragging] = useState(() => keptHere(false));
  const [from] = useState(() => keptHere(0));
  const [lastLabel] = useState(() => keptHere(""));

  useEffect(() => {
    const later = () => {
      {
        const timer = hide.get();
        if (timer) clearTimeout(timer);
      }
      hide.set(setTimeout(() => setShown(false), 1500));
    };
    const isLong = () => fast.viewport.get() > 0 && fast.content.get() >= fast.viewport.get() * LONG;
    setLong(isLong());
    const unmeasured = fast.measured(() => setLong(isLong()));
    const stop = fast.listen(() => {
      if (!isLong()) return;
      setLong(true);
      setShown(true);
      if (!dragging.get()) later();
    });
    return () => {
      stop();
      unmeasured();
      {
        const timer = hide.get();
        if (timer) clearTimeout(timer);
      }
    };
  }, [fast]);

  // Where it stands: as far down its run as the list is down its length, worked out natively (see `FastScroll`).
  const place = useMemo(() => {
    // How far the list can go, and never less than a point: before the list is measured both are nought, and
    // nought over nought was a warning written down at every start.
    const room = Animated.subtract(fast.contentY, fast.viewportY).interpolate({
      inputRange: [1, 2],
      outputRange: [1, 2],
      extrapolateLeft: "clamp",
      extrapolateRight: "extend",
    });
    const share = Animated.divide(fast.scrollY, room).interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    const run = Animated.subtract(fast.viewportY, top + bottom + THUMB);
    return Animated.add(top, Animated.multiply(share, run));
  }, [bottom, fast, top]);
  /*
    Coming and going by how see-through it is, never by being put up and
    taken down: taken down, it went on fading where it had been while a new
    one came up where the list was by then, two of it, one behind the other.
  */
  const [seen] = useState(() => new Animated.Value(0));
  useEffect(() => {
    unlessStill(Animated.timing(seen, { toValue: shown ? 1 : 0, duration: shown ? 120 : 260, useNativeDriver: true }), seen, shown ? 1 : 0);
  }, [seen, shown]);

  const fractionNow = () => {
    const room = Math.max(1, fast.content.get() - fast.viewport.get());
    return Math.min(1, Math.max(0, fast.offset.get() / room));
  };
  const drag = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin(() => {
      dragging.set(true);
      {
        const timer = hide.get();
        if (timer) clearTimeout(timer);
      }
      from.set(fractionNow());
      haptic("holds", "tick");
    })
    .onUpdate((event) => {
      const run = Math.max(1, fast.viewport.get() - top - bottom - THUMB);
      const room = Math.max(0, fast.content.get() - fast.viewport.get());
      const f = Math.min(1, Math.max(0, from.get() + event.translationY / run));
      fast.offset.set(f * room);
      scrollTo(f * room);
      const index = Math.min(
        count - 1,
        Math.max(0, Math.round(indexAt ? indexAt(f * room) : f * (count - 1))),
      );
      setHeld(index);
      const label = labelAt(index);
      if (label !== lastLabel.get()) {
        lastLabel.set(label);
        haptic("notches", "tick");
      }
    })
    .onFinalize(() => {
      dragging.set(false);
      setHeld(null);
      {
        const timer = hide.get();
        if (timer) clearTimeout(timer);
      }
      hide.set(setTimeout(() => setShown(false), 1500));
    });

  if (count === 0 || mode === 'never') return null;
  const cover = held != null ? coverAt?.(held) : null;
  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <Animated.View
        pointerEvents={shown ? "box-none" : "none"}
        style={[styles.row, { opacity: seen, transform: [{ translateY: place }] }]}
      >
        {held != null ? (
          <View pointerEvents="none" style={styles.bubble}>
            {coverAt ? <TrackCover track={cover ?? null} size={46} /> : null}
            <Text style={styles.label} numberOfLines={1}>
              {labelAt(held)}
            </Text>
          </View>
        ) : null}
        <GestureDetector gesture={drag}>
          <View style={styles.hit} hitSlop={{ left: 8 }}>
            <View style={[styles.thumb, held != null && styles.thumbHeld]} />
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    layer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    row: {
      position: "absolute",
      right: 0,
      top: 0,
      height: THUMB,
      flexDirection: "row",
      alignItems: "center",
    },
    hit: {
      width: HIT,
      height: THUMB,
      alignItems: "flex-end",
      justifyContent: "center",
      paddingRight: SPACE.xxs,
    },
    thumb: {
      width: 7,
      height: THUMB - 10,
      borderRadius: RADIUS.check,
      backgroundColor: c.textMuted,
      opacity: 0.85,
    },
    thumbHeld: { backgroundColor: c.accent, opacity: 1, width: 9 },
    bubble: {
      flexDirection: "row",
      alignItems: "center",
      gap: SPACE.s,
      paddingLeft: SPACE.xs,
      paddingRight: SPACE.l,
      paddingVertical: SPACE.xs,
      marginRight: SPACE.xs,
      borderRadius: RADIUS.card,
      backgroundColor: c.surfaceRaised,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderStrong,
      maxWidth: 220,
    },
    label: { color: c.text, fontSize: TYPE.title, fontWeight: "700" },
  }),
);
