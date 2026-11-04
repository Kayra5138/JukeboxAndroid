import { useSyncExternalStore } from 'react';

import type { Track } from '../types.ts';
import { createStore } from '../ui/store.ts';

/*
  What is in the player, outside its state, for a screen too large to be drawn
  again each time that changes. The library is one: it held the player's state
  to have these to hand at a press, and every change of song, and each step of
  one starting, was all of it drawn again as somebody scrolled it. Set by
  `PlayerProvider`.
*/

/** The id of the track in the player, playing or paused; null with none. */
export const currentTrack = createStore<string | null>(null);

/** The same while it plays or is about to; null while it is paused. */
export const playingTrack = createStore<string | null>(null);

/** The queue as it stands, to be read at a press. */
export const queueNow = createStore<readonly Track[]>([]);

/**
 * Whether [trackId] is the track in the player. A row of a long list asks
 * this rather than being told it by the list: told, every row the list holds
 * was drawn again each time the song changed, which is the moment somebody
 * is often scrolling; asked, only the two rows whose answer changed are.
 */
export function useIsCurrent(trackId: string | null | undefined): boolean {
  return useSyncExternalStore(currentTrack.subscribe, () => trackId != null && currentTrack.get() === trackId);
}

/** The id of the track in the player, for what depends on it and draws little. */
export function useCurrentId(): string | null {
  return useSyncExternalStore(currentTrack.subscribe, currentTrack.get);
}

/** Whether there is a track in the player at all, which changes far less often than which one it is. */
export function useHasCurrent(): boolean {
  return useSyncExternalStore(currentTrack.subscribe, () => currentTrack.get() != null);
}

/** The id of the track playing, null while paused. */
export function usePlayingId(): string | null {
  return useSyncExternalStore(playingTrack.subscribe, playingTrack.get);
}
