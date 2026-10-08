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
  const known = sorted.get(names);
  if (known && known.locale === locale) return known.targets;
  /*
    One collator for the whole sort, and the sort kept. `localeCompare` with
    a locale makes a collator of its own for every pair it is asked about,
    and on the phone that was most of a fifth of a second for a list this
    long -- spent by Settings each time it was drawn, to fill a sheet that
    is nearly always shut.
  */
  const collator = new Intl.Collator(locale);
  const targets = TARGETS.map((tag) => ({ tag, name: names[tag] ?? tag })).sort((a, b) =>
    collator.compare(a.name, b.name)
  );
  sorted.set(names, { locale, targets });
  return targets;
}

/** The last sort for each table of names, which is one per language the app has been in. */
const sorted = new WeakMap<object, { locale: string; targets: { tag: string; name: string }[] }>();

/** What is chosen. Set through `chooseLyricsTarget`; read by `useLyricsTarget`. */
export const currentTarget = createStore<string>(DEFAULT_TARGET);
