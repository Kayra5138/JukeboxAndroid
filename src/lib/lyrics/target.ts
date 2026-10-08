import { LANGUAGE_OF_GUESS } from './languages.ts';
import { createStore } from '../ui/store.ts';

/**
 * The language lyrics are put into.
 *
 * English unless Settings says otherwise. Every model the translator has goes
 * between English and one other language, so English is the one target that
 * takes a single step; anything else is reached through it — the words into
 * English with one model and out of it with a second — which is slower, needs
 * the second model downloaded, and loses a little twice. The setting says so
 * under the picker rather than hiding the choice.
 */
export const DEFAULT_TARGET = 'en';

/**
 * What can be chosen: the languages there is a model for.
 *
 * The same list as the ones lyrics can be read out of. That table is keyed by
 * what the identifier calls a language and several of its keys can share a
 * tag, hence the set.
 */
export const TARGETS: readonly string[] = [...new Set(Object.values(LANGUAGE_OF_GUESS))];

/** The target a stored setting means. One there is no longer a model for is no choice. */
export function targetFrom(stored: string | null): string {
  return stored !== null && TARGETS.includes(stored) ? stored : DEFAULT_TARGET;
}

/**
 * The targets with their names, in the order a reader of [locale] would look
 * for them.
 *
 * [names] is the `languages` section of the table for the language the app is
 * in, so the list is Almanca, Arapça… in Turkish and Afrikaans, Albanian… in
 * English. A tag nobody has named is shown as the tag, at the end of the
 * letters it starts with, rather than left out.
 */
export function namedTargets(
  names: Readonly<Record<string, string>>,
  locale: string
): { tag: string; name: string }[] {
  return TARGETS.map((tag) => ({ tag, name: names[tag] ?? tag })).sort((a, b) =>
    a.name.localeCompare(b.name, locale)
  );
}

/** What is chosen. Set through `chooseLyricsTarget`; read by `useLyricsTarget`. */
export const currentTarget = createStore<string>(DEFAULT_TARGET);
