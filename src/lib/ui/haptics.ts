import { useSyncExternalStore } from 'react';

import JukeboxAudio from '../../../modules/jukebox-audio';
import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { DEFAULT_HAPTICS, feels, hapticsFrom, type HapticGroup, type HapticSettings } from './hapticsPlan';
import { createStore } from './store';

export type { HapticGroup, HapticMode, HapticSettings } from './hapticsPlan';
export { HAPTIC_GROUPS, HAPTIC_MODES } from './hapticsPlan';

/**
 * The feel of a touch, and the one way every part of the app asks for one.
 *
 *  - `tick`: the lightest; a step, a notch, a column passed;
 *  - `click`: a press that did something;
 *  - `heavy`: one with weight behind it;
 *  - `double`: two quick ones, for something won;
 *  - `confirm`, `reject`: something asked for worked, or did not;
 *  - `toggleOn`, `toggleOff`: a switch, a fill, a mode, either way;
 *  - `hold`: a long press has taken;
 *  - `lift`: a row has come loose to be dragged;
 *  - `step`: a dragged thing has crossed into the next place.
 */
export type Feel =
  | 'tick'
  | 'click'
  | 'heavy'
  | 'double'
  | 'confirm'
  | 'reject'
  | 'toggleOn'
  | 'toggleOff'
  | 'hold'
  | 'lift'
  | 'step';

/*
  Held in memory and read from the table once: a feel is asked for under a
  finger, many times a second while something is dragged, and must cost
  nothing to ask for.
*/
let loaded = false;
const store = createStore<HapticSettings>(DEFAULT_HAPTICS);

const current = (): HapticSettings => {
  if (!loaded) {
    loaded = true;
    try {
      store.set(hapticsFrom(readSetting(SETTINGS.haptics)));
    } catch {
      // As it comes.
    }
  }
  return store.get();
};

export function useHaptics(): HapticSettings {
  return useSyncExternalStore(store.subscribe, current);
}

export function setHaptics(next: HapticSettings): void {
  loaded = true;
  store.set(next);
  writeSetting(SETTINGS.haptics, JSON.stringify(next));
}

/**
 * A [feel] of [group], if that group is felt; at the strength chosen, and
 * not at all where the phone's touch feedback is off. Never throws, never
 * waits: a vibration that came after a round trip would not be felt as the
 * touch it answers.
 */
export function haptic(group: HapticGroup, feel: Feel): void {
  try {
    const settings = current();
    if (!feels(settings, group)) return;
    if (JukeboxAudio.feel) JukeboxAudio.feel(feel, settings.strength);
    else if (feel === 'heavy') JukeboxAudio.thump?.();
    else JukeboxAudio.tick?.();
  } catch {
    // Nothing felt, and nothing else the matter.
  }
}

/** The same, felt whatever the groups say: for trying the strength out on the page that sets it. */
export function hapticSample(feel: Feel, strength: number): void {
  try {
    JukeboxAudio.feel?.(feel, strength);
  } catch {
    // Nothing felt.
  }
}

/** Whether a vibration of [group] would be felt now: for the game, which keeps its own strong knock. */
export function hapticsOn(group: HapticGroup): boolean {
  try {
    return feels(current(), group);
  } catch {
    return true;
  }
}
