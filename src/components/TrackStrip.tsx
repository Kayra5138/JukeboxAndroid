import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import JukeboxAudio from '../../modules/jukebox-audio';
import type { Track } from '../lib/types';

/**
 * How far the finger must travel sideways before this is a swipe at all.
 *
 * Smaller than the one guarding a row in the library, because nothing here is
 * scrolling underneath and the only other gesture this competes with is a tap.
 */
const CLAIM = 14;

/** And how much more sideways than up-and-down it has to be. */
const STRAIGHTNESS = 1.6;

/** How much of a card has to be pulled past for letting go to mean go. */
const COMMIT = 0.28;

/**
 * A flick this quick counts however short it was, in points per millisecond.
 *
 * Without it the only way through is to drag most of a card across, which is
 * a lot of finger for skipping a track; with it, the gesture can be the flick
 * people actually make.
 */
const FLICK = 0.4;

/**
 * How long to wait for the player to reach where the strip already is, in
 * milliseconds, before assuming it never will.
 *
 * Only reached when a skip fails outright. Until then a report of somewhere
 * else is treated as an older one still on its way rather than as a
 * disagreement, which is what lets several swipes be made in a row.
 */
const PATIENCE_MS = 1_500;

/**
 * What is playing, as one of three cards you can pull sideways.
 *
 * The neighbours are really there rather than implied, so dragging uncovers the
 * cover and title of the track it would land on. A swipe that moves nothing
 * until it is over asks to be trusted; this one shows its work, and can be
 * changed your mind about half way through.
 *
 * The strip keeps its own idea of which track it is centred on, rather than
 * reading it off the player, and that is what lets the animation and the audio
 * stop waiting for each other. Letting go moves that idea on immediately: the
 * cards shift one place, the transform is put back by exactly one card in the
 * same breath so nothing appears to have moved, and the spring then carries it
 * home. The player is told at the same moment and is free to take as long as it
 * likes. Another swipe can start before any of that has finished.
 *
 * The cards are keyed by their place in the queue, which is what keeps the
 * covers still. Keyed by position in the strip instead, the middle card would
 * be handed a different track every time one was skipped, and the cover would
 * blink through the old picture on its way to the new one — the swap has to be
 * React moving a card that already exists, not building a fresh one.
 */
