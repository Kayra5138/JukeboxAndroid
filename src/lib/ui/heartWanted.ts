import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * Whether the player has its heart. Off until somebody finds the switch.
 *
 * Held where it can be watched, for the reason the floating downloads
 * button's is: the player is not a screen that comes back into focus and
 * reads its settings again.
 */
const wanted = createStore(false);
let read = false;

function current(): boolean {
  if (!read) {
    read = true;
    try {
      wanted.set(readSetting(SETTINGS.heart) === 'true');
    } catch {
      // Off.
    }
  }
  return wanted.get();
}

export function useHeartWanted(): boolean {
  return useSyncExternalStore(wanted.subscribe, current);
}

export function setHeartWanted(on: boolean): void {
  read = true;
  wanted.set(on);
  writeSetting(SETTINGS.heart, on ? 'true' : 'false');
}
