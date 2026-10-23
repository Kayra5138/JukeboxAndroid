import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { readSetting, SETTINGS } from '../db/index';

/*
  Whether the phone itself has been told to remove animations, in its
  accessibility settings.

  Asked once as the app starts and then told of every change, and held here
  so that the question below stays a plain synchronous read: it is asked in
  the middle of drawing and of starting animations, where waiting on a
  promise is not possible. Until the first answer arrives it is taken to be
  no, which is what nearly every phone says.
*/
let systemStill = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    systemStill = on;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  systemStill = on;
});

/**
 * Whether the decoration should hold still.
 *
 * Yes when the switch in Settings says so, and yes as well when the phone has
 * been asked to remove animations for everything: somebody who has made that
 * choice for the whole phone should not have to find it again in each app.
 *
 * The setting is read straight from the database rather than held in a
 * provider. It changes on one screen, by hand, perhaps twice in the life of
 * an install, and a context around the whole app so that a switch nobody is
 * touching can be observed is more machinery than the question deserves. The
 * read is one indexed row from SQLite on the same thread.
 */
export function motionReduced(): boolean {
  if (systemStill) return true;
  // Asked from inside nearly every press and fling: a database that will not answer is motion as usual, not a closed app.
  try {
    return readSetting(SETTINGS.reduceMotion) === 'true';
  } catch {
    return false;
  }
}

/**
 * The same answer, for a screen that should notice it changing.
 *
 * Re-read when the screen comes back into focus, which is the only moment it
 * can have changed: getting to either switch means leaving whatever is asking.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(motionReduced);
  useFocusEffect(
    useCallback(() => {
      setReduced(motionReduced());
    }, [])
  );
  return reduced;
}
