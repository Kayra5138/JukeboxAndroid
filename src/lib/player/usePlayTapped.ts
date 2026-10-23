import { useCallback } from 'react';

import { artistKey, spreadShuffle } from '../media/shuffle';
import type { Track } from '../types';
import { usePlayerActions } from './PlayerProvider';
import { tapQueue } from './tap';
import { tapChoice } from './tapSetting';

/**
 * Where a row was tapped: Tracks and the library's search results, where the
 * choice always holds, or the page of an album, list, artist or folder, where
 * it holds only when somebody has said so. See `tap.ts`.
 */
export type TapPlace = 'tracks' | 'page';

/**
 * Plays what a tap on row [index] of [list] means, by what was chosen in
 * Settings → Player. The choice is read at the tap, not held, so that rows
 * memoised with this need not be drawn again when it changes.
 */
export function usePlayTapped(): (list: Track[], index: number, place: TapPlace) => Promise<void> {
  const { playQueue } = usePlayerActions();
  return useCallback(
    (list: Track[], index: number, place: TapPlace) => {
      const { mode, everywhere } = tapChoice();
      const queue = tapQueue(place === 'tracks' || everywhere ? mode : 'list', list, index, (rest) => spreadShuffle(rest, artistKey));
      return playQueue(queue.tracks, queue.start, { similar: queue.similar });
    },
    [playQueue]
  );
}
