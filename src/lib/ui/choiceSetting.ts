import { useSyncExternalStore } from 'react';

import { readSetting, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * A setting that is one of [all], kept under [key] and watched, as
 * `switchSetting` is for one that is on or off: [byDefault] until it has
 * been chosen, and again for anything written that is not one of [all].
 */
export function choiceSetting<T extends string>(key: string, all: readonly T[], byDefault: T) {
  const chosen = createStore<T>(byDefault);
  let read = false;
  const current = (): T => {
    // Read at the first asking, which is the first draw, and not as the file loads.
    if (!read) {
      read = true;
      try {
        const kept = readSetting(key);
        if (kept != null && (all as readonly string[]).includes(kept)) chosen.set(kept as T);
      } catch {
        // A database that will not open has bigger news than this. As it would be anyway.
      }
    }
    return chosen.get();
  };
  return {
    current,
    subscribe: chosen.subscribe,
    useChoice: () => useSyncExternalStore(chosen.subscribe, current),
    set: (next: T) => {
      read = true;
      chosen.set(next);
      writeSetting(key, next);
    },
  };
}
