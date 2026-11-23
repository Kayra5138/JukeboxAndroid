import { foldForMatch } from './text.ts';

/**
 * Taking a credit apart into the artists in it.
 *
 * A file's artist is a line of text, and when more than one person is on the
 * record that line is all of them at once: `Eminem, Rihanna`,
 * `Eminem feat. Rihanna`, `Lena Raine & Minecraft`. Nothing downstream can use
 * that as it stands. A catalogue has no artist by that name, so a lookup for
 * it finds nothing; and counted as a name it is an artist of its own, so an
 * hour of Eminem with a guest is an hour Eminem is not credited with.
 *
 * The difficulty is that every mark that joins two artists also appears inside
 * the name of one. `Earth, Wind & Fire` is not three artists and
 * `Tyler, The Creator` is not two. No rule about commas tells those from
 * `Eminem, Rihanna`, because there is no difference to find in the text: the
 * difference is in the world. So this is a set of rules that are right most of
 * the time, a list of the famous exceptions, and a way to be told the answer
 * by something that knows -- see {@link Verdict}.
 */

/**
 * What is known about a credit from outside the text.
 *
 * `true` is one artist, however its name is punctuated. `false` is several,
 * which licenses splitting on marks that are otherwise left alone. `undefined`
 * is nobody having said, and the rules decide.
 */
export type Verdict = (credit: string) => boolean | undefined;

/**
 * Names that look like several artists and are one.
 *
 * Not a catalogue and not meant to be complete: these are the ones common
 * enough to turn up in somebody's library before anything has had the chance
 * to learn better. A name that is not here and is split wrongly is put right
 * the first time a lookup finds it whole in a catalogue.
 */
const ONE_ARTIST = new Set(
  [
    'Earth, Wind & Fire',
    'Simon & Garfunkel',
    'Tyler, The Creator',
    'Hall & Oates',
    'Daryl Hall & John Oates',
    'Crosby, Stills & Nash',
    'Crosby, Stills, Nash & Young',
    'Emerson, Lake & Palmer',
    'Blood, Sweat & Tears',
    'Peter, Paul and Mary',
    'Peter, Paul & Mary',
    'Dave Dee, Dozy, Beaky, Mick & Tich',
    'Above & Beyond',
    'Chase & Status',
    'Brooks & Dunn',
    'Sam & Dave',
    'Sonny & Cher',
    'Jan & Dean',
    'Chad & Jeremy',
    'Peaches & Herb',
    'Womack & Womack',
    'Ike & Tina Turner',
    'Captain & Tennille',
    'Seals & Crofts',
    'Loggins & Messina',
    'Belle & Sebastian',
    'Mumford & Sons',
    'Big & Rich',
    'Aly & AJ',
    'She & Him',
    'Matt & Kim',
    'Nico & Vinz',
    'Iron & Wine',
    'Years & Years',
    'Angels & Airwaves',
    'Angus & Julia Stone',
    'Smith & Thell',
    'Dimitri Vegas & Like Mike',
    'Chage & Aska',
    'Chloe x Halle',
    'AC/DC',
  ].map((name) => foldForMatch(name))
);

