import { useSyncExternalStore } from 'react';

import { readSetting, writeSetting } from '../db/index.ts';
import { moved, orderFrom } from './orderOf.ts';
import { createStore } from './store.ts';

/**
 * [all] in an order somebody chose, kept under [key] and watched: the tabs
 * along the bar, the library's views along its switch.
 *
 * Written as the names with commas between. Read back, a name that is not
 * one of [all] is passed over and any of [all] it does not name goes at the
 * end, in its own place among those: a tab or a view added in a later
 * version turns up rather than being lost to an order written before it was.
 */
export function orderSetting<T extends string>(key: string, all: readonly T[]) {
  const order = createStore<readonly T[]>([...all]);
  let read = false;
  const current = (): readonly T[] => {
    // Read at the first asking, which is the first draw, and not as the file loads.
    if (!read) {
      read = true;
      try {
        order.set(orderFrom(readSetting(key), all));
      } catch {
        // A database that will not open has bigger news than this. As they come.
      }
    }
    return order.get();
  };
  return {
    current,
    subscribe: order.subscribe,
    useOrder: () => useSyncExternalStore(order.subscribe, current),
    /** [item] a place earlier or later, kept. */
    move: (item: T, by: -1 | 1) => {
      const next = moved(current(), item, by);
      order.set(next);
      writeSetting(key, next.join(','));
    },
  };
}
