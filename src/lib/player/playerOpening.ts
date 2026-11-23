import { createStore } from '../ui/store';

/** What the player is to be opened showing, other than what it shows of itself: see `useOpenPlayerWith`. */
export type PlayerOpening = 'queue' | 'lyrics';

/**
 * Watched, because the player can already be open when it is asked: hidden
 * under a page it opened, and brought back by the bar.
 */
const opening = createStore<PlayerOpening | null>(null);

/** Said just before the player is opened. */
export function askPlayerOpening(what: PlayerOpening): void {
  opening.set(what);
}

/** What the player was last asked to open showing, once: asked for by the player as it opens. */
export function takePlayerOpening(): PlayerOpening | null {
  const asked = opening.get();
  opening.set(null);
  return asked;
}

/** Told when the player is asked to show something; for a player already open. */
export const watchPlayerOpening = opening.subscribe;
