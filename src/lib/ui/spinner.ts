import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Something that turns with momentum: each [kick] adds to how fast it is
 * going, never starts it again, and when the kicks stop it runs down under
 * friction and comes to rest on a whole turn. The value is in turns.
 *
 * Moved a frame at a time from here, since a turn that keeps what it had
 * cannot be handed over as one animation with an end known in advance; the
 * last part, settling onto the whole turn, is handed over as one.
 */
export function useSpinner(onRest?: () => void): {
  value: Animated.Value;
  kick: (turnsPerSecond: number) => void;
  stop: () => void;
} {
  const value = useRef(new Animated.Value(0)).current;
  const state = useRef({ angle: 0, speed: 0, frame: 0, last: 0, settling: false, looping: false });
  const rested = useRef(onRest);
  useEffect(() => {
    rested.current = onRest;
  });

  useEffect(
    () => () => {
      cancelAnimationFrame(state.current.frame);
      value.stopAnimation();
    },
    [value]
  );

  const step = (now: number) => {
    const held = state.current;
    const seconds = Math.min(0.05, (now - held.last) / 1000);
    held.last = now;
    held.angle += held.speed * seconds;
    // Friction: about a third of the speed gone each second, and a little more when slow, so it does come to a stop.
    held.speed = Math.max(0, held.speed * Math.exp(-FRICTION * seconds) - STOPPING * seconds);
    value.setValue(held.angle);
    if (held.speed > SETTLE_BELOW) {
      held.frame = requestAnimationFrame(step);
      return;
    }
    // Slow enough: onto the next whole turn, so that what turns is upright when it stops.
    held.looping = false;
    held.settling = true;
    const whole = Math.ceil(held.angle);
    const left = whole - held.angle;
    Animated.timing(value, {
      toValue: whole,
      duration: Math.max(200, Math.min(1400, (left / Math.max(held.speed, 0.2)) * 2000)),
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      held.settling = false;
      if (!finished) return;
      held.angle = whole;
      held.speed = 0;
      rested.current?.();
    });
  };

  const kick = (turnsPerSecond: number) => {
    const held = state.current;
    if (held.settling) {
      // Caught on its way to rest: carry on from where it has got to.
      value.stopAnimation((at) => {
        held.angle = at;
      });
      held.settling = false;
    }
    held.speed = Math.min(MOST, held.speed + turnsPerSecond);
    if (!held.looping) {
      held.looping = true;
      held.last = performance.now();
      held.frame = requestAnimationFrame(step);
    }
  };

  /**
   * Brought to rest at once, upright, whatever it was doing: for when the
   * running down was lost on the way, as an animation is when what it moves is
   * taken off the screen, and nothing would otherwise ever say it had stopped.
   */
  const stop = () => {
    const held = state.current;
    cancelAnimationFrame(held.frame);
    value.stopAnimation();
    held.looping = false;
    held.settling = false;
    held.speed = 0;
    held.angle = Math.round(held.angle);
    value.setValue(held.angle);
  };

  return { value, kick, stop };
}

const FRICTION = 0.45;
const STOPPING = 0.08;
const SETTLE_BELOW = 0.35;
/** Turns a second, at most: past this a picture is a blur. */
const MOST = 6;
