import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import type { EnrichedTrack } from '../media/enriched';
import { findCopies, pairsOf, parseApart } from './copies';
import { useLibraryTracks } from './useLibrary';

/**
 * The library's copies of the same song, with the settings table behind the
 * pairs the user has said are not. What counts as a copy is in `copies.ts`.
 *
 * Worked out once for each library and kept: the Library tab, Settings and
 * the Copies screen all ask, and every one of them is asking about the same
 * list of tracks, which is the same object until a file comes, goes or is
 * changed.
 */

let apart: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

/*
  Read the first time something draws the answer, which is after the
  screens have opened the database anyway. Unreadable is nothing said yet:
  every copy is shown, which is the side to be wrong on.
*/
function apartNow(): ReadonlySet<string> {
  if (apart) return apart;
  try {
    apart = parseApart(readSetting(SETTINGS.libraryNotCopies));
  } catch {
    apart = new Set();
  }
  return apart;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Remembers that the tracks are different songs, every pair of them, so the
 * group is not shown again. A file that later turns up looking like any of
 * them makes a pair nobody has answered, and is shown.
 */
export function markNotCopies(ids: readonly string[]): void {
  const next = new Set(apartNow());
  for (const pair of pairsOf(ids)) next.add(pair);
  writeSetting(SETTINGS.libraryNotCopies, JSON.stringify([...next]));
  apart = next;
  for (const listener of listeners) listener();
}

let kept: { tracks: readonly EnrichedTrack[]; apart: ReadonlySet<string>; groups: EnrichedTrack[][] } | null =
  null;

/** The copies in [tracks], worked out again only when the tracks or the answers are not the ones last asked about. */
function copiesIn(tracks: readonly EnrichedTrack[], said: ReadonlySet<string>): EnrichedTrack[][] {
  if (kept && kept.tracks === tracks && kept.apart === said) return kept.groups;
  const groups = findCopies(tracks, said);
  kept = { tracks, apart: said, groups };
  return groups;
}

/**
 * The songs the library holds more than once, each as its copies; none
 * while there is no library to look at.
 */
export function useCopies(): EnrichedTrack[][] {
  const tracks = useLibraryTracks();
  const said = useSyncExternalStore(subscribe, apartNow);
  return copiesIn(tracks, said);
}
