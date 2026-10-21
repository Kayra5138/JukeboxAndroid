import { useSyncExternalStore } from 'react';

import { db, readSetting, SETTINGS, writeSetting } from '../db/index';
import { showTipsAgain } from './tipsStore';
import { createWelcome, type SetupKind, type SetupStep } from './welcome';

/**
 * The first start, with the settings table behind it. Who is welcomed, and
 * when, is in `welcome.ts`.
 */
const welcome = createWelcome({
  read: () => readSetting(SETTINGS.welcome),
  write: (words) => writeSetting(SETTINGS.welcome, words),
  readSeen: () => readSetting(SETTINGS.setupSeen),
  writeSeen: (version) => writeSetting(SETTINGS.setupSeen, String(version)),
  languageChosen: () => readSetting(SETTINGS.language) !== null,
  listened: () => {
    const row = db().getFirstSync<{ n: number }>(
      'SELECT (SELECT COUNT(*) FROM plays) + (SELECT COUNT(*) FROM skips) AS n'
    );
    return Number(row?.n ?? 0);
  },
});

const shown = () => {
  try {
    return welcome.shown();
  } catch {
    return false;
  }
};

/** Whether the welcome is drawn now. */
export function useWelcomeShown(): boolean {
  return useSyncExternalStore(welcome.subscribe, shown);
}

/** Whether it was asked for from Settings, rather than owed to a new install. */
export const welcomeAgain = (): boolean => welcome.again();

/** Why the setup is up, and which of its screens it is to show: read once, as it opens. */
export function welcomeSteps(): { kind: SetupKind; steps: SetupStep[] } {
  try {
    return { kind: welcome.kind() ?? 'new', steps: welcome.steps() };
  } catch {
    return { kind: 'new', steps: ['language'] };
  }
}

/** Puts the setup away, with this version of it seen. */
export const finishWelcome = (): void => welcome.finish();

/** Settles once nothing is in front of the app: for whatever would put a dialog up over the welcome. */
export const welcomePassed = (): Promise<void> => (shown() ? welcome.passed() : Promise.resolve());

/**
 * Everything a new install is shown, once more: the setup, from the language
 * on, the library's offer to look its files up, and the tips. From Settings, for
 * whoever wants the tour again or is handing the phone to somebody new.
 */
export function startOver(): void {
  // Not asked: there is nothing there to say what was answered, and so the offer stands again.
  writeSetting(SETTINGS.lookupOffer, '');
  showTipsAgain();
  welcome.startOver();
}

/** Each time the welcome is finished, for what reads once what the welcome may have changed. */
export const subscribeWelcome = (listener: () => void): (() => void) => welcome.subscribe(listener);
