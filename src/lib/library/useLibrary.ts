import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { EnrichedTrack } from '../media/enriched';
import { libraryState, refreshLibrary, subscribeLibrary, type LibraryState } from './index';

/** A stable empty library, so nothing built from the tracks is built again over a new nothing. */
const NOTHING: EnrichedTrack[] = [];

const tracksNow = (): EnrichedTrack[] => {
  const state = libraryState();
  return state.kind === 'library' ? state.tracks : NOTHING;
};

let watching = false;

/**
 * Looks at the device again whenever the app comes back to the front.
 *
 * A screen asks on every visit, but coming back from another app is not a
 * visit: the screen that was open is simply still open. And another app is
 * exactly where a file is most likely to have been added, retagged or
 * removed. Begun with the first screen that shows the library and never
 * stopped — there is one library, and it outlives any screen.
 */
function watch(): void {
  if (watching) return;
  watching = true;
  AppState.addEventListener('change', (now) => {
    if (now === 'active') void refreshLibrary();
  });
}

function subscribe(listener: () => void): () => void {
  watch();
  return subscribeLibrary(listener);
}

/**
 * The library and how it stands: being read, refused, failed, or here.
 *
 * Drawing from this does not read anything. Whoever draws asks for a look
 * with `refreshLibrary` when it comes into view, as it used to scan.
 */
export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribe, libraryState);
}

/**
 * Only the tracks, and none while there is no library to show.
 *
 * For a screen that has nothing to say about a refusal or a failure. The list
 * is the same list from one render to the next until a track in it changes,
 * and an unchanged track in it is the same object, so what is worked out from
 * either can be kept by asking whether it is the same one.
 */
export function useLibraryTracks(): EnrichedTrack[] {
  return useSyncExternalStore(subscribe, tracksNow);
}
