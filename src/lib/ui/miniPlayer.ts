import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { choiceSetting } from './choiceSetting';
import { orderSetting } from './order';
import { createStore } from './store';
import { switchSetting } from './switchSetting';

/*
  The bar of what is playing, at the foot of the screens or down their side,
  as Settings → Mini player has it. Every choice starts as the bar was before
  there were any, so that nobody finds it changed by an update.
*/

/** How far into the song it is, if at all: a line along its edge, or the bar filling behind what is on it. */
export const MINI_PROGRESS = ['none', 'line', 'fill'] as const;
export type MiniProgress = (typeof MINI_PROGRESS)[number];
export const miniProgress = choiceSetting<MiniProgress>(SETTINGS.miniProgress, MINI_PROGRESS, 'none');

/** The buttons it can have, in the order they are offered in. */
export const MINI_BUTTONS = ['previous', 'playPause', 'next', 'back', 'forward', 'heart', 'shuffle', 'repeat'] as const;
export type MiniButton = (typeof MINI_BUTTONS)[number];
/** The most it shows at once: past that the name of what is playing has no room left. */
export const MOST_MINI_BUTTONS = 4;
const SHOWN_BY_DEFAULT: readonly MiniButton[] = ['previous', 'playPause', 'next'];

/** The order the buttons stand in, those not shown among them. */
export const miniButtonOrder = orderSetting(SETTINGS.miniButtonOrder, MINI_BUTTONS);

const shownButtons = createStore<ReadonlySet<MiniButton>>(new Set(SHOWN_BY_DEFAULT));
let shownRead = false;
function buttonsShown(): ReadonlySet<MiniButton> {
  if (!shownRead) {
    shownRead = true;
    try {
      const kept = readSetting(SETTINGS.miniButtons);
      if (kept != null) {
        const named = kept.split(',').filter((name): name is MiniButton => (MINI_BUTTONS as readonly string[]).includes(name));
        shownButtons.set(new Set(named.slice(0, MOST_MINI_BUTTONS)));
      }
    } catch {
      // As they come.
    }
  }
  return shownButtons.get();
}

/** Which of the buttons are shown. */
export function useMiniButtonsShown(): ReadonlySet<MiniButton> {
  return useSyncExternalStore(shownButtons.subscribe, buttonsShown);
}

/** [button] shown or not; never more than [MOST_MINI_BUTTONS] at once, the one past them left off. */
export function setMiniButtonShown(button: MiniButton, on: boolean): void {
  const next = new Set(buttonsShown());
  if (on) {
    if (next.size >= MOST_MINI_BUTTONS) return;
    next.add(button);
  } else {
    next.delete(button);
  }
  shownButtons.set(next);
  writeSetting(SETTINGS.miniButtons, MINI_BUTTONS.filter((name) => next.has(name)).join(','));
}

/** The buttons it shows, in their order. */
export function useMiniButtons(): readonly MiniButton[] {
  const order = miniButtonOrder.useOrder();
  const shown = useMiniButtonsShown();
  return order.filter((button) => shown.has(button));
}

/** What the line under the name says. */
export const MINI_LINES = ['artist', 'album', 'both', 'left', 'next'] as const;
export type MiniLine = (typeof MINI_LINES)[number];
export const miniLine = choiceSetting<MiniLine>(SETTINGS.miniLine, MINI_LINES, 'artist');

/** Whether it is pulled sideways for the song before or after. */
export const miniSwipe = switchSetting(SETTINGS.miniSwipe, true);

/** What holding it opens. */
export const MINI_HOLDS = ['none', 'menu', 'queue', 'lyrics'] as const;
export type MiniHold = (typeof MINI_HOLDS)[number];
export const miniHold = choiceSetting<MiniHold>(SETTINGS.miniHold, MINI_HOLDS, 'none');

/** The shape of the cover on it: as it is, round, or a record that turns while it plays. */
export const MINI_COVERS = ['square', 'round', 'record'] as const;
export type MiniCover = (typeof MINI_COVERS)[number];
export const miniCover = choiceSetting<MiniCover>(SETTINGS.miniCover, MINI_COVERS, 'square');

/** Standing clear of the edges with its corners rounded, rather than across the foot from side to side. */
export const miniFloating = switchSetting(SETTINGS.miniFloating, false);

/** Washed with the colour of the cover of what is playing. */
export const miniTint = switchSetting(SETTINGS.miniTint, false);

/** Its buttons on the left and the song on the right, for a left thumb. */
export const miniLeftHanded = switchSetting(SETTINGS.miniLeftHanded, false);

/** How much further from the edges it stands, floating, on each side and below. */
export const FLOATING_MARGIN = 8;
