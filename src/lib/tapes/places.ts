import { useSyncExternalStore } from 'react';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { createStore } from '../ui/store.ts';

/**
 * Where each tape was left, as the player keeps it (`Tapes.kt`), read over
 * here for the rows that show how far in each one is.
 *
 * The player writes; this only reads, again whenever something may have
 * moved a place on — a track coming on or going off, playing or pausing, and
 * every so often while a tape plays — and a few at once come to one reading.
 */
export type TapePlace = { positionSec: number; durationSec: number; at: number; finished: boolean };

const places = createStore<ReadonlyMap<string, TapePlace>>(new Map());
let reading: Promise<void> | null = null;
let again = false;

/** Reads the places again. Asked while a reading is under way, it reads once more after it. */
export function refreshTapePlaces(): void {
  if (reading) {
    again = true;
    return;
  }
  reading = (async () => {
    try {
      const read = (await JukeboxAudio.getTapePlacesAsync()) as Record<string, TapePlace> | null;
      places.set(keepSame(places.get(), read ?? {}));
    } catch {
      // An older player, or none yet: no places, as before there were tapes.
    }
  })().finally(() => {
    reading = null;
    if (again) {
      again = false;
      refreshTapePlaces();
    }
  });
}

/**
 * The new reading, with each place that has not moved kept as the same
 * object, and the whole of the old one kept where nothing moved at all.
 * Read on every change of song and every pause, a new map each time was the
 * library and every tape row drawn again for places that had stayed put,
 * with no tapes at all as much as with some.
 */
export function keepSame(was: ReadonlyMap<string, TapePlace>, read: Record<string, TapePlace>): ReadonlyMap<string, TapePlace> {
  const ids = Object.keys(read);
  let changed = ids.length !== was.size;
  const next = new Map<string, TapePlace>();
  for (const id of ids) {
    const fresh = read[id];
    const old = was.get(id);
    const same =
      old != null &&
      old.positionSec === fresh.positionSec &&
      old.durationSec === fresh.durationSec &&
      old.at === fresh.at &&
      old.finished === fresh.finished;
    if (!same) changed = true;
    next.set(id, same ? old : fresh);
  }
  return changed ? next : was;
}

/** Where [id] was left, as last read: for a press, which is not drawn. */
export function tapePlaceNow(id: string): TapePlace | null {
  return places.get().get(id) ?? null;
}

export function useTapePlaces(on = true): ReadonlyMap<string, TapePlace> {
  return useSyncExternalStore(on ? places.subscribe : unwatched, on ? places.get : nowhere);
}

/** For a screen with nothing showing the places now: not told of each, as a tape plays. */
const unwatched = () => () => {};
const NOWHERE: ReadonlyMap<string, TapePlace> = new Map();
const nowhere = () => NOWHERE;

/** One tape's place, or null where it has none. */
export function useTapePlace(id: string): TapePlace | null {
  return useSyncExternalStore(places.subscribe, () => places.get().get(id) ?? null);
}

/** A tape marked heard to the end, or as not begun. */
export async function markTape(id: string, finished: boolean, durationSec: number): Promise<void> {
  await JukeboxAudio.markTapeAsync(id, finished, durationSec);
  refreshTapePlaces();
}

/** How far into a tape its place is, from nought to one; null for none worth showing. */
export function progressOf(place: TapePlace | null): number | null {
  if (!place || place.finished || place.durationSec <= 0 || place.positionSec < 10) return null;
  return Math.min(1, place.positionSec / place.durationSec);
}
