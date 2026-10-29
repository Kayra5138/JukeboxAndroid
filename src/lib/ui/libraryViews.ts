import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { storedViews, viewsFrom, type LibraryView } from '../media/views.ts';
import { createStore } from './store.ts';

/**
 * Which ways of looking at the library its switch offers, held where the
 * library, Settings and the setup all watch the same answer: chosen on one,
 * it is on the others at once, with nothing to wait for.
 */
const views = createStore<readonly LibraryView[]>(viewsFrom(null));
let read = false;

export function libraryViews(): readonly LibraryView[] {
  if (!read) {
    read = true;
    try {
      views.set(viewsFrom(readSetting(SETTINGS.libraryViews)));
    } catch {
      // The ones on offer before anybody has chosen.
    }
  }
  return views.get();
}

export function useLibraryViews(): readonly LibraryView[] {
  return useSyncExternalStore(views.subscribe, libraryViews);
}

export function setLibraryViews(next: readonly LibraryView[]): void {
  read = true;
  if (storedViews(next) === storedViews(views.get())) return;
  views.set([...next]);
  writeSetting(SETTINGS.libraryViews, storedViews(next));
}
