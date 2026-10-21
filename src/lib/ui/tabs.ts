import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from './store';
import { hiddenFrom, storedHidden, type OptionalTab } from './tabChoice';

/**
 * Which tabs are left off the bar, held where the bar watches it, and the
 * settings table behind it. What the words mean is in `tabChoice.ts`.
 */
let read = false;
const hidden = createStore<ReadonlySet<OptionalTab>>(new Set());

function current(): ReadonlySet<OptionalTab> {
  if (!read) {
    read = true;
    try {
      hidden.set(hiddenFrom(readSetting(SETTINGS.hiddenTabs)));
    } catch {
      // Every tab, as on a new install.
    }
  }
  return hidden.get();
}

export function useHiddenTabs(): ReadonlySet<OptionalTab> {
  return useSyncExternalStore(hidden.subscribe, current);
}

export function setTabShown(tab: OptionalTab, shown: boolean): void {
  const next = new Set(current());
  if (shown) next.delete(tab);
  else next.add(tab);
  read = true;
  hidden.set(next);
  writeSetting(SETTINGS.hiddenTabs, storedHidden(next));
}
