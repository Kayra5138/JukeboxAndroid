import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../../db/index.ts';
import { createStore } from '../../ui/store.ts';
import type { FreshTrouble } from './fresh.ts';
import { DEFAULT_SIZES, modeFrom, sizesFrom, type AutoplayMode, type BatchSizes } from './plan.ts';

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

/** How many songs each top-up adds: Settings → Player, beside the choice above. */
const sizes = createStore<BatchSizes>(DEFAULT_SIZES);
let sizesRead = false;

export function autoplaySizes(): BatchSizes {
  if (!sizesRead) {
    sizesRead = true;
    try {
      sizes.set(sizesFrom(readSetting(SETTINGS.autoplaySizes)));
    } catch {
      // The defaults.
    }
  }
  return sizes.get();
}

export function useAutoplaySizes(): BatchSizes {
  return useSyncExternalStore(sizes.subscribe, autoplaySizes);
}

export function setAutoplaySizes(next: BatchSizes): void {
  sizesRead = true;
  sizes.set(next);
  writeSetting(SETTINGS.autoplaySizes, `${next.library},${next.fresh}`);
}

/**
 * Why the songs picked last are not what was meant: said in one line over
 * them. `waiting` is new songs asked for and not in yet when the queue
 * reached its last song; `random` is a queue begun as similar songs to one
 * too little is known about, filled from the library at random; the rest are
 * `FreshTrouble`'s. Null while there is nothing to say.
 */
export type AutoplayNote = FreshTrouble | 'waiting' | 'random';

const note = createStore<AutoplayNote | null>(null);

export const setAutoplayNote = note.set;

export function useAutoplayNote(): AutoplayNote | null {
  return useSyncExternalStore(note.subscribe, note.get);
}
