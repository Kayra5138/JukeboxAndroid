import { useSyncExternalStore } from 'react';

import { tellNativeLanguage } from './bridge';
import {
  currentLanguage,
  languageFrom,
  stringsFor,
  type Language,
  type Strings,
} from './languages.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index';

export {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  strings,
  type Language,
  type Strings,
} from './languages.ts';

/**
 * The half of the language that needs the app around it: the stored choice,
 * the native side, and the hooks that redraw a screen when it changes.
 *
 * There is no provider. The language is one value held outside React, and a
 * component that asks for it is subscribed to it, so the error screen — which
 * sits outside every provider there is — can ask like anything else.
 */

/**
 * Reads the stored choice. Called once, before anything is drawn.
 *
 * This is a database read ahead of the first frame, which the rest of the app
 * is careful not to make. It is made here because the alternative is worse: a
 * frame of English, then the same screen again in Turkish. Anything that
 * starts without a screen — a background task — has to call it for itself
 * before it makes a line of text.
 */
export function loadLanguage(): void {
  try {
    currentLanguage.set(languageFrom(readSetting(SETTINGS.language)));
  } catch {
    // A database that will not open is reported by whoever needs it next;
    // until then the app speaks its default.
  }
  tellNativeLanguage(currentLanguage.get());
}

/** Changes the language, for good, and redraws everything that is showing words. */
export function chooseLanguage(language: Language): void {
  currentLanguage.set(language);
  writeSetting(SETTINGS.language, language);
  tellNativeLanguage(language);
}

export function useLanguage(): Language {
  return useSyncExternalStore(currentLanguage.subscribe, currentLanguage.get);
}

/** Everything the app says, in the language in use: `const t = useT()`, then `t.common.cancel`. */
export function useT(): Strings {
  return stringsFor(useLanguage());
}
