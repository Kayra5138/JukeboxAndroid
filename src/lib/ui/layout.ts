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
 * Whether records are browsed as a rack rather than as a list.
 *
 * Never upright, whatever the setting says. The rack is records turned about a
 * vertical axis and seen from the side, and a tall frame cannot hold that
 * shape — it has to stack them instead, which comes out as a pile of slabs
 * rather than a shelf. So the question is only asked of a phone on its side,
 * and there it is on unless turned off.
 */
export function rackWanted(landscape: boolean): boolean {
  return landscape && readSetting(SETTINGS.coverFlow) !== 'false';
}
