import { useSyncExternalStore } from 'react';

import { createStore } from './store.ts';

/**
 * The pages a name has gone through, one after another, from a list's page:
 * an artist's page, the record its name led to, the artist that record's
 * credit named. Each opened in place of the one before it rather than over
 * it, so that they do not pile up one on another; and each remembered here,
 * so that Back goes through them again in turn, as it would have through a
 * pile, before it leaves the list's pages at all.
 *
 * Only what a page was opened with: its address's words.
 */
export type PageParams = Record<string, string>;

const trail = createStore<readonly PageParams[]>([]);

/** [from] remembered, as the page a name has just left in place of another. */
export function leftFor(from: PageParams): void {
  trail.set([...trail.get(), from]);
}

/** The page to go back to in place of this one, taken off the trail; null where there is none. */
export function backTo(): PageParams | null {
  const all = trail.get();
  const last = all[all.length - 1];
  if (!last) return null;
  trail.set(all.slice(0, -1));
  return last;
}

/** A list's page opened afresh, from anywhere but another: the trail begins again. */
export function startTrail(): void {
  if (trail.get().length > 0) trail.set([]);
}

export function useTrailLength(): number {
  return useSyncExternalStore(trail.subscribe, () => trail.get().length);
}
