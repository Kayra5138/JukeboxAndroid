import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * Whether the player has the button that puts the song playing into a list.
 * On unless switched off.
 *
 * Held where it can be watched, for the heart's reason (`heartWanted.ts`):
 * the player is not a screen that comes back into focus and reads its
 * settings again.
 */
const wanted = createStore(true);
let read = false;

function current(): boolean {
  if (!read) {
    read = true;
    try {
      wanted.set(readSetting(SETTINGS.listButton) !== 'false');
    } catch {
      // On.
    }
  }
  return wanted.get();
}

export function useListButtonWanted(): boolean {
  return useSyncExternalStore(wanted.subscribe, current);
}

export function setListButtonWanted(on: boolean): void {
  read = true;
  wanted.set(on);
  writeSetting(SETTINGS.listButton, on ? 'true' : 'false');
}
