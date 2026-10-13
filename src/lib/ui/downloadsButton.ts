import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * Whether the button that floats over the app while something is being
 * downloaded is wanted.
 *
 * Held where it can be watched, unlike most of what Settings keeps: the
 * button is drawn by the root of the app and not by a screen, so there is no
 * coming back into focus at which it could read the setting again, and a
 * switch that did nothing until the app was next opened would look broken.
 */
const wanted = createStore(false);
let read = false;

function current(): boolean {
  // Read at the first asking, which is the first draw, and not as the file
  // loads: that is before anybody has subscribed, so nobody is told twice.
  if (!read) {
    read = true;
    try {
      wanted.set(readSetting(SETTINGS.downloadsButton) === 'true');
    } catch {
      // A database that will not open has bigger news than this. Off.
    }
  }
  return wanted.get();
}

export function useDownloadsButtonWanted(): boolean {
  return useSyncExternalStore(wanted.subscribe, current);
}

export function setDownloadsButtonWanted(on: boolean): void {
  read = true;
  wanted.set(on);
  writeSetting(SETTINGS.downloadsButton, on ? 'true' : 'false');
}

/**
 * When the downloads were last looked at: the button's bubble opened, or the
 * queue's own screen.
 *
 * The button marks a run in which something failed, and went on marking it
 * for as long as the run was recent, to somebody who had opened it, read
 * which had failed and gone back. Having been looked at is what ends that.
 * Kept only while the app is open: a run is spoken of for a few minutes
 * after it ends and no longer, so there is nothing a later opening of the
 * app could be reminded of.
 */
const looked = createStore(0);

export function useDownloadsLookedAt(): number {
  return useSyncExternalStore(looked.subscribe, looked.get);
}

export function downloadsLookedAt(): void {
  looked.set(Date.now());
}
