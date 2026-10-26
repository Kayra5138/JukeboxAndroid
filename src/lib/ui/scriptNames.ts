import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import type { ScriptNames } from '../media/enriched.ts';
import { createStore } from './store.ts';

/**
 * Which writing a song's name is shown in where a lookup found it in two:
 * Settings → Look. Held where it can be watched, and read by the library's
 * merge each time it reads the library (`media/merge.ts`).
 */
const names = createStore<ScriptNames>('latin');
let read = false;

export function scriptNames(): ScriptNames {
  if (!read) {
    read = true;
    try {
      names.set(readSetting(SETTINGS.scriptNames) === 'original' ? 'original' : 'latin');
    } catch {
      // Latin letters.
    }
  }
  return names.get();
}

export const watchScriptNames = names.subscribe;

export function useScriptNames(): ScriptNames {
  return useSyncExternalStore(names.subscribe, scriptNames);
}

export function setScriptNames(next: ScriptNames): void {
  read = true;
  names.set(next);
  writeSetting(SETTINGS.scriptNames, next);
}
