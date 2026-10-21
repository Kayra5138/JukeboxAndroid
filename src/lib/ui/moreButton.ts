import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * Whether rows of tracks end in the three dots that open their menu.
 *
 * Held outside React, like the theme, because every row on every list reads
 * it at once and has to change together when it is switched; read from the
 * settings table the first time anybody asks. On unless switched off: the
 * dots are how a newcomer finds the menu, and somebody who knows the hold
 * can take them away.
 */
let loaded = false;
const shown = createStore(true);

const current = (): boolean => {
  if (!loaded) {
    loaded = true;
    try {
      shown.set(readSetting(SETTINGS.moreButton) !== 'false');
    } catch {
      // Shown, as on a new install.
    }
  }
  return shown.get();
};

export function useMoreButtonShown(): boolean {
  return useSyncExternalStore(shown.subscribe, current);
}

export function setMoreButtonShown(on: boolean): void {
  loaded = true;
  shown.set(on);
  writeSetting(SETTINGS.moreButton, on ? 'true' : 'false');
}
