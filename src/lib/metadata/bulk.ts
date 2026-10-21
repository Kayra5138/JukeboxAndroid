import { useSyncExternalStore } from 'react';

import {
  clearLyrics,
  readLyrics,
  writeLocalLyrics,
  writeLyrics,
  writeLyricsUnreachable,
} from '../db/lyrics';
import { refreshLibrary } from '../library/index';
import { runLyrics, type LyricsItem, type LyricsResult } from '../lyrics/bulk';
import { readLocalLyrics } from '../lyrics/device';
import { fetchLyrics } from '../lyrics/lrclib';
import { spreadCovers } from '../media/coverSpread';
import { scanLibrary } from '../media/library';
import type { AlbumToLookUp } from './albumLookup';
import { enrichAlbum, enrichLibrary, type EnrichProgress, type EnrichResult } from './enrich';
import { noteError } from '../support/errorLogStore';
import type { Track } from '../types';

/**
 * The one bulk lookup there is, for the whole app.
 *
 * It was the Tags screen's own, and ended when that screen did. It is now
 * begun from two places — that screen's button, and the library's offer to a
 * newcomer — and the second is made from a screen somebody is about to scroll
 * away from, so the run belongs to neither of them. Either can start it, stop
 * it and show how it is going, and it carries on behind whichever is open.
 *
 * Still one at a time, and for the reason the screen gave: two runs share the
 * clock the rate limiting is measured against, so a second one doubles the
 * request rate against both services, and only the second could be stopped.
 */

/**
 * What a run is finding: details and covers, as the ordinary lookup does;
 * covers alone, for tracks somebody chose (`RunMode`); or lyrics, for tracks
 * somebody chose (`lyrics/bulk.ts`).
 *
 * All three are the one run. Lyrics are asked of another service than the
 * other two, and could have gone beside them, but a second run going at the
 * same time is a second thing to show and to stop, and the screens that show
 * a run have room for one.
 */
export type BulkKind = 'details' | 'covers' | 'lyrics';

/** How a run ended, for whoever wants to say so. Cleared when the next begins. */
export type BulkOutcome = { result: EnrichResult } | { lyrics: LyricsResult } | { error: string };

export type BulkState = {
  /** What the run under way, or the last one, was finding. */
  kind: BulkKind;
  /**
   * While a run is under way, how far it has got; null otherwise. For lyrics,
   * `matched` is the tracks words were found for, and there are no covers.
   */
  progress: EnrichProgress | null;
  last: BulkOutcome | null;
  /**
   * The record being looked up — its key, and the name to say — where the
   * run is one record looked up as a whole (`albumLookup.ts`) rather than
   * tracks one by one; and after it, the record the last run was. Null for a
   * run over tracks.
   */
  album: { key: string; name: string } | null;
};

/**
 * How often, at most, the library is told that results have landed.
 *
 * Every screen that shows tracks draws from the one held library, which looks
 * again when asked and reads the app's own tables only when they have been
 * written to. A run writes in bursts — one cover onto every track of a record
 * in the same moment — and Apple is asked a question every three and a half
 * seconds, so a few seconds is as often as there is anything new to show and
 * seldom enough that reading both tables is not happening under somebody's
 * finger all the while.
 */
const TELL_LIBRARY_EVERY_MS = 4_000;

let state: BulkState = { kind: 'details', progress: null, last: null, album: null };
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
const savedListeners = new Set<(trackIds: string[]) => void>();

function publish(next: BulkState) {
  state = next;
  for (const listener of [...listeners]) listener();
}

export const bulkLookupState = (): BulkState => state;
export const bulkLookupRunning = (): boolean => controller !== null;

