import { useNavigationContainerRef } from 'expo-router';
import { createContext, useEffect, useSyncExternalStore } from 'react';

import { createStore } from '../ui/store';

/**
 * A page the player opens over itself: an artist's or a record's from the
 * names under the title or in the queue, a song's details or its folder
 * from its menu, a tape's marks.
 *
 * The player is a layer over the navigator, so a page pushed while it is up
 * arrives under it. Closed on the way out, it was gone when the page was
 * left, and back landed on the screen under it rather than on the player the
 * page was opened from. So it is hidden instead, and drawn not at all, for as
 * long as anything stands over the page it was opened on (its base), and
 * there again as it was left once back comes down to that page.
 *
 * What stands over the base is told from the navigator's state, so that a
 * name followed to another on the page (which takes the page's place), or a
 * page opened from that one, keeps the player hidden as well. Opening the
 * player from its bar meanwhile shows it there, over whatever is open, and
 * forgets the base.
 *
 * The player goes down as the page comes, as it does when it is put away,
 * and comes up again as the page goes: a picture of it behind the page,
 * taken as it went, was a player that stood still, and the player drawn
 * there itself, out of focus, would be the whole of it drawn and blurred
 * again at every frame.
 */

/**
 * Whatever opens a page from inside the player hands the opening to this
 * instead of doing it: see {@link leaveOverPlayer}.
 */
export const OverPlayer = createContext<((go: () => void) => void) | null>(null);

/** The page the player is over, from the moment it opens one until back comes down to it again. */
const base = createStore<string | null>(null);
/** Whether the player is put away under a page it opened. */
const covered = createStore(false);
/** The page on top, as the navigator last said. */
let top: string | null = null;
/** Whether the page on top has been another than the base since the player opened it. */
let left = false;

/**
 * Opens a page from the player, by [go]: at once, the page below it noted
 * as the one to come back to. The player is put away by the host, which
 * takes it down as the page comes and says so once it is down ({@link putAway}).
 */
export function leaveOverPlayer(go: () => void): void {
  base.set(top);
  left = false;
  go();
}

/** The player down, under the page it opened: not drawn, and back is the page's. */
export function putAway(): void {
  if (base.get() != null) covered.set(true);
}

/** The player opened from its bar, or closed, or back down to its page: nothing stands over it any more. */
export function forgetOverPlayer(): void {
  left = false;
  base.set(null);
  covered.set(false);
}

export function useCoveredPlayer(): boolean {
  return useSyncExternalStore(covered.subscribe, covered.get);
}

/**
 * Told as soon as the player is no longer over a page of its own, put away
 * or on its way down, before anything is drawn for it: for the host to have
 * it rise from where it is.
 */
export function onComingBack(listener: () => void): () => void {
  let was = base.get();
  return base.subscribe(() => {
    const now = base.get();
    if (was != null && now == null) listener();
    was = now;
  });
}

/** The key of the page on top, as the navigator nests its states. */
function topOf(state: unknown): string | null {
  let at = state as { index?: number; routes?: { key: string; state?: unknown }[] } | undefined;
  let key: string | null = null;
  while (at?.routes && at.routes.length > 0) {
    const route = at.routes[at.index ?? at.routes.length - 1]!;
    key = route.key;
    at = route.state as typeof at;
  }
  return key;
}

/** Whether [key] is anywhere in the navigator's state. */
function holds(state: unknown, key: string): boolean {
  const at = state as { routes?: { key: string; state?: unknown }[] } | undefined;
  return at?.routes?.some((route) => route.key === key || holds(route.state, key)) ?? false;
}

/**
 * Watches the navigator for the host, from a part of its own that draws
 * nothing, and told by the navigator as its state changes rather than drawn
 * again for it: the host drawn again at every change of page would draw the
 * player again with it.
 */
export function CoverWatch(): null {
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    const look = () => {
      const state = navigation.isReady() ? navigation.getRootState() : undefined;
      top = topOf(state);
      const under = base.get();
      if (under == null) return;
      // The page come over the base; and back down to the base after it, or the base gone altogether: the player as it was.
      if (top !== under) left = true;
      if ((left && top === under) || !holds(state, under)) forgetOverPlayer();
    };
    look();
    return navigation.addListener('state', look);
  }, [navigation]);
  return null;
}
