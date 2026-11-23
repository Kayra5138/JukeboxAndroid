import { folderKey } from '../media/folders.ts';
import { seriesOf } from '../podcasts/series.ts';
import { inSeriesOrder, partsOf, type TapePart } from './order.ts';

/**
 * What a tape is played with, wherever it is played from — its row in the
 * tapes view, or the Lists tab's card of tapes to carry on with: an episode
 * of a followed show with the rest of the show, in the order they came out;
 * any other tape with the other parts of its record (`partsOf`). The player
 * takes it to its place from there.
 */
export function tapeQueueOf<T extends TapePart & { folder?: string | null }>(
  track: T,
  tapes: readonly T[]
): { tracks: T[]; index: number } {
  if (seriesOf(track)) {
    const folder = folderKey(track.folder ?? '').toLowerCase();
    const episodes = inSeriesOrder(tapes.filter((one) => folderKey(one.folder ?? '').toLowerCase() === folder));
    const index = episodes.findIndex((one) => one.id === track.id);
    if (index >= 0) return { tracks: episodes, index };
  }
  return partsOf(track, tapes);
}
