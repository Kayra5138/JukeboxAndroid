import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { readSetting, SETTINGS } from '../db/index';

/**
 * Whether the decoration should hold still.
 *
 * Read straight from the database rather than held in a provider. It is a
 * setting, not a state: it changes on one screen, by hand, perhaps twice in the
 * life of an install, and a context around the whole app so that a switch
 * nobody is touching can be observed is more machinery than the question
 * deserves. The read is one indexed row from SQLite on the same thread.
 */
export function motionReduced(): boolean {
  return readSetting(SETTINGS.reduceMotion) === 'true';
}

/**
 * The same answer, for a screen that should notice it changing.
 *
 * Re-read when the screen comes back into focus, which is the only moment it
 * can have changed: getting to the switch means leaving whatever is asking.
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
