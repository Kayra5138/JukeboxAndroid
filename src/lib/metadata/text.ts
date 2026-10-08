/**
 * Turkish letters that have no decomposed form, so `NFD` alone leaves them
 * intact. Folding them keeps `Şımarık` comparable to `simarik`.
 */
const TURKISH_FOLD: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  ğ: 'g',
  Ğ: 'g',
  ş: 's',
  Ş: 's',
  ç: 'c',
  Ç: 'c',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u',
};

/**
 * Words that mark a *different* recording of the same song. A result carrying
 * one of these when the query does not is the wrong take, so they disqualify a
 * candidate rather than being ignored.
 *
 * A remix belongs here and a cover does not, which looks inconsistent until you
 * ask what year each one carries. A cover is the same composition played again,
 * so its genre and its era are the ones being looked up. A remix is a new
 * recording built from the old one and dated to when it was made — accepting
 * `Şımarık (Club Remix)` for `Şımarık` files a 1997 song under whatever year
 * the remix came out.
 */
export const VARIANT_MARKERS = new Set([
  'instrumental', 'karaoke', 'live', 'demo', 'reprise', 'sped', 'nightcore',
  'remix', 'extended', 'edit',
]);

/**
 * Scripts that do not put spaces between words, so a whole title arrives as one
 * token and word agreement has nothing to work with.
 */
const UNSPACED_SCRIPT = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}\p{sc=Thai}]/u;

/**
 * How much of the query's characters the candidate accounts for, below which
 * two strings sharing a character or two are not evidence of anything.
 */
const MIN_CHARACTER_AGREEMENT = 0.5;

/**
 * Words that say nothing about which recording this is. Dropping them stops
 * `Sonic theme` from being judged half-wrong against a result simply titled
 * `Sonic`.
 */
const NOISE = new Set([
  'the', 'a', 'an', 'and', 'of', 'feat', 'ft', 'featuring', 'with',
  // Apple appends provenance like `(From "Mirai Nikki")` to soundtrack entries,
  // and counting those words against the title would sink real matches.
  'from', 'motion', 'picture',
  'theme', 'song', 'songs', 'music', 'soundtrack', 'ost', 'audio',
  'official', 'video', 'lyrics', 'lyric', 'hd', 'hq', 'remastered',
  'version', 'original', 'mix', 'full',
  // A cover is a different recording of the same composition, and shares the
  // genre and year we are after, so the word should not block the match.
  'cover', 'covered', 'acoustic',
]);

/**
 * Fold to plain ASCII for comparison.
 *
 * Deliberately not `toLocaleLowerCase('tr-TR')`: under Turkish rules `INDIE`
 * lowercases to `ındıe`, which matches nothing. Turkish casing belongs in the
 * interface, never in a lookup key.
 */
/**
 * A label said one way, so that two spellings of it are one label.
 *
 * The form tags are stored in. Case is the only thing it takes away: somebody
 * typing `Rock`, `rock` or `ROCK` means one tag, and which of the three they
 * held shift for is not something worth keeping.
 *
 * Not {@link foldForMatch}, which strips diacritics as well — that is a key for
 * *finding* things, and `özgün müzik` filed as `ozgun muzik` is a tag nobody
 * typed. Not a plain `toLowerCase` either: the Turkish dotted capital
 * lower-cases to `i` followed by a combining dot above, so `ÖZGÜN MÜZİK` came
 * out as a string that matched nothing, including itself typed in lower case.
 * Mapping that letter first, then recomposing, keeps the accents and loses
 * only the case.
 *
 * `NFC` on the way in as well as out, because the same word typed on one
 * platform can arrive decomposed and compare unequal to itself composed.
 */
export function canonicalLabel(value: string): string {
  return value
    .normalize('NFC')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .normalize('NFC')
    .trim();
}

