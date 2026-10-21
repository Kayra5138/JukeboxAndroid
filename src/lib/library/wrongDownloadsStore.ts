import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { libraryMistakes, rightKey, type Mistake } from '../discover/verify';
import type { EnrichedTrack } from '../media/enriched';
import { useDownloads } from '../youtube/DownloadsProvider';
import type { DownloadJob } from '../youtube/types';
import { useLibraryTracks } from './useLibrary';

/**
 * The downloads in the library that may be the wrong song, with the settings
 * table behind the ones the user has said are right. What counts is in
 * `discover/verify.ts`.
 *
 * Worked out once for each reading of the jobs and the library, and kept: the
 * Library tab, Settings and the screen itself all ask, about the same jobs and
 * the same tracks, which are the same objects until something changes.
 */

let right: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

/*
  Read the first time something draws the answer. Unreadable is nothing said
  yet: every such file is shown, which is the side to be wrong on.
*/
function rightNow(): ReadonlySet<string> {
  if (right) return right;
  try {
    const said: unknown = JSON.parse(readSetting(SETTINGS.libraryRightDownloads) ?? '[]');
    right = new Set(Array.isArray(said) ? said.filter((key): key is string => typeof key === 'string') : []);
  } catch {
    right = new Set();
  }
  return right;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Remembers that a file is the song it is filed as, so it is not shown again. The same file fetched again from another video is asked about afresh. */
export function markRight(trackId: string, videoId: string): void {
  const next = new Set(rightNow());
  next.add(rightKey(trackId, videoId));
  writeSetting(SETTINGS.libraryRightDownloads, JSON.stringify([...next]));
  right = next;
  for (const listener of listeners) listener();
}

let kept: {
  jobs: readonly DownloadJob[];
  tracks: readonly EnrichedTrack[];
  right: ReadonlySet<string>;
  found: Mistake<EnrichedTrack>[];
} | null = null;

function mistakesIn(
  jobs: readonly DownloadJob[],
  tracks: readonly EnrichedTrack[],
  said: ReadonlySet<string>
): Mistake<EnrichedTrack>[] {
  if (kept && kept.jobs === jobs && kept.tracks === tracks && kept.right === said) return kept.found;
  const found = libraryMistakes(jobs, tracks, said);
  kept = { jobs, tracks, right: said, found };
  return found;
}

/**
 * The files in the library that may be the wrong song, newest download
 * first; none while there is no library to look at.
 */
export function useWrongDownloads(): Mistake<EnrichedTrack>[] {
  const { jobs } = useDownloads();
  const tracks = useLibraryTracks();
  const said = useSyncExternalStore(subscribe, rightNow);
  return mistakesIn(jobs, tracks, said);
}
