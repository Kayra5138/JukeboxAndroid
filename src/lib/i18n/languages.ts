import { en, type Strings } from './en/index.ts';
import { tr } from './tr/index.ts';
import { createStore } from '../ui/store.ts';

export type { Strings } from './en/index.ts';

/**
 * The languages the app can speak, and the one it is speaking.
 *
 * Adding one is a folder beside `en` and `tr` holding the same files, and a
 * line in the list below. Its id is its BCP-47 tag, which is what is stored
 * and what the native side is told; its name is written in the language
 * itself, because the picker is where somebody who cannot read the current
 * one has to find their own.
 *
 * Nothing here touches React, the database or the phone, so that a module
 * which only makes text — and the test beside it — can import this and
 * nothing heavier. The language is English until something says otherwise,
 * which on a desk nothing does. Reading the stored choice and telling the
 * native side belong to `i18n/index.ts`.
 */
export const LANGUAGES = [
  { id: 'en', name: 'English', strings: en },
  { id: 'tr', name: 'Türkçe', strings: tr },
] as const satisfies readonly { id: string; name: string; strings: Strings }[];

export type Language = (typeof LANGUAGES)[number]['id'];

/** Chosen by hand in Settings, so there is one default and it is not the phone's. */
export const DEFAULT_LANGUAGE: Language = 'en';

/** The language a stored setting means; anything unreadable is the default. */
export function languageFrom(stored: string | null): Language {
  return LANGUAGES.find((language) => language.id === stored)?.id ?? DEFAULT_LANGUAGE;
}

export function stringsFor(language: Language): Strings {
  return (LANGUAGES.find((entry) => entry.id === language) ?? LANGUAGES[0]).strings;
}

/** The language in use. Set through `chooseLanguage`, or directly by a test. */
export const currentLanguage = createStore<Language>(DEFAULT_LANGUAGE);

/**
 * The table for the language in use, for code that is not a component.
 *
 * A component must not call this while drawing. It would get the right words
 * once and then keep them: nothing tells React that the answer has changed,
 * and the compiler is entitled to remember a result whose inputs it can see
 * did not. Components ask `useT()`, and hand the table on to any function
 * that needs it.
 */
export function strings(): Strings {
  return stringsFor(currentLanguage.get());
}
