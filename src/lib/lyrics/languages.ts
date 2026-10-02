/**
 * The languages lyrics can be read out of, and what the identifier calls them.
 *
 * Two naming schemes have to meet here. The translator names a language the way
 * Mozilla's catalogue does — a BCP-47 tag like `tr`, or `zh-Hans` where the
 * script matters. `franc`, which is what now decides what a set of lyrics is
 * written in, answers in ISO 639-3, and prefers the individual language to the
 * macrolanguage: Estonian comes back as `ekk` rather than `est`, Arabic as
 * `arb`, Albanian as `als`. There is no rule that turns one into the other, so
 * the correspondence is written out.
 *
 * Only languages that can be both identified and translated are listed. Basque
 * and Icelandic have models but are not in `franc`'s repertoire at all, so
 * lyrics in them are reported as unrecognised rather than guessed at — which is
 * what happens anyway, less obviously, since the nearest thing `franc` has to
 * Icelandic is Norwegian.
 */
export const LANGUAGE_OF_GUESS: Readonly<Record<string, string>> = {
  afr: 'af',
  als: 'sq',
  arb: 'ar',
  ben: 'bn',
  bos: 'bs',
  bul: 'bg',
  cat: 'ca',
  ces: 'cs',
  cmn: 'zh-Hans',
  dan: 'da',
  deu: 'de',
  ekk: 'et',
  ell: 'el',
  fin: 'fi',
  fra: 'fr',
  glg: 'gl',
  guj: 'gu',
  heb: 'he',
  hin: 'hi',
  hrv: 'hr',
  hun: 'hu',
  ind: 'id',
  ita: 'it',
  jpn: 'ja',
  kan: 'kn',
  kor: 'ko',
  lit: 'lt',
  lvs: 'lv',
  mal: 'ml',
  mar: 'mr',
  nld: 'nl',
  nob: 'nb',
  pes: 'fa',
  pol: 'pl',
  por: 'pt',
  ron: 'ro',
  rus: 'ru',
  slk: 'sk',
  slv: 'sl',
  spa: 'es',
  srp: 'sr',
  swe: 'sv',
  tam: 'ta',
  tel: 'te',
  tha: 'th',
  tur: 'tr',
  ukr: 'uk',
  urd: 'ur',
  vie: 'vi',
  zlm: 'ms',
  eng: 'en',
};

/**
 * Characters that only ever appear in traditional Chinese.
 *
 * `franc` identifies Chinese by its script and answers `cmn` for all of it,
 * which leaves the two writing systems indistinguishable — and there is a
 * separate model for each. Rather than guess, look for a handful of very
 * common characters that simplification changed: any one of them settles it,
 * and their absence from a set of lyrics of any length means simplified. These
 * are the frequent ones, so the sample does not have to be long.
 */
const TRADITIONAL_ONLY = /[個們這時說來國學會灣還過點發當機對開關體萬車東買賣愛歲頭麼誰經濟語邊變]/u;

/**
 * The tag for a guess, or null when nothing here can translate it.
 *
 * Splitting the two Chinese scripts is the only place the written form matters,
 * so it is the only place the text itself is consulted rather than the guess.
 */
export function languageOf(guess: string, text: string): string | null {
  const tag = LANGUAGE_OF_GUESS[guess];
  if (!tag) return null;
  if (tag === 'zh-Hans' && TRADITIONAL_ONLY.test(text)) return 'zh-Hant';
  return tag;
}
