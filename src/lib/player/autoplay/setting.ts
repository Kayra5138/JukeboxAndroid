import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../../db/index.ts';
import { createStore } from '../../ui/store.ts';
import type { FreshTrouble } from './fresh.ts';
import { modeFrom, type AutoplayMode } from './plan.ts';

/**
 * What plays when the queue runs out: Settings → Player.
 *
 * Held where it can be watched, for the reason the heart's switch is
 * (`ui/heartWanted.ts`): what acts on it is not a screen that comes back into
 * focus and reads its settings again, and is running with no screen at all.
 */
const mode = createStore<AutoplayMode>('off');
let read = false;

export function autoplayMode(): AutoplayMode {
  if (!read) {
    read = true;
    try {
      mode.set(modeFrom(readSetting(SETTINGS.autoplay)));
    } catch {
      // Off.
    }
  }
  return mode.get();
}

export const watchAutoplayMode = mode.subscribe;

export function useAutoplayMode(): AutoplayMode {
  return useSyncExternalStore(mode.subscribe, autoplayMode);
}

export function setAutoplayMode(next: AutoplayMode): void {
  read = true;
  mode.set(next);
  writeSetting(SETTINGS.autoplay, next);
}

/**
 * Why the songs picked last could not be new ones, where they were meant to
 * be: said in one line over them. `waiting` is new songs asked for and not in
 * yet when the queue reached its last song; the rest are `FreshTrouble`'s.
 * Null while there is nothing to say.
 */
export type AutoplayNote = FreshTrouble | 'waiting';

const note = createStore<AutoplayNote | null>(null);

export const setAutoplayNote = note.set;

export function useAutoplayNote(): AutoplayNote | null {
  return useSyncExternalStore(note.subscribe, note.get);
}
