import { identifyLanguage } from './identify.ts';
import { translator } from './translateNative.ts';
import { readTranslation, writeTranslation, type StoredTranslation } from '../db/translations.ts';

/** What lyrics are put into unless something says otherwise. */
export const DEFAULT_TARGET = 'en';

/**
 * How much of the words the identifier is shown.
 *
 * It only needs a sample, and the first lines of a song are as representative
 * as the whole of it. Capping the sample also keeps a very long set of lyrics
 * from being handed across the bridge for a question about its language.
 */
const SAMPLE_LINES = 12;

export type TranslationOutcome =
  | { kind: 'translated'; lines: string[]; source: string | null }
  /** Already in the target language, so there is nothing to do. */
  | { kind: 'same-language'; language: string }
  /** No on-device model exists for what this is written in. */
  | { kind: 'unsupported'; language: string | null }
  | { kind: 'unavailable' }
  | { kind: 'failed'; message: string };

/**
 * Compares the part of a tag that names the language, ignoring the rest.
 *
 * The identifier answers with things like `zh-Latn` and `pt-BR`, while the
 * target is a plain `en`. Comparing the whole tag would make `en-US` a
 * different language from `en` and translate English into English.
 */
const sameLanguage = (a: string, b: string) =>
  a.split('-')[0]!.toLowerCase() === b.split('-')[0]!.toLowerCase();

/**
 * Translates lyrics into [target], keeping one line for every line given.
 *
 * Nothing is asked of the translator twice: a stored answer is returned as it
 * is. The line count is part of what makes a stored answer usable, which is
 * checked by the store itself.
 */
export async function translateLines(
  trackId: string,
  lines: string[],
  target: string = DEFAULT_TARGET
): Promise<TranslationOutcome> {
  const cached = readTranslation(trackId, target, lines.length);
  if (cached) return { kind: 'translated', lines: cached.lines, source: cached.source };

  // Absent in a development build made before the module existed. On a device
  // the engine was not built for it is present and simply answers no to
  // everything, which is a different case and handled below.
  if (!translator) return { kind: 'unavailable' };

  try {
    const sample = lines
      .filter((line) => line.trim().length > 0)
      .slice(0, SAMPLE_LINES)
      .join('\n');
    if (sample.length === 0) return { kind: 'unsupported', language: null };

    /*
      Worked out here rather than asked of the native module. ML Kit used to
      answer this, and it was the half of it that could go first: deciding what
      a set of lyrics is written in needs a table of letter trigrams, not a
      translation engine.
    */
    const source = identifyLanguage(sample);
    if (!source) return { kind: 'unsupported', language: null };
    if (sameLanguage(source, target)) return { kind: 'same-language', language: source };
    if (!(await translator.isSupportedAsync(source))) {
      return { kind: 'unsupported', language: source };
    }

    const translated = await translator.translateLinesAsync(lines, source, target);
    /*
      A translation is only usable line against line. The native side returns
      one for one, so a mismatch means something changed underneath — and a
      shorter list would silently pair the wrong words with the wrong moments
      rather than fail.
    */
    if (translated.length !== lines.length) {
      return { kind: 'failed', message: 'The translation did not line up.' };
    }

    const stored: StoredTranslation = { lines: translated, source };
    writeTranslation(trackId, target, stored, Date.now());
    return { kind: 'translated', lines: translated, source };
  } catch (error) {
    // Most often the model download: no connection, or not enough room for it.
    return {
      kind: 'failed',
      message: error instanceof Error ? error.message : 'Translation failed.',
    };
  }
}
