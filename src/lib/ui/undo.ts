import { useSyncExternalStore } from 'react';

import { SETTINGS } from '../db/index';
import { actionTime } from './actionTime';
import { haptic } from './haptics';
import { createStore } from './store';
import { switchSetting } from './switchSetting';

/**
 * A song taken out of a list, or let go from the player, offered back for a
 * few seconds (`UndoNotice`), unless that was turned off: Settings → Look &
 * feel. Discover's own turning away offers the same, by its own clock.
 *
 * What is done at once is what is seen to be done: the song gone from the
 * list or the queue. What cannot be taken back -- a file deleted -- waits
 * for the offer to run out ([commit]), and is not done at all if it is taken.
 */
const offering = switchSetting(SETTINGS.undoOffers, true);
export const useUndoOffers = offering.useOn;
export const setUndoOffers = offering.set;

/** How long the offer stands. */
export const UNDO_MS = 6000;

/** What stands at the foot: an offer to take something back, or only word of how something went ([bad] where it failed). */
export type UndoOffer = { id: number; text: string; undo?: () => void; commit?: () => void; bad?: boolean };

const offer = createStore<UndoOffer | null>(null);
let made = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The offer standing: whatever was waiting on it is done now, and nothing is offered. */
function settle(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  const standing = offer.get();
  offer.set(null);
  standing?.commit?.();
}

/**
 * Offers [undo] for a few seconds, said as [text]; [commit] is done when the
 * offer runs out or another takes its place, and at once where offers are
 * turned off.
 */
export function offerUndo(text: string, undo: () => void, commit?: () => void): void {
  settle();
  if (!offering.isOn()) {
    commit?.();
    return;
  }
  made += 1;
  offer.set({ id: made, text, undo, commit });
  // Longer where somebody has asked Android for more time to act on what goes by itself.
  timer = setTimeout(settle, actionTime(UNDO_MS));
}

/**
 * How something done went, said for a few seconds in the same place an offer
 * to undo it would be, and with nothing to press: wherever the page has been
 * scrolled to, it is seen, where a line at the top of the page was not.
 * [bad] where it did not go, said in the colour of a failure and at once to a
 * screen reader. Not turned off with the offers: it is not one.
 */
export function tell(text: string, { bad = false }: { bad?: boolean } = {}): void {
  settle();
  haptic('results', bad ? 'reject' : 'confirm');
  made += 1;
  offer.set({ id: made, text, bad });
  timer = setTimeout(settle, actionTime(UNDO_MS));
}

/** The offer taken: undone, and what was waiting on it never done. */
export function takeUndo(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  const standing = offer.get();
  offer.set(null);
  standing?.undo?.();
}

export function useUndoOffer(): UndoOffer | null {
  return useSyncExternalStore(offer.subscribe, offer.get);
}
