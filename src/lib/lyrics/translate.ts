import { fetchLyricsVersions, type Lyrics } from './lrclib.ts';
import { parseLrc } from './lrc.ts';
import { partnersByOrder, partnersByTime } from './partners.ts';
import { isWrittenJapanese, ROMAJI, segmentsOf } from './segments.ts';
import { DEFAULT_TARGET } from './target.ts';
import { translator } from './translateNative.ts';
import { readTranslation, writeTranslation, type StoredTranslation } from '../db/translations.ts';
import { findTrack } from '../media/library.ts';
import { withMetadata } from '../media/merge.ts';

/** What lyrics are put into unless something says otherwise; see `target.ts`. */
export { DEFAULT_TARGET };

export type TranslationOutcome =
  | { kind: 'translated'; lines: string[]; source: string | null }
  /** Already in the target language, so there is nothing to do. */
  | { kind: 'same-language'; language: string }
  /** No on-device model exists for what this is written in. */
  | { kind: 'unsupported'; language: string | null }
  | { kind: 'unavailable' }
  /**
   * [message] is whatever the phone said went wrong, in the phone's own words,
   * and null where it said nothing; a translation that came back the wrong
   * length is [misaligned] instead. The wording of both is the screen's.
   */
  | { kind: 'failed'; misaligned: boolean; message: string | null };

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
 * Whether there are models to take [source] into [target].
 *
 * Asked of the pair where the build can answer for one: a language that can
 * be read is not thereby one that can be put into anything, since all but
 * English is reached through English and needs a second model to exist. A
 * build from before lyrics could go anywhere but English is asked what it
 * always was, which for English is the same question.
 */
async function canRead(source: string, target: string): Promise<boolean> {
  if (!translator) return false;
  return (await translator.isPairSupportedAsync?.(source, target)) ?? translator.isSupportedAsync(source);
}

/**
 * Puts [lines] through the models, part by part, and answers one for one.
 *
 * Nothing here is stored or looked up: this is the translating alone, so that
 * it can be asked of the words on screen and of another entry's words alike.
 */
async function throughModels(lines: string[], target: string): Promise<TranslationOutcome> {
  if (!translator) return { kind: 'unavailable' };

  /*
    Worked out here rather than asked of the native module, and worked out
    for each part of the song rather than once for all of it: see
    `segmentsOf`. A song half in Japanese and half in English used to be
    whichever its first dozen lines were, all the way through.
  */
  const known = segmentsOf(lines).filter((segment) => segment.language != null);
  if (known.length === 0) return { kind: 'unsupported', language: null };

  const foreign = known.filter((segment) => !sameLanguage(segment.language!, target));
  if (foreign.length === 0) return { kind: 'same-language', language: known[0]!.language! };

  const readable = [];
  for (const segment of foreign) {
    // Romanised Japanese is recognised so that it is not mistaken for a
    // language that does have a model. It has none of its own.
    if (segment.language === ROMAJI) continue;
    if (await canRead(segment.language!, target)) readable.push(segment);
  }
  if (readable.length === 0) return { kind: 'unsupported', language: foreign[0]!.language };

  /*
    One line for every line given, with nothing against the lines that needed
    nothing: the ones already in the target language, and the ones nobody
    could place. An empty entry is drawn as no translation at all, which is
    what those lines have.
  */
  const translated = lines.map(() => '');
  for (const segment of readable) {
    const answered = await translator.translateLinesAsync(
      segment.indexes.map((index) => lines[index]!),
      segment.language!,
      target
    );
    /*
      A translation is only usable line against line. The native side returns
      one for one, so a mismatch means something changed underneath — and a
      shorter list would silently pair the wrong words with the wrong moments
      rather than fail.
    */
    if (answered.length !== segment.indexes.length) {
      return { kind: 'failed', misaligned: true, message: null };
    }
    segment.indexes.forEach((index, place) => {
      translated[index] = answered[place]!;
    });
  }

  return {
    kind: 'translated',
    lines: translated,
    source: readable.map((segment) => segment.language).join('+'),
  };
}

/**
 * Tracks whose romanised words had no counterpart to be found, this run of
 * the app. The search is two requests and its answer does not change between
 * one play and the next; without this a song left on repeat with translation
 * on would ask every time round.
 */
const noOriginal = new Set<string>();

/**
 * The same song as it was written, laid against the romanised lines on
 * screen, or null when the catalogue has no such entry or it does not fit.
 */
async function originalFor(
  trackId: string,
  lines: string[],
  times: number[] | null
): Promise<string[] | null> {
  if (noOriginal.has(trackId)) return null;

  const file = await findTrack(trackId);
  const track = file ? withMetadata([file])[0] : null;
  if (!track) return null;

  const versions = await fetchLyricsVersions({
    title: track.title,
    artist: track.artist,
    album: track.album,
    durationSec: track.durationSec,
  });

  const paired = (version: Lyrics): string[] | null => {
    if (!isWrittenJapanese(version.synced ?? version.plain ?? '')) return null;
    if (times && version.synced) return partnersByTime(lines, times, parseLrc(version.synced));
    // Plain against plain, or timed against plain: order is all there is.
    const theirs = version.synced
      ? parseLrc(version.synced).map((line) => line.text)
      : (version.plain ?? '').split(/\r?\n/);
    return partnersByOrder(lines, theirs);
  };

  for (const version of versions) {
    const partners = paired(version);
    if (partners) return partners;
  }
  noOriginal.add(trackId);
  return null;
}

/**
 * Translates lyrics into [target], keeping one line for every line given.
 *
 * Nothing is asked of the translator twice: a stored answer is returned as it
 * is. The line count is part of what makes a stored answer usable, which is
 * checked by the store itself.
 *
 * @param times When each line is sung, in seconds, for lyrics that are timed.
 *   Only used to find the same lines in another entry of the song.
 */
export async function translateLines(
  trackId: string,
  lines: string[],
  target: string = DEFAULT_TARGET,
  times: number[] | null = null
): Promise<TranslationOutcome> {
  const cached = readTranslation(trackId, target, lines.length);
  if (cached) return { kind: 'translated', lines: cached.lines, source: cached.source };

  try {
    let outcome = await throughModels(lines, target);

    /*
      Romanised Japanese has no model, and very often has a twin: the same
      catalogue holding the same recording as it was written. That one can be
      translated, and each of its lines belongs under the romanised line for
      the same moment. Failing to find it, or to reach the catalogue at all,
      leaves the answer as it was — these words cannot be translated — rather
      than turning it into an error about a search nobody asked for.
    */
    if (outcome.kind === 'unsupported' && outcome.language === ROMAJI) {
      const original = await originalFor(trackId, lines, times).catch(() => null);
      if (original) {
        const viaOriginal = await throughModels(original, target);
        if (viaOriginal.kind === 'translated') outcome = viaOriginal;
      }
    }

    if (outcome.kind === 'translated') {
      const stored: StoredTranslation = { lines: outcome.lines, source: outcome.source };
      writeTranslation(trackId, target, stored, Date.now());
    }
    return outcome;
  } catch (error) {
    // Most often the model download: no connection, or not enough room for it.
    return {
      kind: 'failed',
      misaligned: false,
      message: error instanceof Error ? error.message : null,
    };
  }
}
