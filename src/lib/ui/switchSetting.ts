import { useSyncExternalStore } from 'react';

import { readSetting, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * A setting that is on or off, kept under [key] and watched, so that what
 * draws by it changes the moment its switch is turned and not the next time
 * a screen happens to read it: on or off as [byDefault] says until it has
 * been turned either way.
 */
export function switchSetting(
  key: string,
  byDefault: boolean
): { useOn: () => boolean; isOn: () => boolean; set: (on: boolean) => void; subscribe: (listener: () => void) => () => void } {
  const on = createStore(byDefault);
  let read = false;
  const current = () => {
    // Read at the first asking, which is the first draw, and not as the file loads.
    if (!read) {
      read = true;
      try {
        const kept = readSetting(key);
        if (kept === 'true' || kept === 'false') on.set(kept === 'true');
      } catch {
        // A database that will not open has bigger news than this. As it would be anyway.
      }
    }
    return on.get();
  };
  return {
    useOn: () => useSyncExternalStore(on.subscribe, current),
    isOn: current,
    subscribe: on.subscribe,
    set: (next: boolean) => {
      read = true;
      on.set(next);
      writeSetting(key, next ? 'true' : 'false');
    },
  };
}
