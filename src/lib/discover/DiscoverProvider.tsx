import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useLanguage } from '../i18n/index';
import { usePlayerActions, usePlayerState } from '../player/PlayerProvider';
import { scheduleDiscover } from './background';
import {
  attachPlayer, discoverActions, discoverBackgrounded, discoverEntry, discoverView, entryForTrack, maintainDiscover, playerChanged,
  subscribeDiscover, type DiscoverActions,
} from './engine';
import type { DiscoverEntryView, DiscoverView } from './view';

export type { DiscoverActions } from './engine';
export type {
  DiscoverEntryState, DiscoverEntryView, DiscoverNotice, DiscoverProblem, DiscoverStatus, DiscoverView,
} from './view';

/**
 * Discover as it is to be shown: the songs, the list's own state, the last
 * thing done, and the settings.
 *
 * Drawn again whenever anything in it changes, which is what a header wants
 * and a row does not: a row takes its song from `useDiscoverEntry`, or is
 * handed one of `entries` and remembered by it. A song's view is the same
 * object until something shown of that song changes.
 */
export function useDiscover(): DiscoverView {
  // The words in the view are in the language of the moment, so a change of language is a change of view.
  useLanguage();
  return useSyncExternalStore(subscribeDiscover, discoverView);
}

/** One song of the list, or null once it has left it. Drawn again only when that song changes. */
export function useDiscoverEntry(id: string): DiscoverEntryView | null {
  useLanguage();
  return useSyncExternalStore(subscribeDiscover, () => discoverEntry(id));
}

/**
 * The song of the list that a file in the player is, or null for a file that
 * is not one: for offering keep and exclude on what is playing. Asked with
 * the playing track's id, whatever it is.
 */
export function useDiscoverTrack(trackId: string | null | undefined): DiscoverEntryView | null {
  useLanguage();
  return useSyncExternalStore(subscribeDiscover, () => entryForTrack(trackId));
}

/** What can be done to the list. The same functions always, and usable from anywhere: nothing here needs a component. */
export function useDiscoverActions(): DiscoverActions {
  return discoverActions;
}

/**
 * Joins Discover to the player and to the app coming and going.
 *
 * The engine is not a component and cannot see the player, so what the
 * player is doing is told to it from here, and what it wants of the player
 * is done from here. That is all this holds. There is no timer in it: the
 * engine hears of a download from the queue's own reading, and keeps the one
 * timer it needs for itself.
 */
export function DiscoverProvider({ children }: { children: ReactNode }) {
  const { current, queue, isPlaying } = usePlayerState();
  const { playQueue, addToQueue, removeTrackFromQueue } = usePlayerActions();
  const currentId = current?.id ?? null;

  useEffect(() => {
    playerChanged(currentId, queue.map((track) => track.id), isPlaying);
  }, [currentId, queue, isPlaying]);

  useEffect(() => {
    const detach = attachPlayer({
      play: (tracks) => playQueue(tracks, 0),
      add: addToQueue,
      remove: removeTrackFromQueue,
    });
    // Listened to for as long as the app is up, whether or not a screen is: songs are kept ready behind any of them.
    const unsubscribe = subscribeDiscover(() => {});
    void maintainDiscover();
    void scheduleDiscover().catch(console.warn);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void maintainDiscover();
      else discoverBackgrounded();
    });
    return () => {
      subscription.remove();
      unsubscribe();
      detach();
    };
  }, [playQueue, addToQueue, removeTrackFromQueue]);

  return <>{children}</>;
}
