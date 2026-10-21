/**
 * The first start: a few screens, over everything else and before anything
 * else is asked, for the choices worth making on the first day — which
 * language the app is to speak, how it looks, how Discover uses the network,
 * and what plays when the queue runs out — and the way back to them from
 * Settings for anybody who wants to see the app as it was when new.
 *
 * Somebody updating is shown the screens that were added since they last
 * saw any, once, and not the ones they have answered already: each screen
 * says which version of the setup brought it, and the setup version an
 * install has seen is kept. A screen added later is shown to everybody once
 * by giving it the next number.
 *
 * Nothing here reads the database or knows about React, so that who is
 * welcomed, with what, and when, can be tested; `welcomeStore.ts` puts the
 * settings table behind it.
 */

import { USED_AFTER } from './tips.ts';

/**
 * The screens of the setup, in their order, each with the setup version that
 * brought it.
 *
 * The language came first and alone, as version nought, before there was a
 * setup to number: everybody who has used the app since has chosen one, or
 * has been reading it long enough not to be asked. The rest came in version
 * one. A screen added later goes where it belongs in the order with the next
 * number, and {@link SETUP_VERSION} follows.
 */
export const SETUP_STEPS = [
  { id: 'language', since: 0 },
  { id: 'look', since: 1 },
  { id: 'discover', since: 1 },
  { id: 'autoplay', since: 1 },
] as const satisfies readonly { id: string; since: number }[];

export type SetupStep = (typeof SETUP_STEPS)[number]['id'];

/** The setup as it stands in this version of the app: the newest screen's number. */
export const SETUP_VERSION: number = Math.max(...SETUP_STEPS.map((step) => step.since));

/**
 * Why the setup is up.
 *
 *  - 'new': a new install, shown all of it;
 *  - 'update': somebody who has used the app, shown what is newer than what
 *    they saw;
 *  - 'again': asked for from Settings, and shown all of it.
 */
export type SetupKind = 'new' | 'update' | 'again';

/**
 * The screens to show, for why it is up and the setup version last seen.
 *
 * Somebody updating is not walked back through what they have answered, the
 * language least of all: they chose it, or the app has been speaking it to
 * them for a year.
 */
export function stepsFor(kind: SetupKind, seen: number): SetupStep[] {
  if (kind !== 'update') return SETUP_STEPS.map((step) => step.id);
  return SETUP_STEPS.filter((step) => step.since > seen).map((step) => step.id);
}

/**
 * The setup version a setting says was seen. Nothing, or anything that is
 * not a whole number, is nought: an install from before the setup was
 * numbered, which has seen the language screen or was never owed it.
 */
export function seenFrom(words: string | null): number {
  if (!words) return 0;
  const seen = Number(words);
  return Number.isInteger(seen) && seen >= 0 ? seen : 0;
}

/**
 * What is kept, as the setting's words.
 *
 *  - 'done': the welcome has been seen, or was never owed;
 *  - 'again': Settings has asked for it, and it shows on every start until it
 *    is finished.
 *
 * Absent, it is decided the first time anybody asks. Which setup version was
 * seen is a setting of its own, beside it.
 */
export type WelcomeKept = 'done' | 'again';

export type WelcomeDeps = {
  read(): string | null;
  write(words: WelcomeKept): void;
  /** The setup version last seen through to the end, as stored; null where none is. */
  readSeen(): string | null;
  writeSeen(version: number): void;
  /** Whether a language has ever been chosen on this install. */
  languageChosen(): boolean;
  /** How many plays and skips the history holds. Throws, and nobody is a newcomer. */
  listened(): number;
};

/**
 * Whether somebody is new, the first time it is asked.
 *
 * A language already chosen, or a history worth the name, is somebody who
 * has been using the app since before there was a welcome, and is not to be
 * asked which language they speak by an app they have been reading for a
 * year. A history that cannot be read is taken the same way.
 */
export function isNewcomer(deps: Pick<WelcomeDeps, 'languageChosen' | 'listened'>): boolean {
  try {
    if (deps.languageChosen()) return false;
    return deps.listened() < USED_AFTER;
  } catch {
    return false;
  }
}

