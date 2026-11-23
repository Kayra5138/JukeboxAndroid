import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from './store';

/**
 * Whether the bar to take hold of beside a long list (`FastScroller`) stands
 * there all the while, comes while the list moves and goes after, or is
 * never there: Settings → Look & feel.
 *
 * Always there unless changed: a handle found only by scrolling first was a
 * handle few found at all.
 */
export type ScrollBarMode = 'always' | 'moving' | 'never';

const MODES: readonly ScrollBarMode[] = ['always', 'moving', 'never'];

const mode = createStore<ScrollBarMode>('always');
let read = false;

function current(): ScrollBarMode {
  // Read at the first asking, which is the first list drawn.
  if (!read) {
    read = true;
    try {
      const kept = readSetting(SETTINGS.scrollBar);
      if (kept && (MODES as readonly string[]).includes(kept)) mode.set(kept as ScrollBarMode);
    } catch {
      // A database that will not open has bigger news than this. As it would be anyway.
    }
  }
  return mode.get();
}

export function useScrollBarMode(): ScrollBarMode {
  return useSyncExternalStore(mode.subscribe, current);
}

export function setScrollBarMode(next: ScrollBarMode): void {
  read = true;
  mode.set(next);
  writeSetting(SETTINGS.scrollBar, next);
}
