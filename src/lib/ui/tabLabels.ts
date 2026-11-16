import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * Whether the tabs at the foot of the screen say their names under their
 * icons: Settings → Look. Held where the bar watches it, so that a switch
 * changes the bar at once. Off unless switched on: the five icons say what
 * they are, and the bar is lower without the words; somebody who wants the
 * names under them can have them. Sideways the rail has icons alone whatever
 * this says.
 */
let loaded = false;
const shown = createStore(false);

const current = (): boolean => {
  if (!loaded) {
    loaded = true;
    try {
      shown.set(readSetting(SETTINGS.tabLabels) === 'true');
    } catch {
      // Not shown, as on a new install.
    }
  }
  return shown.get();
};

export function useTabLabelsShown(): boolean {
  return useSyncExternalStore(shown.subscribe, current);
}

export function setTabLabelsShown(on: boolean): void {
  loaded = true;
  shown.set(on);
  writeSetting(SETTINGS.tabLabels, on ? 'true' : 'false');
}
