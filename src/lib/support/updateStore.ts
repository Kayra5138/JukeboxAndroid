import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { request, USER_AGENT } from '../metadata/http';
import { createStore } from '../ui/store';
import { isDue, NOTHING_KNOWN, offerOf, readKnown, releaseOf, RELEASES_URL, type UpdateKnown } from './update';

/**
 * Whether there is a newer Jukebox, as the app knows it at this moment, and
 * the asking. What is asked of whom, and how rarely, is `update.ts`'s to say;
 * this is where its rules are kept to.
 *
 * Held outside React because two places that are not drawn together show it:
 * the row at the top of Settings, and the dot on Settings' tab.
 */
type UpdateState = { known: UpdateKnown; wanted: boolean };

const store = createStore<UpdateState>({ known: NOTHING_KNOWN, wanted: true });
let opened = false;

function current(): UpdateState {
  if (!opened) {
    opened = true;
    try {
      store.set({
        known: readKnown(readSetting(SETTINGS.updateKnown)),
        wanted: readSetting(SETTINGS.updateCheck) !== 'false',
      });
    } catch {
      // A database that will not open has bigger news than this.
    }
  }
  return store.get();
}

const running = (): string | null => Constants.expoConfig?.version ?? null;

function learnt(known: UpdateKnown): void {
  store.set({ ...store.get(), known });
  try {
    writeSetting(SETTINGS.updateKnown, JSON.stringify(known));
  } catch {
    // Not written down, it is asked again on the next start.
  }
}

/** Shorter than the catalogues are given: nobody is waiting on this, and it can be asked tomorrow. */
const CHECK_TIMEOUT_MS = 10_000;
let asking = false;

/**
 * Asks GitHub for the latest release, if a check is due and the app is not
 * behind another. (Not "is in front": just started, the phone may not yet
 * have said, and there is no coming to the front after that to wait for.) Says nothing either way: what is found is shown where it is shown,
 * and a failure is only a day's wait for the next try.
 */
async function check(): Promise<void> {
  const { known, wanted } = current();
  if (asking || AppState.currentState === 'background' || !isDue(known, Date.now(), wanted)) return;
  asking = true;
  // Written down before the asking, so that a check that never comes back still counts as the day's.
  const before = { ...known, triedAt: Date.now() };
  learnt(before);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const body = await request<unknown>(
      'GitHub',
      RELEASES_URL,
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT } },
      controller.signal
    );
    const release = releaseOf(body);
    // The switch may have been turned off while the answer was on its way: then it is not kept.
    if (release && store.get().wanted) learnt({ latest: release.version, url: release.url, triedAt: before.triedAt });
  } catch {
    // Silent, by design: see `update.ts`.
  }
  clearTimeout(timer);
  asking = false;
}

/**
 * The check now, if it is due, and again whenever the app comes back to the
 * front. Begun once from the root layout; answers with the way to stop.
 */
export function keepCheckingForUpdates(): () => void {
  void check();
  const returning = AppState.addEventListener('change', (state) => {
    if (state === 'active') void check();
  });
  return () => returning.remove();
}

const offered = () => {
  const { known, wanted } = current();
  return offerOf(known, running(), wanted);
};

/** The newer release to tell of, or null; the same object while nothing changes. */
let lastOffer: ReturnType<typeof offerOf> = null;
function offerNow(): ReturnType<typeof offerOf> {
  const next = offered();
  if (next?.version === lastOffer?.version && next?.url === lastOffer?.url) return lastOffer;
  lastOffer = next;
  return next;
}

export function useUpdateOffer(): { version: string; url: string } | null {
  return useSyncExternalStore(store.subscribe, offerNow);
}

export function useUpdateCheckWanted(): boolean {
  return useSyncExternalStore(store.subscribe, () => current().wanted);
}

/**
 * The switch. Turned on, a check is made at once if one is due, which on a
 * phone that has never asked is now: whoever turned it on is waiting to see.
 */
export function setUpdateCheckWanted(wanted: boolean): void {
  current();
  store.set({ ...store.get(), wanted });
  try {
    writeSetting(SETTINGS.updateCheck, wanted ? 'true' : 'false');
  } catch {
    // Held for this run of the app.
  }
  if (wanted) void check();
}
