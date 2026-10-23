import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { createStore } from '../ui/store.ts';
import { similarSourceFrom, tapModeFrom, type SimilarSource, type TapMode } from './tap.ts';

/**
 * What a tap on a track plays, and where: Settings → Player. Held where it can
 * be watched, as the end of the queue's choice is (`autoplay/setting.ts`), so
 * that a row tapped on any screen goes by what was chosen a moment ago.
 */
type TapChoice = { mode: TapMode; everywhere: boolean; source: SimilarSource };

const choice = createStore<TapChoice>({ mode: 'list', everywhere: false, source: 'library' });
let read = false;

export function tapChoice(): TapChoice {
  if (!read) {
    read = true;
    try {
      choice.set({
        mode: tapModeFrom(readSetting(SETTINGS.onTap)),
        everywhere: readSetting(SETTINGS.onTapEverywhere) === '1',
        source: similarSourceFrom(readSetting(SETTINGS.onTapSimilar)),
      });
    } catch {
      // The list, on Tracks only.
    }
  }
  return choice.get();
}

export const watchTapChoice = choice.subscribe;

export function useTapChoice(): TapChoice {
  return useSyncExternalStore(choice.subscribe, tapChoice);
}

export function setTapMode(mode: TapMode): void {
  choice.set({ ...tapChoice(), mode });
  writeSetting(SETTINGS.onTap, mode);
}

export function setSimilarSource(source: SimilarSource): void {
  choice.set({ ...tapChoice(), source });
  writeSetting(SETTINGS.onTapSimilar, source);
}

export function setTapEverywhere(everywhere: boolean): void {
  choice.set({ ...tapChoice(), everywhere });
  writeSetting(SETTINGS.onTapEverywhere, everywhere ? '1' : '0');
}
