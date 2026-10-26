import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

import { readMetadata } from '../db/metadata.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { findTrack } from '../media/library.ts';
import { withMetadata } from '../media/merge.ts';
import { currentTrackId } from '../player/nowPlaying.ts';
import { createStore } from '../ui/store.ts';
import { canWriteFiles, writeToFiles, type Outcome } from './index.ts';
import { tags } from './native.ts';

/**
 * Details written into the files without a button for it, where somebody
 * has said so: two settings, both off unless switched on.
 *
 *  - What somebody saves about a track — on its details, or for several at
 *    once — goes into the file as Save is pressed. Somebody is there, so
 *    the system may ask, and does, as the button would have.
 *  - What a lookup finds goes into the file once it is found, for a track
 *    the lookup matched and nobody has edited. Lookups run in the
 *    background, with the screen locked as often as not, where nothing can
 *    be asked. So Jukebox's own files, its downloads, which it may change
 *    without asking, are written at once; the rest wait, and are asked
 *    about together the next time the app is in front.
 *
 * Nothing makes the system stop asking about the others. Media management
 * would, but only for an app that may also see where photos were taken,
 * which Android 13 and later give only to apps that may read the photos:
 * not a thing for a music player to ask for. Tried, and taken out again.
 *
 * A track playing is never written, the player is reading it; it waits for
 * the next time.
 */

const on = (key: string) => {
  const store = createStore(false);
  let loaded = false;
  const get = (): boolean => {
    if (!loaded) {
      loaded = true;
      try {
        store.set(readSetting(key) === 'true');
      } catch {
        // Off, as on a new install.
      }
    }
    return store.get();
  };
  const set = (value: boolean) => {
    loaded = true;
    store.set(value);
    writeSetting(key, value ? 'true' : 'false');
  };
  return { get, set, subscribe: store.subscribe };
};

const edits = on(SETTINGS.writeEdits);
const lookups = on(SETTINGS.writeLookups);

export const writeEditsOn = edits.get;
export const writeLookupsOn = lookups.get;
export const useWriteEdits = (): boolean => useSyncExternalStore(edits.subscribe, edits.get);
export const useWriteLookups = (): boolean => useSyncExternalStore(lookups.subscribe, lookups.get);
export const setWriteEdits = edits.set;

export function setWriteLookups(value: boolean): void {
  lookups.set(value);
  if (!value) keepWaiting([]);
}

/**
 * Writes what was just saved for [trackIds] into their files, where that
 * setting is on. Answers what became of each, or null where nothing was
 * tried: the setting off, the phone unable, or the system's question
 * answered no.
 */
export async function afterSaved(trackIds: readonly string[]): Promise<Outcome[] | null> {
  if (!edits.get() || !canWriteFiles() || trackIds.length === 0) return null;
  const tracks = await shown(trackIds);
  if (tracks.length === 0) return null;
  return writeToFiles(tracks, { playingId: currentTrackId() });
}

function readWaiting(): string[] {
  try {
    const kept: unknown = JSON.parse(readSetting(SETTINGS.writeWaiting) ?? '[]');
    return Array.isArray(kept) ? kept.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function keepWaiting(ids: readonly string[]): void {
  writeSetting(SETTINGS.writeWaiting, JSON.stringify([...new Set(ids)]));
}

/** How long after the last track a lookup found the files are written: a run finds one every few seconds. */
const SETTLE_MS = 4_000;
/** And how long after it the others are asked about, so that a run going on in front is asked about once, at its end. */
const ASK_AFTER_MS = 20_000;

let soon: ReturnType<typeof setTimeout> | null = null;
let later: ReturnType<typeof setTimeout> | null = null;
let working: Promise<void> | null = null;

/**
 * Says a lookup has saved what it found for [trackIds]. Where that setting
 * is on, they are written into their files shortly: see above.
 */
export function afterLookedUp(trackIds: readonly string[]): void {
  if (!lookups.get() || !canWriteFiles() || trackIds.length === 0) return;
  try {
    keepWaiting([...readWaiting(), ...trackIds]);
  } catch {
    return;
  }
  if (soon) clearTimeout(soon);
  soon = setTimeout(() => void settle(false), SETTLE_MS);
  if (later) clearTimeout(later);
  later = setTimeout(() => void settle(true), ASK_AFTER_MS);
}

/** The tracks waiting, each as the library shows it, where a lookup matched it and nobody has edited it since. */
async function shown(trackIds: readonly string[]): Promise<ReturnType<typeof withMetadata>> {
  const found = await Promise.all(trackIds.map((id) => findTrack(id).catch(() => null)));
  return withMetadata(found.filter((track) => track != null));
}

/**
 * Writes what is waiting. Jukebox's own files always; the others only with
 * [ask], and with the app in front, where the system may put its question.
 */
function settle(ask: boolean): Promise<void> {
  if (working) return working.then(() => settle(ask));
  /*
    Let go of in a callback and not at the end of the work itself: work that
    finds nothing to do ends before it has been handed back, and let go of
    there it would be let go of before it was held, and held for good.
  */
  const task = writeWaiting(ask).finally(() => {
    if (working === task) working = null;
  });
  working = task;
  return task;
}

async function writeWaiting(ask: boolean): Promise<void> {
  try {
    if (!lookups.get() || !canWriteFiles()) return;
    const waiting = readWaiting();
    if (waiting.length === 0) return;
    // Only what a lookup matched: a row somebody edited is theirs to write, and a miss says nothing.
    const matched = waiting.filter((id) => readMetadata(id)?.status === 'matched');
    const owned = new Set(await (tags?.ownedAsync?.(matched) ?? Promise.resolve([] as string[])));
    const front = AppState.currentState === 'active';
    const playing = currentTrackId();
    const now = matched.filter((id) => owned.has(id) && id !== playing);
    const asked = ask && front ? matched.filter((id) => !owned.has(id) && id !== playing) : [];
    const left = new Set(waiting.filter((id) => matched.includes(id)));

    if (now.length > 0) {
      const outcomes = await writeToFiles(await shown(now), {
        playingId: playing,
        unasked: true,
      });
      for (const outcome of outcomes ?? []) if (finished(outcome)) left.delete(outcome.id);
    }
    if (asked.length > 0) {
      const outcomes = await writeToFiles(await shown(asked), {
        playingId: playing,
      });
      // No is an answer: they are not asked about again until a lookup finds something new for them.
      if (outcomes == null) for (const id of asked) left.delete(id);
      for (const outcome of outcomes ?? []) if (finished(outcome)) left.delete(outcome.id);
    }
    keepWaiting([...left]);
  } catch (error) {
    console.warn('What lookups found could not be written into the files.', error);
  }
}

/** Whether a file is done with: written, already so, or never to be. Only a track that was playing waits. */
function finished(outcome: Outcome): boolean {
  return !(outcome.result.status === 'skipped' && outcome.result.why === 'playing');
}

/*
  The app coming to the front is when the files that need asking are asked
  about, and when the ones written while it was away are caught up on.
*/
AppState.addEventListener('change', (state) => {
  if (state === 'active' && lookups.get()) void settle(true);
});
