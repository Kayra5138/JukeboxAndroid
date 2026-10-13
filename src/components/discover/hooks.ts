import { useSyncExternalStore } from 'react';

import { discoverView, subscribeDiscover } from '../../lib/discover/engine';
import type { DiscoverSettings } from '../../lib/discover/policy';
import type { DiscoverNotice, DiscoverPreview, DiscoverStatus } from '../../lib/discover/view';
import { useLanguage } from '../../lib/i18n/index';

/**
 * Discover's view a part at a time.
 *
 * `useDiscover` hands over all of it and draws its caller again whenever any
 * of it changes, and something in it changes each second a song is being
 * fetched. The parts of the screen each want one thing of it — the header the
 * list's state, the list which songs and in what order, the snackbar the
 * notice — and the view keeps each of those the same object for as long as
 * it says the same thing. Read one at a time, a part is drawn again when its
 * own thing changes and not otherwise.
 */

const status = () => discoverView().status;
const notice = () => discoverView().notice;
const settings = () => discoverView().settings;
const preview = () => discoverView().preview;

export function useDiscoverStatus(): DiscoverStatus {
  // The words are in the language of the moment, as in `useDiscover`.
  useLanguage();
  return useSyncExternalStore(subscribeDiscover, status);
}

export function useDiscoverNotice(): DiscoverNotice | null {
  useLanguage();
  return useSyncExternalStore(subscribeDiscover, notice);
}

/** The preview that is being heard, or null. Not in the player, so the player's own bar cannot say it. */
export function useDiscoverPreview(): DiscoverPreview | null {
  return useSyncExternalStore(subscribeDiscover, preview);
}

export function useDiscoverSettings(): DiscoverSettings {
  return useSyncExternalStore(subscribeDiscover, settings);
}

/*
  The ids of the songs on the list, in order: the same array until a song
  comes, goes or moves. The view's own array of songs is a new one whenever
  any song changes at all, and a list handed that would go through every row
  it has each second of a download to find that none of them need drawing.
*/
let idsOf: readonly unknown[] | null = null;
let ids: readonly string[] = [];

function idsNow(): readonly string[] {
  const entries = discoverView().entries;
  if (entries !== idsOf) {
    idsOf = entries;
    const next = entries.map((entry) => entry.id);
    if (next.length !== ids.length || next.some((id, at) => id !== ids[at])) ids = next;
  }
  return ids;
}

export function useDiscoverIds(): readonly string[] {
  return useSyncExternalStore(subscribeDiscover, idsNow);
}