export function foldForMatch(value: string): string {
  return value
    .replace(/[ıİğĞşŞçÇöÖüÜ]/g, (char) => TURKISH_FOLD[char] ?? char)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    // Letters from any script, not just ASCII: a title like `Kyuusei Άργυρóϛ`
    // loses its distinguishing half if Greek is stripped, and then matches
    // whatever else shares the remaining word.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Meaningful, deduplicated words of a title or artist. */
export function tokens(value: string): string[] {
  return [...new Set(foldForMatch(value).split(' '))].filter(
    (word) => word.length > 1 && !NOISE.has(word)
  );
}

/** The string's characters, spaces removed, as overlapping pairs. */
function bigrams(value: string): string[] {
  const characters = [...foldForMatch(value).replace(/ /g, '')];
  return characters.slice(1).map((character, index) => characters[index]! + character);
}

/**
 * Agreement between two strings measured character by character.
 *
 * Pairs rather than single characters, because Han in particular reuses a small
 * set of very common characters and two unrelated titles will share several of
 * them. Two titles sharing the same pairs in the same order is a much rarer
 * accident.
 */
function characterAgreement(query: string, candidate: string): number {
  const wanted = bigrams(query);
  const have = new Set(bigrams(candidate));
  if (wanted.length === 0 || have.size === 0) return 0;
  const shared = wanted.filter((pair) => have.has(pair)).length;
  return (2 * shared) / (wanted.length + have.size);
}

/**
 * How well a catalogue entry answers `query`, from 0 to 1.
 *
 * Two things are measured, because they fail differently:
 *
 * - how much of the query the entry accounts for, and
 * - how much of the entry's *title* the query accounts for.
 *
 * The second matters because the artist frequently will not match and that is
 * fine. Yousei Teikoku is absent from Apple's catalogue, but their songs are
 * there as covers by other people — and a cover carries the genre and year
 * being looked up, so rejecting it over the artist name loses real information.
 * Requiring the titles to line up is what keeps that from becoming a licence to
 * match anything.
 *
 * Queries that reduce to a single word are refused outright. `Shakra song`
 * becomes just `shakra`, and the catalogue really does contain a dance track
 * called exactly that — so even an exact title match picks the wrong recording,
 * because a coincidental namesake looks identical to the real thing. A wrong
 * genre corrupts the statistics silently whereas a gap is visible, so one word
 * is never enough.
 *
 * That last rule has one exception, and it is a large one here: Japanese,
 * Chinese, Korean and Thai write without spaces, so 妖精帝國 is a single token
 * however many words it is, and the two-word rule refused every such title
 * outright — for a library that is mostly anime and game music, that is not a
 * corner case. Those go down a character-by-character path instead, which is
 * kept strictly separate rather than made to serve both: it is far more
 * permissive than word agreement, and letting Latin titles near it would undo
 * everything the paragraphs above are for.
 */
export function matchScore(
  query: string,
  candidate: { title: string; artist?: string | null; album?: string | null }
): number {
  const wanted = tokens(query);
  if (wanted.length < 2) {
    if (!UNSPACED_SCRIPT.test(query)) return 0;
    const agreement = characterAgreement(query, candidate.title);
    return agreement >= MIN_CHARACTER_AGREEMENT ? agreement : 0;
  }

  const haystack = new Set(
    tokens([candidate.title, candidate.artist, candidate.album].filter(Boolean).join(' '))
  );
  const hits = wanted.filter((word) => haystack.has(word));

  // Two independent words agreeing is the difference between a match and a
  // coincidence, and a match resting only on short words is usually the latter.
  if (hits.length < 2) return 0;
  if (!hits.some((word) => word.length >= 4)) return 0;

  const titleTokens = tokens(candidate.title);
  if (titleTokens.length === 0) return 0;

  // An instrumental or live take is a different recording; accept one only when
  // that is what was asked for.
  const wantsVariant = wanted.some((word) => VARIANT_MARKERS.has(word));
  const isVariant = titleTokens.some((word) => VARIANT_MARKERS.has(word));
  if (isVariant && !wantsVariant) return 0;

  const asked = new Set(wanted);
  const titleHits = titleTokens.filter((word) => asked.has(word));
  if (titleHits.length / titleTokens.length < 0.5) return 0;

  // The two agreeing words above are counted across title, artist and album
  // together, so the artist name alone can supply both of them — and then a
  // candidate titled `Teikoku` answers `Yousei Teikoku Filament` while sharing
  // nothing with `Filament`. The title has to say something the artist did not.
  //
  // A song named after the band it is by (`Iron Maiden` by Iron Maiden) is
  // still allowed through on the strength of agreeing in full, which is why the
  // demand is only made of one-word titles.
  const credited = new Set(tokens(candidate.artist ?? ''));
  if (titleHits.length === 0) return 0;
  if (titleHits.length === 1 && credited.has(titleHits[0]!)) return 0;

  return hits.length / wanted.length;
}

/**
 * The title as the song is actually called.
 *
 * Files are commonly named `Artist - Title`, and a tagger that fills in the
 * artist often leaves that whole string in the title as well — so the artist
 * appears twice and the title is not the song's name. Harmless when matching on
 * loose tokens, fatal to a lookup that compares titles exactly.
 *
 * Only a prefix that *is* the artist is removed. A title such as
 * `Hikaru Nara - TV Size` keeps its dash, because what follows the artist test
 * is not an artist.
 *
 * Every dash is tried, not just the first, because the artist's own name can
 * contain one: `AC - DC - Thunderstruck` splits in the wrong place if you stop
 * at the first separator and in the right one if you keep looking.
 */
export function bareTitle(title: string, artist: string | null): string {
  if (!artist) return title;

  for (let at = title.indexOf(' - '); at >= 0; at = title.indexOf(' - ', at + 1)) {
    if (foldForMatch(title.slice(0, at)) !== foldForMatch(artist)) continue;
    const rest = title.slice(at + 3).trim();
    return rest.length > 0 ? rest : title;
  }

  return title;
}

/**
 * What an uploader writes after a song's name to say what kind of upload it
 * is. None of it is the song's name, and none of it says the recording is a
 * different one — which is why `live` and `remix` are not here, and are kept.
 */
const UPLOAD_WORDS = new Set([
  'official', 'audio', 'video', 'music', 'lyric', 'lyrics', 'with', 'visualizer',
  'visualiser', 'hd', 'hq', '4k', 'mv', 'remaster', 'remastered', 'version',
  'album', 'full', 'explicit', 'clean',
]);

/** Whether [text] is nothing but such words, and years: `Official Audio`, `2011 Remaster`. */
function isUploadNote(text: string): boolean {
  const words = foldForMatch(text).split(' ').filter(Boolean);
  return (
    words.some((word) => UPLOAD_WORDS.has(word)) &&
    words.every((word) => UPLOAD_WORDS.has(word) || /^\d+$/.test(word))
  );
}

/**
 * A video's title without the notes about the upload: `Numb (Official Video)`,
 * `Numb [HD]`, `Numb (Remastered 2011)` and `Numb - Official Audio` are all
 * `Numb`.
 *
 * A bracket goes only when every word in it is such a note. `Numb (Live)` is
 * another recording, `Numb (Part II)` is another song and `Numb (feat. Jay-Z)`
 * is the song's own name, and each of them keeps its bracket; so does
 * `(Remastered Live)`, for the one word in it that matters.
 */
export function withoutUploadNotes(title: string): string {
  let bare = title.replace(/\s*[([]([^)\]]*)[)\]]/g, (whole: string, inside: string) =>
    isUploadNote(inside) ? '' : whole
  );
  // The same said after a dash or a bar, as often as it is said.
  for (;;) {
    const tail = /^(.*\S)\s+[-|–—]\s+([^-|–—]+)$/.exec(bare);
    if (!tail || !isUploadNote(tail[2]!)) break;
    bare = tail[1]!;
  }
  bare = bare.replace(/\s{2,}/g, ' ').trim();
  // A title that was nothing but a note is still a title.
  return bare || title;
}
