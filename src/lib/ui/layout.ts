import { useWindowDimensions } from 'react-native';

import { readSetting, SETTINGS } from '../db/index.ts';

/**
 * Which way the phone is being held, and what to do about it.
 *
 * Turned sideways a phone is not a taller screen but a wider one, and a single
 * column of rows down the middle of it leaves half the glass empty. The lists
 * answer that by running in two columns; the pages that are not lists answer it
 * by putting what was stacked side by side.
 */
export function useLandscape(): boolean {
  const { width, height } = useWindowDimensions();
  return width > height;
}

/**
 * How many columns a list of rows should run in.
 *
 * Two when there is room, one otherwise. Not derived from the width alone: a
 * row has to stay wide enough for a title to be read at a glance, which on a
 * phone held sideways is just about two columns and never three.
 */
export function useListColumns(): number {
  const { width, height } = useWindowDimensions();
  return width > height && width >= 640 ? 2 : 1;
}

/**
 * Whether records are browsed as a rack rather than as a list, held the way
 * the phone is: each way round asked apart (Settings → Look & feel).
 *
 * Either way the rack is the same: records on their edges seen from the side,
 * flicked across. Upright it was once stacked instead, a pile of slabs seen
 * from above that was neither a shelf nor a quicker way to anything than the
 * list; now it runs across the top of the screen, with the tracks of the
 * record in front under it. Sideways it is on unless turned off; upright, off
 * unless turned on.
 */
export function rackWanted(landscape: boolean): boolean {
  return landscape ? readSetting(SETTINGS.coverFlow) !== 'false' : readSetting(SETTINGS.coverFlowUpright) === 'true';
}