export function TrackStrip({
  queue,
  at,
  wraps,
  renderTrack,
  onGo,
  style,
}: {
  queue: Track[];
  /** Where the player says it is, which the strip follows but does not obey. */
  at: number;
  /** Whether the ends of the queue join up, as they do on repeat. */
  wraps: boolean;
  renderTrack: (track: Track) => React.ReactNode;
  onGo: (to: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const [shownAt, setShownAt] = useState(at);
  const shift = useRef(new Animated.Value(0)).current;

  /** Where the strip is, kept here because an animated value cannot be read. */
  const now = useRef(0);
  /** Cards the transform still has to be put back by, set when the cards move. */
  const nudge = useRef(0);
  /** Carried into the spring so a flick keeps its pace instead of restarting. */
  const fling = useRef(0);
  /** The last place the player was asked for, while it is still on its way. */
  const asked = useRef<number | null>(null);
  const patience = useRef<ReturnType<typeof setTimeout> | null>(null);

  const live = useRef({ queue, wraps, width, onGo, at, shownAt });
  live.current = { queue, wraps, width, onGo, at, shownAt };

  /** The queue position one step either side, or -1 where there is nothing. */
  const step = (from: number, delta: number, q: Track[], round: boolean) => {
    const count = q.length;
    if (count === 0 || from < 0) return -1;
    const to = from + delta;
    if (to >= 0 && to < count) return to;
    return round && count > 1 ? (to + count) % count : -1;
  };

  // Only needed while a spring is running, when nobody is setting the value by
  // hand; a gesture that starts mid-flight has to know where to carry on from.
  useEffect(() => {
    const id = shift.addListener(({ value }) => {
      now.current = value;
    });
    return () => shift.removeListener(id);
  }, [shift]);

  const pan = useMemo(() => {
    const place = (value: number) => {
      now.current = value;
      shift.setValue(value);
    };

    /** Sideways travel turned into where the strip actually sits. */
    const follow = (base: number, dx: number) => {
      const { queue: q, wraps: round, width: w, shownAt: centre } = live.current;
      const total = base + dx;
      const nothingThere =
        total > 0 ? step(centre, -1, q, round) < 0 : step(centre, 1, q, round) < 0;
      // Rubber band rather than a dead stop at the ends of the queue: a strip
      // that ignores the finger entirely reads as broken, one that gives a
      // little and pulls back reads as the end of the list.
      if (nothingThere) return total * 0.22;
      return Math.max(-w, Math.min(w, total));
    };

    let base = 0;

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => {
        if (live.current.width <= 0) return false;
        const across = Math.abs(gesture.dx);
        return across >= CLAIM && across >= Math.abs(gesture.dy) * STRAIGHTNESS;
      },
      onPanResponderGrant: () => {
        // Carry on from wherever the spring had got to, rather than snapping
        // back to the middle the instant the finger lands.
        shift.stopAnimation();
        base = now.current;
      },
      /*
        Having claimed it, keep it. The bar is a button as well as a strip, and
        handing the gesture back mid-swipe would leave the cards stranded
        between two tracks.
      */
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_event, gesture) => place(follow(base, gesture.dx)),
      onPanResponderRelease: (_event, gesture) => {
        const { queue: q, wraps: round, width: w, onGo: go, shownAt: centre } = live.current;
        const total = now.current;
        if (total === 0 || w <= 0) return;

        const forward = total < 0;
        const moved = Math.abs(total);
        // A flick counts only when it agrees with the way the strip has been
        // pulled; thrown back the other way it is somebody changing their mind.
        const flicked = Math.abs(gesture.vx) > FLICK && gesture.vx * total > 0;
        const target = step(centre, forward ? 1 : -1, q, round);

        if (target < 0 || !(moved > w * COMMIT || flicked)) {
          fling.current = gesture.vx;
          Animated.spring(shift, {
            toValue: 0,
            velocity: gesture.vx,
            useNativeDriver: true,
            speed: 16,
            bounciness: 4,
          }).start();
          return;
        }

        JukeboxAudio.tick?.();
        fling.current = gesture.vx;
        nudge.current = forward ? 1 : -1;
        asked.current = target;
        setShownAt(target);
        go(target);
      },
      onPanResponderTerminate: () => {
        Animated.spring(shift, {
          toValue: 0,
          useNativeDriver: true,
          speed: 16,
          bounciness: 4,
        }).start();
      },
    });
  }, [shift]);

  /*
    The cards have just moved one place along. Putting the transform back by
    exactly one card leaves the picture untouched, and the spring from there is
    the whole of the animation. Done in a layout effect so it lands in the same
    commit as the cards: a frame with one moved and not the other is a jump.
  */
  useLayoutEffect(() => {
    if (nudge.current !== 0 && width > 0) {
      const put = now.current + nudge.current * width;
      now.current = put;
      shift.setValue(put);
      nudge.current = 0;
    }
    if (now.current === 0) return;

    Animated.spring(shift, {
      toValue: 0,
      velocity: fling.current,
      useNativeDriver: true,
      speed: 16,
      bounciness: 0,
    }).start();
    fling.current = 0;
  }, [shownAt, width, shift]);

  /*
    Following the player without obeying it.

    A report of somewhere the strip has not been asked to be is the player
    moving on its own — a track ending, the next button, the notification — and
    the strip goes there. A report of somewhere older than the last place it was
    asked for is one still on its way, and is ignored, which is what lets swipes
    be made faster than the player can answer them. If the place asked for never
    arrives the ask is given up on and whatever the player says is believed.
  */
  useEffect(() => {
    const clear = () => {
      if (patience.current) clearTimeout(patience.current);
      patience.current = null;
    };

    const adopt = (to: number) => {
      clear();
      asked.current = null;
      nudge.current = 0;
      fling.current = 0;
      shift.stopAnimation();
      now.current = 0;
      shift.setValue(0);
      setShownAt(to);
    };

    if (at >= 0 && !queue[shownAt]) {
      adopt(at);
      return;
    }
    if (at < 0 || at === shownAt) {
      if (at === shownAt) {
        clear();
        asked.current = null;
      }
      return;
    }
    if (asked.current === null) {
      adopt(at);
      return;
    }
    if (patience.current) return;
    patience.current = setTimeout(() => {
      patience.current = null;
      asked.current = null;
      adopt(live.current.at);
    }, PATIENCE_MS);
  }, [at, shownAt, queue, shift]);

  useEffect(
    () => () => {
      if (patience.current) clearTimeout(patience.current);
    },
    []
  );

  const behindAt = step(shownAt, -1, queue, wraps);
  const aheadAt = step(shownAt, 1, queue, wraps);

  const slot = (index: number, spare: string) => (
    <View key={index >= 0 && queue[index] ? `q${index}` : spare} style={{ width }}>
      {index >= 0 && queue[index] ? renderTrack(queue[index]) : null}
    </View>
  );

  return (
    <View
      style={[styles.frame, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          styles.strip,
          // A card either side of the middle one, drawn outside the frame and
          // clipped by it until the finger brings one in. The offset is layout
          // rather than animation so the transform stays a single translation
          // the native driver can run on its own thread.
          { width: width * 3, marginLeft: -width, transform: [{ translateX: shift }] },
        ]}
        {...pan.panHandlers}>
        {slot(behindAt, 'before')}
        {slot(shownAt, 'here')}
        {slot(aheadAt, 'after')}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  strip: { flexDirection: 'row' },
});