export function subscribeBulkLookup(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Told which tracks have just had something written, as it happens: for a
 * screen that would rather touch those rows than read everything again.
 */
export function onBulkSaved(listener: (trackIds: string[]) => void): () => void {
  savedListeners.add(listener);
  return () => {
    savedListeners.delete(listener);
  };
}

export function useBulkLookup(): BulkState {
  return useSyncExternalStore(subscribeBulkLookup, bulkLookupState);
}

/** Calls the run off. What was found so far stays written. */
export function stopBulkLookup(): void {
  controller?.abort();
}

/**
 * Looks [tracks] up, skipping those already tried, and answers when it is
 * over — or at once with null, if a run is already under way.
 *
 * [library] is the whole library where the caller has it, for the covers a
 * track can take from its neighbours on a record. Never rejects.
 */
export function startBulkLookup(tracks: Track[], library?: Track[]): Promise<BulkOutcome | null> {
  return startTrackRun('details', tracks, library);
}

/**
 * Finds covers for [tracks] and nothing else: see `RunMode`. The same run as
 * the others, one at a time, and answered at once with null if one is under
 * way. Once it is over, the records of these tracks hand whatever covers they
 * now have to their tracks still without one. Never rejects.
 */
export async function startCoverLookup(tracks: Track[], library?: Track[]): Promise<BulkOutcome | null> {
  const outcome = await startTrackRun('covers', tracks, library);
  if (outcome) void spreadCovers({ trackIds: tracks.map((track) => track.id) });
  return outcome;
}

async function startTrackRun(
  kind: 'details' | 'covers',
  tracks: Track[],
  library?: Track[]
): Promise<BulkOutcome | null> {
  if (controller || tracks.length === 0) return null;
  const own = new AbortController();
  controller = own;
  /*
    Started without a total. Only the enrichment knows how many of these have
    not been tried before, and seeding this with all of them made the count
    read "1 of 5000" until the first real progress arrived and turned it into
    "1 of 37".
  */
  publish({ kind, progress: { done: 0, total: 0, matched: 0, covers: 0, throttled: false }, last: null, album: null });

  let telling: ReturnType<typeof setTimeout> | null = null;
  const tell = () => {
    telling = null;
    void refreshLibrary();
  };
  const onSaved = (ids: string[]) => {
    for (const listener of [...savedListeners]) listener(ids);
    if (telling == null) telling = setTimeout(tell, TELL_LIBRARY_EVERY_MS);
  };

  let outcome: BulkOutcome;
  try {
    const result = await enrichLibrary(
      tracks,
      (progress) => {
        if (controller === own) publish({ ...state, progress });
      },
      own.signal,
      { library, onSaved, mode: kind === 'covers' ? 'covers' : 'everything' }
    );
    outcome = { result };
  } catch (error) {
    // Enrichment is documented never to reject, but this is the wrong place
    // to find out that changed.
    outcome = { error: error instanceof Error ? error.message : String(error) };
    noteError('lookup', error);
  }
  if (telling) clearTimeout(telling);
  controller = null;
  publish({ kind, progress: null, last: outcome, album: null });
  // Once more at the end, for whatever landed since the last telling.
  void refreshLibrary();
  return outcome;
}

/**
 * Looks one record up as a whole, because somebody asked for that record:
 * see `albumLookup.ts`. The same run as any other — one at a time, shown on
 * the Tags screen and under the library's count, stopped by the same Stop —
 * and answered at once with null if a run is already under way.
 *
 * Once it is over, whatever cover the record now has is handed to the tracks
 * of it still without one. Never rejects.
 */
export async function startAlbumLookup(
  album: AlbumToLookUp & { key: string },
  library?: Track[]
): Promise<BulkOutcome | null> {
  if (controller || album.tracks.length === 0) return null;
  const own = new AbortController();
  controller = own;
  publish({
    kind: 'details',
    progress: { done: 0, total: album.tracks.length, matched: 0, covers: 0, throttled: false },
    last: null,
    album: { key: album.key, name: album.name },
  });

  let outcome: BulkOutcome;
  try {
    const result = await enrichAlbum(
      album,
      (progress) => {
        if (controller === own) publish({ ...state, progress });
      },
      own.signal,
      { library, onSaved: (ids) => savedListeners.forEach((listener) => listener(ids)) }
    );
    outcome = { result };
  } catch (error) {
    outcome = { error: error instanceof Error ? error.message : String(error) };
    noteError('lookup', error);
  }
  controller = null;
  publish({ kind: 'details', progress: null, last: outcome, album: { key: album.key, name: album.name } });
  void spreadCovers({ trackIds: album.tracks.map((track) => track.id) });
  return outcome;
}

/**
 * The whole library, as "Look up missing" on the Tags screen looks it up: the
 * device's own tracks, of which the enrichment skips whatever has been tried.
 */
export async function lookUpWholeLibrary(): Promise<BulkOutcome | null> {
  if (controller) return null;
  let tracks: Track[];
  try {
    tracks = await scanLibrary();
  } catch (error) {
    const outcome = { error: error instanceof Error ? error.message : String(error) };
    noteError('lookup', error);
    publish({ kind: 'details', progress: null, last: outcome, album: null });
    return outcome;
  }
  return startBulkLookup(tracks, tracks);
}

/**
 * Finds words for [items], the tracks somebody chose: see `lyrics/bulk.ts`.
 * The same run as the others — one at a time, shown where they are, stopped
 * by the same Stop — and answered at once with null if one is under way.
 * Never rejects.
 */
export async function startLyricsLookup(items: LyricsItem[]): Promise<BulkOutcome | null> {
  if (controller || items.length === 0) return null;
  const own = new AbortController();
  controller = own;
  const shown = (done: number, total: number, found: number, offline?: boolean): EnrichProgress => ({
    done,
    total,
    matched: found,
    covers: 0,
    throttled: false,
    ...(offline ? { offline } : {}),
  });
  publish({ kind: 'lyrics', progress: shown(0, items.length, 0), last: null, album: null });

  let outcome: BulkOutcome;
  try {
    const lyrics = await runLyrics(
      items,
      (progress) => {
        if (controller === own) {
          publish({ ...state, progress: shown(progress.done, progress.total, progress.found, progress.offline) });
        }
      },
      own.signal,
      {
        stored: (trackId) => {
          const kept = readLyrics(trackId);
          return kept ? { lyrics: { plain: kept.plain, synced: kept.synced }, source: kept.source } : null;
        },
        readLocal: readLocalLyrics,
        fetch: fetchLyrics,
        writeLocal: (trackId, found) => writeLocalLyrics(trackId, found, Date.now()),
        writeLookup: (trackId, found) => {
          // Cleared first when there are words, as the details screen does:
          // a shift and translations left on the row belong to no words now.
          if (found) clearLyrics(trackId);
          writeLyrics(trackId, found, Date.now());
        },
        writeUnreachable: (trackId) => writeLyricsUnreachable(trackId, Date.now()),
        forget: clearLyrics,
        onSaved: (trackId) => savedListeners.forEach((listener) => listener([trackId])),
      }
    );
    outcome = { lyrics };
  } catch (error) {
    outcome = { error: error instanceof Error ? error.message : String(error) };
    noteError('lookup', error);
  }
  controller = null;
  publish({ kind: 'lyrics', progress: null, last: outcome, album: null });
  return outcome;
}
