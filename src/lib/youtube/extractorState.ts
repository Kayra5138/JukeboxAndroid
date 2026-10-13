import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { readSetting, SETTINGS, writeSetting } from '../db/index';
import { createStore } from '../ui/store';
import {
  adviceOf,
  daysSince,
  isDue,
  isNewer,
  NOTHING_KNOWN,
  readKnown,
  troubleOf,
  type Advice,
  type Known,
  type Trouble,
} from './extractor';
import { downloads } from './native';

/**
 * The extractor as the app knows it at this moment: which version is on the
 * phone, what the last look for a newer one found, and whatever is being
 * done about it.
 *
 * Held outside React, like the few other things more than one screen has to
 * agree on: the Downloads screen shows it, every failed download's row goes
 * by it, Settings has its switch, and the look itself is set off from
 * wherever something is put in the queue. What is sent to whom, and when,
 * is `extractor.ts`'s to say; this is where its rules are kept to.
 */
export type ExtractorState = {
  /** The version on the phone; null until the phone has been asked, and for good on a build that cannot say. */
  installed: string | null;
  /** The version this build of the app carries, which is what "restore" goes back to. */
  bundled: string | null;
  known: Known;
  /** Whether the look is made by itself. */
  wanted: boolean;
  /** `adviceOf` and `daysSince`, worked out when anything changed and when the screen was last come to. */
  advice: Advice;
  checkedDays: number | null;
  /** What is under way. The middle three are an update, as the phone names its stages. */
  doing: null | 'checking' | 'waiting' | 'downloading' | 'checkingFile' | 'restoring';
  percent: number;
  /** Why the last thing asked for by hand did not come off. */
  trouble: null | { during: 'check' | 'update'; why: Trouble };
  /** The version an update or a restore has just put in place, while that is still news. */
  changedTo: string | null;
};

const store = createStore<ExtractorState>({
  installed: null,
  bundled: null,
  known: NOTHING_KNOWN,
  wanted: true,
  advice: 'none',
  checkedDays: null,
  doing: null,
  percent: 0,
  trouble: null,
  changedTo: null,
});

function publish(change: Partial<ExtractorState>): void {
  const next = { ...store.get(), ...change };
  const now = Date.now();
  // Only a build that can fetch one has anything to advise.
  // Nor is anything advised just after it was tried and did not come off:
  // the rows that would have offered it go back to "Retry", and the reason
  // is said once, beside the version, with the button to try it again.
  next.advice = downloads?.updateExtractorAsync && !next.trouble ? adviceOf(next.installed, next.known, now) : 'none';
  next.checkedDays = daysSince(next.known, now);
  store.set(next);
}

function learnt(known: Known): void {
  publish({ known });
  try {
    writeSetting(SETTINGS.extractorKnown, JSON.stringify(known));
  } catch {
    // Not written down, it is asked again sooner than it might have been.
  }
}

let opened = false;
/** Reads what was kept and asks the phone what it has, the first time anybody wants to know. */
function open(): void {
  if (opened) return;
  opened = true;
  try {
    publish({
      known: readKnown(readSetting(SETTINGS.extractorKnown)),
      wanted: readSetting(SETTINGS.extractorCheck) !== 'false',
    });
  } catch {
    // A database that will not open has bigger news than this.
  }
  downloads?.addListener?.('onExtractorUpdate', ({ phase, percent }) => {
    const doing = store.get().doing;
    // Only while an update is what is under way: a word that arrives after it ended is about nothing.
    if (doing !== 'waiting' && doing !== 'downloading' && doing !== 'checkingFile') return;
    publish({ doing: phase === 'checking' ? 'checkingFile' : phase, percent });
  });
  void downloads
    ?.extractorVersionsAsync?.()
    .then(({ installed, bundled }) => publish({ installed, bundled }))
    .catch(() => {});
}

function current(): ExtractorState {
  open();
  return store.get();
}

export function useExtractor(): ExtractorState {
  return useSyncExternalStore(store.subscribe, current);
}

/** What a failed download's row goes by, as two plain values: a row is not drawn again for a percentage. */
export function useExtractorAdvice(): Advice {
  return useSyncExternalStore(store.subscribe, () => current().advice);
}
export function useExtractorBusy(): boolean {
  return useSyncExternalStore(store.subscribe, () => current().doing !== null);
}

export function setExtractorCheckWanted(wanted: boolean): void {
  open();
  publish({ wanted });
  writeSetting(SETTINGS.extractorCheck, wanted ? 'true' : 'false');
}

/**
 * Asks GitHub which release is the latest. [byHand] is a press on the
 * button; without it this is the look the app makes by itself, which is made
 * only when it is due and the app is in front, and is silent when it fails.
 */
export async function checkExtractor(byHand: boolean): Promise<void> {
  open();
  const native = downloads;
  const state = store.get();
  if (!native?.extractorLatestAsync || state.doing) return;
  if (!byHand && (AppState.currentState !== 'active' || !isDue(state.known, Date.now(), state.wanted))) return;
  publish({ doing: 'checking', trouble: null, changedTo: null });
  try {
    const latest = await native.extractorLatestAsync();
    const now = Date.now();
    learnt({ latest, checkedAt: now, triedAt: now });
    publish({ doing: null });
  } catch (error) {
    learnt({ ...store.get().known, triedAt: Date.now() });
    publish({ doing: null, trouble: byHand ? { during: 'check', why: troubleOf(error) } : null });
  }
}

/**
 * The app is being used to download: the Downloads screen was come to, or
 * something was put in the queue by hand. The one moment the look is made
 * unasked, if it is due.
 */
export function extractorWanted(): void {
  open();
  // A day may have gone by with the app open: what is advised is as of now.
  publish({});
  void checkExtractor(false);
}

/** Fetches the release the last look found and puts it in place. Only ever for a press. */
export async function updateExtractor(): Promise<void> {
  open();
  const native = downloads;
  const { doing, installed, known } = store.get();
  if (!native?.updateExtractorAsync || doing || !known.latest || !isNewer(known.latest, installed)) return;
  publish({ doing: 'waiting', percent: 0, trouble: null, changedTo: null });
  try {
    const now = await native.updateExtractorAsync(known.latest);
    publish({ doing: null, installed: now, changedTo: now });
  } catch (error) {
    publish({ doing: null, trouble: { during: 'update', why: troubleOf(error) } });
  }
}

/** Puts back the copy the build carries, for an update that turned out worse than what it replaced. */
export async function restoreExtractor(): Promise<void> {
  open();
  const native = downloads;
  if (!native?.restoreExtractorAsync || store.get().doing) return;
  publish({ doing: 'restoring', trouble: null, changedTo: null });
  try {
    const now = await native.restoreExtractorAsync();
    publish({ doing: null, installed: now, changedTo: now });
  } catch (error) {
    publish({ doing: null, trouble: { during: 'update', why: troubleOf(error) } });
  }
}
