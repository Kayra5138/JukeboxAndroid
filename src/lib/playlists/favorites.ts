import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { addToPlaylist, ensureFavorites, favoritesId, inPlaylist, removeFromPlaylist } from '../db/playlists';
import { strings } from '../i18n/index';
import { keptAs } from '../listen/kept';
import { createStore } from '../ui/store';
import { subscribeLists } from './listEvents';

/**
 * Favorites: the list the player's heart fills, and the menu's entry for it.
 *
 * A list like any other, in the database and in a backup, marked as the one
 * there always is (`kind = 'favorites'`): made on the first start that needs
 * it, in the language the app speaks then, and renamed as anybody likes
 * after that. It cannot be deleted. One switch in Settings takes it out of
 * the lists and the heart off the player and the entry out of the menu,
 * and puts them all back; what is in it waits.
 */

/** Favorites' id, made where there is none yet. Null only where the database will not have it. */
export function favorites(): number | null {
  try {
    return favoritesId() ?? ensureFavorites(strings().lists.favorites.name, Date.now());
  } catch {
    return null;
  }
}

/** Whether [trackId] is one of the favorites. */
export function isFavorite(trackId: string | null | undefined): boolean {
  if (!trackId) return false;
  try {
    const id = favoritesId();
    // A song listened to and kept is asked after as the song it became: see `listen/kept.ts`.
    return id != null && inPlaylist(id, keptAs(trackId));
  } catch {
    return false;
  }
}

/** The same, kept up to date as Favorites changes, from here or anywhere else. */
export function useIsFavorite(trackId: string | null | undefined): boolean {
  // A yes or a no, which is the same snapshot every time it is the same answer: one indexed look, asked as it is drawn.
  return useSyncExternalStore(subscribeLists, () => isFavorite(trackId));
}

/** Puts [trackId] in Favorites or takes it out, as [on] says; answers whether it is in now. */
export function setFavorite(trackId: string, on: boolean): boolean {
  const id = favorites();
  if (id == null) return false;
  try {
    const song = keptAs(trackId);
    if (on) addToPlaylist(id, [song], Date.now());
    else removeFromPlaylist(id, song, Date.now());
    return on;
  } catch {
    return !on;
  }
}

/*
  Whether Favorites is on: among the lists, as the heart on the player and
  in the menu. Read once and held, like the other switches every screen reads.
*/
let loaded = false;
const shown = createStore(true);

const currentShown = (): boolean => {
  if (!loaded) {
    loaded = true;
    try {
      shown.set(readSetting(SETTINGS.favoritesShown) !== 'false');
    } catch {
      // Shown.
    }
  }
  return shown.get();
};

export const favoritesShown = currentShown;

export function useFavoritesShown(): boolean {
  return useSyncExternalStore(shown.subscribe, currentShown);
}

export function setFavoritesShown(on: boolean): void {
  loaded = true;
  shown.set(on);
  writeSetting(SETTINGS.favoritesShown, on ? 'true' : 'false');
}