export type Welcome = {
  /** Whether the welcome is to be drawn now. */
  shown(): boolean;
  /** Whether it was asked for from Settings, rather than owed to a new install. */
  again(): boolean;
  /** Why it is up; null while it is not. */
  kind(): SetupKind | null;
  /** The screens it is to show, in order; none while it is not up. */
  steps(): SetupStep[];
  /** Puts it away, for good or until {@link startOver}, with this version of the setup seen. */
  finish(): void;
  /** The welcome once more, now and on every start until it is finished. */
  startOver(): void;
  /** Settles once it is not shown; at once, when it is not. */
  passed(): Promise<void>;
  subscribe(listener: () => void): () => void;
};

type Standing = SetupKind | 'done';

export function createWelcome(deps: WelcomeDeps): Welcome {
  let held: Standing | null = null;
  // The setup version seen, as it was when the standing was decided.
  let seen = SETUP_VERSION;
  const listeners = new Set<() => void>();
  let waiting: (() => void)[] = [];

  const write = (words: WelcomeKept) => {
    try {
      deps.write(words);
    } catch {
      // Held for this run of the app, and decided again on the next.
    }
  };

  /*
    Whether somebody who has had the welcome is owed the newer screens of the
    setup. A setting that cannot be read is taken as everything seen: better
    a screen missed than one shown on every start because its answer could
    not be kept.
  */
  const sinceSeen = (): Standing => {
    try {
      seen = seenFrom(deps.readSeen());
    } catch {
      seen = SETUP_VERSION;
    }
    return seen < SETUP_VERSION ? 'update' : 'done';
  };

  const state = (): Standing => {
    if (held) return held;
    let words: string | null = null;
    try {
      words = deps.read();
    } catch {
      // As if nothing were kept.
    }
    if (words === 'again') {
      held = 'again';
    } else if (words === 'done') {
      held = sinceSeen();
    } else if (isNewcomer(deps)) {
      /*
        Owed, and not written down until it is finished: an app closed in the
        middle of the setup asks again on the next start, from the language.
      */
      seen = 0;
      held = 'new';
    } else {
      /*
        Somebody from before there was a welcome is written down at once, so
        that the history is counted only the once; and then shown what is
        newer than what they have, which is every screen but the language.
      */
      write('done');
      held = sinceSeen();
    }
    return held;
  };

  const tell = () => {
    if (state() === 'done') {
      const settled = waiting;
      waiting = [];
      for (const resolve of settled) resolve();
    }
    for (const listener of [...listeners]) listener();
  };

  return {
    shown: () => state() !== 'done',
    again: () => state() === 'again',
    kind: () => {
      const now = state();
      return now === 'done' ? null : now;
    },
    steps: () => {
      const now = state();
      return now === 'done' ? [] : stepsFor(now, seen);
    },
    finish: () => {
      if (state() === 'done') return;
      held = 'done';
      seen = SETUP_VERSION;
      try {
        deps.writeSeen(SETUP_VERSION);
      } catch {
        // Shown again on the next start, which is the lesser harm.
      }
      write('done');
      tell();
    },
    startOver: () => {
      held = 'again';
      write('again');
      tell();
    },
    passed: () =>
      state() === 'done'
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            waiting.push(resolve);
          }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Which of the app's languages a device's locale means, or null where it
 * speaks none of them.
 *
 * By the language and, where the app has more than one way of writing it,
 * the script or region: any Portuguese is offered Brazil's, and any Chinese
 * the simplified characters, which a reader of the traditional ones reads
 * more easily than English.
 */
export function languageForLocale<Id extends string>(locale: string | null | undefined, ids: readonly Id[]): Id | null {
  if (!locale) return null;
  const tag = locale.replace(/_/g, '-').toLowerCase();
  const exact = ids.find((id) => id.toLowerCase() === tag);
  if (exact) return exact;
  const base = tag.split('-')[0];
  return ids.find((id) => id.toLowerCase().split('-')[0] === base) ?? null;
}
