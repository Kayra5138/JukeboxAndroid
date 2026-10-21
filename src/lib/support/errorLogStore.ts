import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from '../ui/store';
import {
  describeThrown,
  EMPTY_LOG,
  readLog,
  withEntry,
  withFailedDownloads,
  type ErrorEntry,
  type ErrorKind,
  type ErrorLog,
} from './errorLog';

/**
 * The error log, with the settings table behind it. What is kept, and how
 * it is scrubbed first, is in `errorLog.ts`.
 *
 * Every call here is safe from anywhere — the global error handler, a
 * `catch` on a screen, a listener — and none of them throws: a log that
 * cannot be written is a report with less in it, never a second failure on
 * top of the first.
 */
const store = createStore<ErrorLog>(EMPTY_LOG);
let opened = false;

function current(): ErrorLog {
  if (!opened) {
    opened = true;
    try {
      store.set(readLog(readSetting(SETTINGS.errorLog)));
    } catch {
      // A database that will not open has bigger news than this.
    }
  }
  return store.get();
}

function keep(next: ErrorLog): void {
  if (next === store.get()) return;
  store.set(next);
  try {
    writeSetting(SETTINGS.errorLog, JSON.stringify(next));
  } catch {
    // Held for this run of the app.
  }
}

const version = (): string | null => Constants.expoConfig?.version ?? null;

/**
 * Where the names the app knows of come from: the library, which says so
 * itself (`library/index.ts`) rather than being asked from here, since the
 * library already writes to this log and asking it back would go round in a
 * circle at start-up. Until it has, there are none, and the other rules of
 * `scrub.ts` are what stand.
 */
let knownNames: () => readonly string[] = () => [];

export function knowNamesFrom(provider: () => readonly string[]): void {
  knownNames = provider;
}

const names = (): readonly string[] => {
  try {
    return knownNames();
  } catch {
    return [];
  }
};

/**
 * Writes down one failure, of [kind], scrubbed. [what] is whatever was
 * caught or a line describing it; a thrown error is its kind, code and
 * message. [label], where there is one, goes first: the app's own word for
 * the failure, such as Discover's reason or the player's code.
 */
export function noteError(kind: ErrorKind, what: unknown, label?: string | null): void {
  try {
    const described = describeThrown(what);
    const message = label ? (described ? `${label} — ${described}` : label) : described;
    keep(withEntry(current(), { at: Date.now(), version: version(), kind, message }, names()));
  } catch {
    // See above: never a second failure.
  }
}

/** Writes down whichever downloads in [jobs] have failed since the last were. */
export function noteFailedDownloads(jobs: Parameters<typeof withFailedDownloads>[1]): void {
  try {
    keep(withFailedDownloads(current(), jobs, version(), Date.now(), names()));
  } catch {
    // See above.
  }
}

/** The failures written down, oldest first, for the report screen. */
export function useErrorEntries(): readonly ErrorEntry[] {
  return useSyncExternalStore(store.subscribe, () => current().entries);
}

type Rejection = { onUnhandled: (id: number, rejection: unknown) => void; onHandled: (id: number) => void; allRejections: boolean };
type Hermes = { HermesInternal?: { enablePromiseRejectionTracker?: (options: Rejection) => void } };

let watching = false;

/**
 * Has every uncaught error written down, and in a release build every
 * promise rejected with nobody to catch it, before they go wherever they
 * went before.
 *
 * The handler that was there is called after, as it was: in development it
 * is the red screen, and in a release it is what ends the app on a fatal
 * error. The write is synchronous for that reason — there is no later.
 *
 * Rejections only in a release, because in development React Native is
 * already following them with a tracker of its own, and Hermes keeps one.
 */
export function watchErrors(): void {
  if (watching) return;
  watching = true;
  try {
    const before = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, fatal) => {
      noteError('js', error);
      before(error, fatal);
    });
  } catch {
    // Not in this runtime.
  }
  if (!__DEV__) {
    try {
      (globalThis as Hermes).HermesInternal?.enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (_id, rejection) => noteError('js', rejection),
        onHandled: () => {},
      });
    } catch {
      // Not on Hermes, or not one that tracks.
    }
  }
}