/** `feat.`, `ft.`, `featuring`, with or without the bracket in front of it. */
const FEATURING = /\s*[([]?\s*\b(?:featuring|feat|ft)\b\.?\s+/i;

/** The marks that always part two artists: a semicolon, a comma, a slash with room around it. */
const HARD = /\s*[;,]\s*|\s+\/\s+/;

/**
 * A slash with no room around it, which parts two artists only sometimes.
 *
 * `Logan Mader/Jamie Christopherson` is two people and `AC/DC` is not, and the
 * only thing in the text that says so is that the first has a whole name, with
 * a space in it, on both sides.
 */
function atTightSlash(piece: string): string[] {
  const sides = piece.split('/');
  return sides.length > 1 && sides.every((side) => /\S\s+\S/.test(side)) ? sides : [piece];
}

/**
 * The marks that part two artists more often than not.
 *
 * An ampersand, a lower-case `x` standing alone, and `vs`. Each is also how
 * some duo spells its own name, which is what the list above and the verdict
 * are for. `and` is left out on purpose: it is in the middle of far more band
 * names than collaborations.
 */
const SOFT = /\s+&\s+|\s+x\s+|\s+vs\.?\s+/;

/** `& the Machine`, `& the Wailers`: a band and its name, never a guest. */
const AND_THE = /\s+(?:&|and|\+)\s+the\s+/i;

/**
 * A name without the half of a bracket that splitting left on it.
 *
 * Only the half: `Rihanna)` loses its bracket because the other one went with
 * `(feat.`, and `Konami (Michiru Yamane)` keeps both because they are a pair.
 */
function tidy(name: string): string {
  let out = name.trim();
  const count = (marks: string) => [...out].filter((char) => marks.includes(char)).length;
  if (/[)\]]$/.test(out) && count(')]') > count('([')) out = out.slice(0, -1);
  if (/^[([]/.test(out) && count('([') > count(')]')) out = out.slice(1);
  return out.trim();
}

function isOne(name: string, verdict: Verdict | undefined): boolean | undefined {
  const said = verdict?.(name);
  if (said !== undefined) return said;
  return ONE_ARTIST.has(foldForMatch(name)) ? true : undefined;
}

/** One piece between commas, taken apart at the softer marks if it should be. */
function soften(piece: string, verdict: Verdict | undefined): string[] {
  const known = isOne(piece, verdict);
  if (known === true) return [piece];
  // Somebody's backing band is part of their name unless something that knows
  // has said the credit is several people.
  if (known !== false && AND_THE.test(piece)) return [piece];
  return piece.split(SOFT);
}

/**
 * The artists in a credit, in the order they are written, each once.
 *
 * The first is the one the record is filed under. The spelling kept is the
 * first one met, so `Taku Iwasaki, LotusJuice, Taku Iwasaki` -- which is what
 * a downloader writes when it copies a list out of a page three times -- is
 * two artists and not three.
 */
export function splitCredit(credit: string | null | undefined, verdict?: Verdict): string[] {
  const whole = (credit ?? '').trim();
  if (!whole) return [];
  if (isOne(whole, verdict) === true) return [whole];

  const names: string[] = [];
  for (const side of whole.split(FEATURING)) {
    const billed = tidy(side);
    if (!billed) continue;
    if (isOne(billed, verdict) === true) {
      names.push(billed);
      continue;
    }
    for (const between of billed.split(HARD)) {
      for (const piece of atTightSlash(between)) {
        for (const name of soften(tidy(piece), verdict)) names.push(tidy(name));
      }
    }
  }

  const seen = new Set<string>();
  return names.filter((name) => {
    const key = foldForMatch(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** `(feat. Rihanna)`, `[ft. Dido]`, `(with Halsey)`: a guest named in brackets. */
const GUEST_IN_BRACKETS = /\s*[([]\s*(?:featuring|feat\.?|ft\.?|with)\s+([^)\]]+)[)\]]/gi;

/** `ft. Rihanna` on the end of a title, up to whatever comes after it. */
const GUEST_AT_LARGE = /\s+(?:featuring\s+|feat\.\s*|ft\.\s*|feat\s+|ft\s+)(.+?)(?=\s+-\s+|\s*[([]|$)/gi;

/**
 * A title without the guests named in it, and who they were.
 *
 * `Love The Way You Lie ft. Rihanna` is called `Love The Way You Lie`. The
 * rest is a credit that ended up in the wrong field, and a catalogue asked for
 * the whole of it as a title has no such song.
 */
export function featuredIn(title: string): { title: string; featured: string[] } {
  const featured: string[] = [];
  const take = (_match: string, names: string) => {
    featured.push(...splitCredit(names));
    return '';
  };
  const bare = title.replace(GUEST_IN_BRACKETS, take).replace(GUEST_AT_LARGE, take);
  const cleaned = bare.replace(/\s{2,}/g, ' ').trim();
  // A title that was nothing but a guest list is left as it was: an empty
  // title is worse to search for than an untidy one.
  return cleaned ? { title: cleaned, featured } : { title, featured: [] };
}

/**
 * Only the guests a title names outright, for counting rather than searching.
 *
 * Stricter than {@link featuredIn}, which also takes `(with Halsey)`: read
 * wrongly, that costs a search nothing, but `(with strings)` counted as an
 * artist called Strings is a mistake somebody would see on their own top ten.
 */
export function guestsNamedIn(title: string | null | undefined): string[] {
  const guests: string[] = [];
  for (const pattern of [/[([]\s*(?:featuring|feat\.?|ft\.?)\s+([^)\]]+)[)\]]/gi, GUEST_AT_LARGE]) {
    for (const match of (title ?? '').matchAll(pattern)) guests.push(...splitCredit(match[1]));
  }
  return guests;
}

/**
 * Words that describe the upload, not the song: what a video's title adds to
 * say what kind of video it is. In the languages the uploads in a library are
 * likely to be in, since `Clip Officiel` and `Resmi Video` say what
 * `Official Video` says.
 */
const PACKAGING = new Set([
  'official', 'officiel', 'officielle', 'oficial', 'ufficiale', 'offiziell', 'offizielles', 'resmi',
  'video', 'videoclip', 'clip', 'klip', 'musikvideo', 'audio', 'visualizer', 'visualiser',
  'lyric', 'lyrics', 'letra', 'paroles', 'testo', 'sozleri', 'songtext',
  'explicit', 'uncensored', 'clean', 'hd', 'hq', '4k', '1080p', '720p', 'mv', 'pv',
  'release', 'premiere', 'remaster', 'remastered', 'musicvideo',
  // Subtitles, in the words an upload says them in: `[Eng Sub]`, `[Legendado]`, `[Türkçe Çeviri]`.
  'sub', 'subs', 'subbed', 'subtitle', 'subtitles', 'subtitulado', 'subtitulada', 'legendado', 'legenda',
  'vietsub', 'engsub', 'vostfr', 'ceviri', 'romaji',
  // The channels that put their own name in brackets on every upload.
  'monstercat', 'ncs', 'nocopyrightsounds',
  // Only alongside the words above: `Music Video`, `Official Music Video`,
  // `Audio Only`, `Official Animated Video`, `4K Upgrade`, `Color Coded Lyrics`.
  'music', 'with', 'full', 'song', 'sarki', 'new', 'only', 'animated', 'performance', 'upgrade', 'color',
  'colour', 'coded', 'eng', 'english', 'rom', 'kan', 'kanji', 'japanese', 'turkce', 'espanol', 'spanish',
  'portugues', 'francais', 'deutsch', 'and',
]);

/** Of those, the ones that say "upload" on their own; the rest only count beside one of these. */
const STRONG = new Set([
  'official', 'officiel', 'officielle', 'oficial', 'ufficiale', 'offiziell', 'offizielles', 'resmi',
  'video', 'videoclip', 'clip', 'klip', 'musikvideo', 'audio', 'visualizer', 'visualiser',
  'lyric', 'lyrics', 'letra', 'paroles', 'testo', 'sozleri', 'songtext',
  'explicit', 'uncensored', 'hd', 'hq', '4k', '1080p', '720p', 'mv', 'pv', 'release', 'premiere',
  'remaster', 'remastered', 'musicvideo',
  'sub', 'subs', 'subbed', 'subtitle', 'subtitles', 'subtitulado', 'subtitulada', 'legendado', 'legenda',
  'vietsub', 'engsub', 'vostfr', 'ceviri', 'romaji',
]);

/** The word for a song, which a song's own name ends in as often as an upload's note begins with it. */
const SONG = new Set(['song', 'sarki']);

/** Words that say the video has subtitles, which end a title as `Official Video` does: `… English subtitles`. */
const SUBTITLED = new Set(['sub', 'subs', 'subbed', 'subtitle', 'subtitles', 'legendado', 'vietsub', 'engsub', 'ceviri', 'vostfr']);

/**
 * The languages a note lists its lyrics in: `[Kan/Rom/Eng]`. Two or more of
 * these and nothing else is a note about the subtitles, however it is
 * written.
 */
const LANGUAGES = new Set(['eng', 'english', 'rom', 'romaji', 'kan', 'kanji', 'jp', 'jpn', 'japanese', 'kor', 'hangul', 'esp', 'espanol', 'tr', 'turkce']);

/**
 * A note in Japanese about the upload: `歌詞付き` (with lyrics), `公式`
 * (official), `フル` (full), what a video is the opening or ending theme of —
 * `TVアニメ『葬送のフリーレン』オープニングテーマ` — or `MV` in the brackets
 * Japanese uploads use. Words run together in Japanese, so these are matched
 * as text and not counted word by word.
 */
const JAPANESE_NOTE =
  /^(?:公式|歌詞付き?|フル(?:バージョン|ver\.?)?|full ?ver(?:sion|\.)?|mv|pv|music ?video|ミュージック ?ビデオ|ミュージックビデオ|lyric ?video|オフィシャル.*)$|(?:アニメ|劇場版|映画|ドラマ|ゲーム|tv).*(?:主題歌|オープニング|エンディング|テーマ|挿入歌|\bop\b|\bed\b)|(?:主題歌|オープニング ?テーマ|エンディング ?テーマ|挿入歌|op ?テーマ|ed ?テーマ)/i;

/**
 * Words that say the recording is another one, and stay when the rest of a
 * note goes: `(Official Live Video)` is still the live recording.
 */
const RECORDING = new Set(['live', 'acoustic', 'remix', 'instrumental', 'karaoke', 'demo', 'extended', 'unplugged', 'cover']);

/**
 * What a note about the upload leaves behind: nothing, or the words in it
 * about the recording. Null where it is not such a note at all: `(Long
 * Version)`, `(TV Size)`, `(feat. Jay-Z)`, `(Part II)`.
 */
function afterNote(text: string): string | null {
  if (JAPANESE_NOTE.test(text.trim())) return '';
  // `M/V` is `MV`, and a word of its own; folded apart it would be two letters that say nothing.
  const words = foldForMatch(text.replace(/\bm\s*\/\s*v\b/gi, 'mv')).split(' ').filter(Boolean);
  if (words.length >= 2 && words.every((word) => LANGUAGES.has(word))) return '';
  if (!words.some((word) => STRONG.has(word))) return null;
  const kept: string[] = [];
  for (const word of words) {
    if (PACKAGING.has(word) || /^\d{4}$/.test(word)) continue;
    if (RECORDING.has(word)) kept.push(word);
    // A word that is neither: a name, a place, an event. The note is not only
    // about the upload, and is left whole rather than guessed at.
    else return null;
  }
  return kept.join(' ');
}

/**
 * A title with everything in brackets taken out: `The Line (from the series
 * Arcane League of Legends)` is `The Line`. For telling whether a video is the
 * song, where a catalogue's provenance and a video's own note are written two
 * ways and neither is the song's name. A title that was nothing but brackets
 * is left as it was.
 */
export function withoutBrackets(title: string): string {
  const bare = title.replace(/\s*(?:\([^)]*\)|\[[^\]]*\]|【[^】]*】|（[^）]*）)/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return bare || title;
}

/** Brackets a video's title puts notes in, ordinary and full-width. */
const BRACKETED = /\s*(?:\(([^)]*)\)|\[([^\]]*)\]|【([^】]*)】|（([^）]*)）|［([^］]*)］|「([^」]*)」|『([^』]*)』|＜([^＞]*)＞|〈([^〉]*)〉|《([^》]*)》)/g;

/** How many brackets {@link BRACKETED} knows, which is how many of its groups a match carries. */
const BRACKET_KINDS = 10;

/**
 * A title without what is about where the file came from.
 *
 * `(Official Video)`, `[Lyric Video]`, `(Explicit)`, `【MV】`, and the same said
 * after a dash or a bar — `Numb - Official Audio`, `Numb | Lyrics` — or simply
 * at the end, `Numb Official Music Video`. A file saved from a video keeps the
 * video's name, and none of that is in any catalogue's title for the song.
 *
 * What says something about the recording is kept, because that is another
 * recording and the search should be for it: `(Long Version)`, `(Live)` and
 * `(Acoustic)` stay, and `(Official Live Video)` becomes `(Live)`. A note with
 * a word in it that is neither — `(Official Video – Sanremo 2021)` — is left
 * whole: better an untidy search than a name taken for packaging.
 */
export function withoutPackaging(title: string): string {
  let cleaned = title
    // `M/V` is `MV`.
    .replace(/\bm\s*\/\s*v\b/gi, 'MV')
    // Japanese brackets are written against what is outside them, `「chase」MUSIC VIDEO`; spaced, the words outside are words.
    .replace(/([」』】）］＞〉》])(?=\S)/g, '$1 ')
    .replace(/(?<=\S)([「『【（［＜〈《])/g, ' $1')
    // What a video is the theme of, in front: `＜ノラガミARAGOTO＞OPテーマ THE ORAL CIGARETTES「狂乱 Hey Kids!!」`.
    .replace(/^\s*[＜〈《【\[(（][^＞〉》】\])）]*[＞〉》】\])）]\s*(?:op|ed|オープニング|エンディング)?\s*(?:テーマ|主題歌|挿入歌)\s*/i, '')
    .replace(BRACKETED, (group: string, ...inside: (string | undefined)[]) => {
    const text = inside.slice(0, BRACKET_KINDS).find((part) => part !== undefined) ?? '';
    const left = afterNote(text);
    if (left === null) return group;
    return left ? ` (${left.replace(/\b\w/g, (first) => first.toUpperCase())})` : '';
  });
  // The same said after a dash or a bar, as often as it is said.
  for (;;) {
    // A full-width slash or bar sets a note off with no spaces round it: `Official Video／TVアニメ…`.
    const tail = /^(.*\S)(?:\s+[-|–—/]+\s+|\s*[／｜]\s*)([^-|–—/／｜]+)$/.exec(cleaned);
    if (!tail) break;
    const left = afterNote(tail[2]!);
    if (left !== '') break;
    cleaned = tail[1]!;
  }
  // And at the end with nothing to set it off; or just before what is left in
  // brackets at the end, which says something about the recording and stays:
  // `Ashley's Song with lyrics (Super Smash Bros. Version)`.
  const kept = /^(.*?\S)((?:\s*\([^)]*\))+)\s*$/.exec(cleaned);
  cleaned = kept ? `${withoutTrailingNote(kept[1]!)}${kept[2]!}` : withoutTrailingNote(cleaned);
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s+[-|–—/]+\s*$/, '').trim();
  return cleaned || title;
}

/**
 * [text] without a note about the upload at its end, set off by nothing:
 * only a run of such words that has a strong one in it, so that a song called
 * `Video Games` or one whose last word is `Music` keeps its name.
 */
function withoutTrailingNote(text: string): string {
  const words = text.split(/\s+/);
  let cut = words.length;
  while (cut > 1 && PACKAGING.has(foldForMatch(words[cut - 1]!))) cut -= 1;
  // `Song` at the front of such a run is far more often the song's own name than the upload's: `Ashley's Song with lyrics`.
  while (cut < words.length && SONG.has(foldForMatch(words[cut]!))) cut += 1;
  const run = words.slice(cut).map((word) => foldForMatch(word));
  const saysUpload = (word: string) => word === 'official' || word === 'resmi' || word === 'lyrics' || word === 'video' || SUBTITLED.has(word);
  if (
    (run.length >= 2 && run.some((word) => STRONG.has(word)) && run.some(saysUpload)) ||
    // A word that is nothing else: `…「狂乱 Hey Kids!!」MusicVideo`.
    (run.length === 1 && (run[0] === 'musicvideo' || run[0] === 'mv'))
  ) {
    return words.slice(0, cut).join(' ');
  }
  return text;
}
