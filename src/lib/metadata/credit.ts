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
const GUEST_AT_LARGE = /\s+(?:featuring|feat\.?|ft\.?)\s+(.+?)(?=\s+-\s+|\s*[([]|$)/gi;

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

/** Words that describe the upload, not the song. */
const PACKAGING = new Set([
  'official', 'video', 'audio', 'lyric', 'lyrics', 'visualizer', 'visualiser',
  'explicit', 'hd', 'hq', '4k', 'mv', 'release',
]);

/**
 * A title without the brackets that are about where the file came from.
 *
 * `(Official Video)`, `[Lyric Video]`, `(Explicit)`. A file saved from a video
 * keeps the video's name, and none of that is in any catalogue's title for the
 * song. Brackets that say something about the recording -- `(Long Version)`,
 * `(Live)`, `(Acoustic)` -- are kept, because those are a different recording
 * and the search should be for that one.
 */
export function withoutPackaging(title: string): string {
  const cleaned = title
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (group: string, inside: string) =>
      foldForMatch(inside)
        .split(' ')
        .some((word) => PACKAGING.has(word))
        ? ''
        : group
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || title;
}
