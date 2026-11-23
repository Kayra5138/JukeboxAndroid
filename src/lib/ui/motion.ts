import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

import { SETTINGS } from '../db/index';
import { createStore } from './store';
import { switchSetting } from './switchSetting';

/*
  Whether the phone itself has been told to remove animations, in its
  accessibility settings.

  Asked once as the app starts and then told of every change, and held here
  so that the question below stays a plain synchronous read: it is asked in
  the middle of drawing and of starting animations, where waiting on a
  promise is not possible. Until the first answer arrives it is taken to be
  no, which is what nearly every phone says.
*/
const systemStill = createStore(false);
void AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => systemStill.set(on))
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => systemStill.set(on));

/** The switch in Settings → Look, held and watched (`switchSetting`). */
const chosen = switchSetting(SETTINGS.reduceMotion, false);

/**
 * Whether the decoration should hold still.
 *
 * Yes when the switch in Settings says so, and yes as well when the phone has
 * been asked to remove animations for everything: somebody who has made that
 * choice for the whole phone should not have to find it again in each app.
 *
 * Held in memory and not read from the database at each asking: it is asked
 * in the middle of drawing, by every cover and every row, and from inside
 * nearly every press and fling.
 */
export function motionReduced(): boolean {
  return systemStill.get() || chosen.isOn();
}

function subscribe(listener: () => void): () => void {
  const fromSystem = systemStill.subscribe(listener);
  const fromSwitch = chosen.subscribe(listener);
  return () => {
    fromSystem();
    fromSwitch();
  };
}

/**
 * The same answer, for what is drawn by it: drawn again the moment either
 * changes, the switch being turned or the phone's own setting, including
 * what stands over every screen and never comes back into focus.
 */
export function useMotionReduced(): boolean {
  return useSyncExternalStore(subscribe, motionReduced);
}

/** The switch itself, for Settings to show and turn; the phone's own setting is not this app's to show. */
export const useStillChosen = (): boolean => chosen.useOn();
export const setStillChosen = (on: boolean): void => chosen.set(on);

/**
 * [animation] of [value] to [to], started; or while the decoration is held
 * still, [value] put there at once, and [done] told so as it would have been.
 * For React Native's own animations, which Reanimated's setting (see the root
 * layout) does not reach: a row going back after a swipe, a fade.
 */
export function unlessStill(
  animation: Animated.CompositeAnimation,
  value: Animated.Value,
  to: number,
  done?: Animated.EndCallback
): void {
  if (motionReduced()) {
    value.stopAnimation();
    value.setValue(to);
    done?.({ finished: true });
    return;
  }
  animation.start(done);
}
