import { identifyLanguage } from './identify.ts';

/**
 * Which lines of a song are in which language.
 *
 * A song is not always in one. A Japanese single with an English hook is the
 * ordinary case, and asking what language "the lyrics" are in gets one answer
 * for both halves: whichever came first decided, and the other half was put
 * through a model for a language it was not written in. What comes out of that
 * is not a bad translation, it is words that were never in the song.
 *
 * The identifier cannot be asked line by line either. It counts letter
 * trigrams and a line of lyrics has a dozen of them; it needs a verse. What a
 * single line does say for certain is which *writing* it is in, and that is
 * enough to sort on: the lines are dealt into piles by script, and each pile
 * is then long enough to be asked about as a whole.
 *
 * Two languages in the same letters — a chorus in Spanish over verses in
 * English — still come out as one pile and one answer. Nothing short of a
 * real identifier per line separates those, and a wrong split there would be
 * worse than none.
 */

type Script = 'latin' | 'cjk' | 'hangul' | 'cyrillic' | 'greek' | 'arabic' | 'hebrew' | 'thai' | 'indic';

/**
 * Written out as ranges rather than as `\p{Script=…}`: these are the scripts
 * the models cover, and a range is read the same by every engine this runs on.
 */
const SCRIPTS: readonly [Script, RegExp][] = [
  // Kana and the ideographs together. A line of a Japanese song with no kana
  // in it is still Japanese, and only its neighbours can say so.
  ['cjk', /[぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/gu],
  ['hangul', /[ᄀ-ᇿ㄰-㆏가-힯]/gu],
  ['cyrillic', /[Ѐ-ԯ]/gu],
  ['greek', /[Ͱ-Ͽἀ-῿]/gu],
  ['arabic', /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/gu],
  ['hebrew', /[֐-׿]/gu],
  ['thai', /[฀-๿]/gu],
  ['indic', /[ऀ-ൿ]/gu],
  ['latin', /[A-Za-zÀ-ɏḀ-ỿ]/gu],
];

/**
 * The writing a line is in, or null for a line with no letters at all.
 *
 * Any other script outranks Latin however little of it there is: `愛してる
 * baby` is a Japanese line with an English word in it, and the model for
 * Japanese carries the English word across untouched, where the reverse would
 * drop the half that needed translating.
 *
 * With how many letters it has, which is what the piles are weighed by.
 */
function measure(line: string): { script: Script; letters: number } | null {
  let best: Script | null = null;
  let most = 0;
  let letters = 0;
  for (const [script, pattern] of SCRIPTS) {
    const count = line.match(pattern)?.length ?? 0;
    if (count === 0) continue;
    letters += count;
    // Latin is last in the table, so by now anything else has been counted.
    if (script !== 'latin' && count > most) {
      best = script;
      most = count;
    }
    if (script === 'latin' && !best) best = 'latin';
  }
  return best ? { script: best, letters } : null;
}

/**
 * How much of a song a second language has to be before it is believed.
 *
 * The pile most of the song is in is asked about whatever its size, as the
 * whole song always was. A smaller pile is a different matter: `oh baby` and
 * `la la la` are a pile of their own in a Japanese song, the identifier will
 * name *some* language for them, and acting on that fetches thirty megabytes
 * of Dutch to translate two words of English. Under this many letters a
 * second language is left as it was sung.
 */
const MINOR_LETTERS = 120;

/**
 * The scripts that name their language, near enough, without being counted.
 *
 * Nothing is guessed about a line of kana or hangul, so a short pile of one is
 * as good as a long one and the floor above is not applied to it. The scripts
 * left out are the ones several languages share.
 */
const TELLING: ReadonlySet<Script> = new Set<Script>(['cjk', 'hangul', 'greek', 'hebrew', 'thai']);

/**
 * Japanese written in Latin letters.
 *
 * Common enough to matter, since a great many catalogues carry the romanised
 * words rather than the original, and worse than unsupported: the identifier
 * sees Latin letters with vowels after every consonant and names Indonesian or
 * Swahili with some confidence, a model for it exists, and what comes back is
 * fluent nonsense. There is no model that reads romaji, so the honest answer
 * is that these cannot be translated as they are.
 *
 * Told by two things together. Nearly every word is built only out of the
 * syllables Japanese has, which Italian and Indonesian fail on within a line
 * or two; and the small words Japanese cannot do without are there, which is
 * what keeps Hawaiian and a chorus of `la la la` out.
 */
const SYLLABLE =
  '(?:(?:ky|gy|sh|ch|ny|hy|by|py|my|ry|ts|[kgsztdnhbpmyrwfj])?[aeiouāīūēō]|n(?![aeiouy])|(?:kk|ss|tt|pp|tch|ssh|tts)(?=[aeiouyhs]))';
const ROMAJI_WORD = new RegExp(`^(?:${SYLLABLE})+$`, 'u');
const ROMAJI_PARTICLES = new Set([
  'wa', 'ga', 'wo', 'ni', 'no', 'de', 'mo', 'to', 'kara', 'made', 'yo', 'ne',
  'kimi', 'boku', 'watashi', 'anata', 'nai', 'desu', 'koto', 'dake', 'sono', 'kono',
]);

/**
 * Not all of them, because a romanised song has its English hook in the same
 * letters and so in the same pile. English fits about one word in five and
 * Indonesian, the nearest thing to a false alarm, a little over half.
 */
const ROMAJI_SHARE = 0.75;

export function looksLikeRomaji(text: string): boolean {
  const words = text.toLowerCase().match(/[a-zāīūēō']+/gu) ?? [];
  if (words.length < 8) return false;

  let fitting = 0;
  const particles = new Set<string>();
  for (const word of words) {
    const bare = word.replace(/'/g, '');
    if (ROMAJI_WORD.test(bare)) fitting += 1;
    if (ROMAJI_PARTICLES.has(bare)) particles.add(bare);
  }
  return fitting / words.length >= ROMAJI_SHARE && particles.size >= 3;
}

/**
 * Whether [text] is Japanese as it is written, which is to say has kana in it.
 *
 * Kana rather than ideographs, because those are Chinese as well and kana is
 * nothing else. A song of any length has some.
 */
export function isWrittenJapanese(text: string): boolean {
  return (text.match(/[\u3040-\u30ff]/gu)?.length ?? 0) >= 8;
}

/** What `ja-Latn` is called here: recognised, and not something a model reads. */
export const ROMAJI = 'ja-Latn';

export type Segment = {
  /**
   * The BCP-47 tag the lines are written in, or null when the identifier
   * could not say or nothing here can translate it.
   */
  language: string | null;
  /** Positions in the lines that were given, in order. */
  indexes: number[];
};

/**
 * The lines of a song sorted by what they are written in, largest pile first.
 *
 * Lines with no letters — blank ones, `♪`, a row of dots — belong to no pile
 * and are in none of the answers.
 */
export function segmentsOf(lines: string[]): Segment[] {
  const piles = new Map<Script, { indexes: number[]; letters: number }>();
  lines.forEach((line, index) => {
    const measured = measure(line);
    if (!measured) return;
    const pile = piles.get(measured.script) ?? { indexes: [], letters: 0 };
    pile.indexes.push(index);
    pile.letters += measured.letters;
    piles.set(measured.script, pile);
  });

  const ordered = [...piles.entries()].sort((a, b) => b[1].letters - a[1].letters);
  return ordered.map(([script, pile], place) => {
    if (place > 0 && pile.letters < MINOR_LETTERS && !TELLING.has(script)) {
      return { language: null, indexes: pile.indexes };
    }

    const text = pile.indexes.map((index) => lines[index]).join('\n');
    if (script === 'latin' && looksLikeRomaji(text)) return { language: ROMAJI, indexes: pile.indexes };
    return { language: identifyLanguage(text), indexes: pile.indexes };
  });
}
