import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { LIBRARY_VIEWS, storedViews, viewsFrom, type LibraryView } from '../media/views.ts';
import { orderSetting } from './order.ts';
import { createStore } from './store.ts';

/**
 * Which ways of looking at the library its switch offers, held where the
 * library, Settings and the setup all watch the same answer: chosen on one,
 * it is on the others at once, with nothing to wait for.
 */
const views = createStore<readonly LibraryView[]>(viewsFrom(null));
let read = false;

/**
 * The order the views stand in along the switch: Settings → Look & feel.
 * Which are on is kept apart from it, as it always was, and the two are put
 * together here, so that everything reading the views has them in order.
 */
export const viewOrder = orderSetting<LibraryView>(SETTINGS.libraryViewOrder, LIBRARY_VIEWS);

/** Those on, in order: made again only when either changes, so that a watcher is handed the same list until then. */
let ordered: { on: readonly LibraryView[]; order: readonly LibraryView[]; views: readonly LibraryView[] } | null = null;

export function libraryViews(): readonly LibraryView[] {
  const on = viewsOn();
  const order = viewOrder.current();
  if (ordered?.on !== on || ordered.order !== order) ordered = { on, order, views: order.filter((view) => on.includes(view)) };
  return ordered.views;
}

const subscribeEither = (listener: () => void) => {
  const off = views.subscribe(listener);
  const offOrder = viewOrder.subscribe(listener);
  return () => {
    off();
    offOrder();
  };
};

function viewsOn(): readonly LibraryView[] {
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
  return useSyncExternalStore(subscribeEither, libraryViews);
}

export function setLibraryViews(next: readonly LibraryView[]): void {
  read = true;
  if (storedViews(next) === storedViews(views.get())) return;
  views.set([...next]);
  writeSetting(SETTINGS.libraryViews, storedViews(next));
}
