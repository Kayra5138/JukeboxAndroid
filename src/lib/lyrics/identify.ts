import { franc } from 'franc';

import { languageOf } from './languages.ts';

/**
 * What language a set of lyrics is written in.
 *
 * This used to be ML Kit's, and is the smaller half of what ML Kit was here
 * for: it only decides whether a set of lyrics needs translating and which
 * model to ask for. `franc` does the same job in a few hundred kilobytes of
 * JavaScript under a licence the rest of this can live with, by counting
 * letter trigrams — and for scripts used by one language, by recognising the
 * script outright, which is why Greek, Japanese and Thai are never in doubt.
 *
 * It is worse than what it replaces, and worst exactly where the languages are
 * closest: Danish read as Norwegian, Croatian as Bosnian, Estonian as Finnish.
 * The first two matter little — the models are near enough that the English
 * comes out much the same — and all of them need a sample to work on at all,
 * which is why the caller passes several lines rather than one.
 */

/** `franc`'s answer when the sample is too short or it cannot tell. */
const UNDETERMINED = 'und';

/**
 * The BCP-47 tag for [text], or null when it cannot be placed.
 *
 * Null covers three different disappointments — too little text, no guess, and
 * a guess in a language nothing here can translate — deliberately, because the
 * caller can do nothing different about any of them.
 */
export function identifyLanguage(text: string): string | null {
  const guess = franc(text);
  if (guess === UNDETERMINED) return null;
  return languageOf(guess, text);
}
