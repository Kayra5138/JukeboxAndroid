import { featuredIn, splitCredit, withoutPackaging } from './credit.ts';
import { bareTitle, foldForMatch } from './text.ts';
import type { Track } from '../types.ts';

/**
 * Works out who performs a track and what it is called.
 *
 * The media store leaves the artist empty for untagged files and puts the whole
 * filename in the title, so `Yousei Teikoku - Gothic Lolita Agitator` is usually
 * the only place an artist name exists at all.
 *
 * When there is no artist to compare against, the first ` - ` is taken as the
 * separator and there is no way to do better: an artist whose own name contains
 * a dash will be cut in the wrong place, and nothing in the filename says so.
 *
 * `artist` is the credit as it is written, and is what gets saved. `artists`
 * is the same credit taken apart, with anybody the title names as a guest on
 * the end, and is what gets searched for: no catalogue has an artist called
 * `Eminem, Rihanna`, and every one of them has Eminem. `title` has had the
 * guests and the upload's own labels taken out of it for the same reason.
 */
export type Identity = {
  artist: string | null;
  artists: string[];
  title: string;
  query: string;
};

/** A genre or a channel in brackets at the front: `[DnB] - Feint - Snake Eyes`. */
const LABEL_IN_FRONT = /^\s*\[[^\]]*\]\s+-\s+/;

/** The title as a catalogue would have it, and whoever it names as a guest. */
function cleaned(title: string): { title: string; featured: string[] } {
  return featuredIn(withoutPackaging(title));
}

/** One list from a credit and a title's guests, each artist once. */
function together(credit: string | null, featured: string[]): string[] {
  const seen = new Set<string>();
  return [...splitCredit(credit), ...featured].filter((name) => {
    const key = foldForMatch(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Writing that is not the Latin alphabet's: Japanese, Chinese, Korean. */
const EAST_ASIAN = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]/u;

/** Letters of the Latin alphabet. */
const LATIN = /\p{sc=Latin}/u;

/**
 * Who a credit names, where one name is written twice, in its own writing and
 * in Latin letters: `米津玄師 Kenshi Yonezu`, `キタニタツヤ Tatsuya Kitani`.
 * Both, the original first; a catalogue knows one or the other. A credit
 * written once is taken apart as any other.
 */
function namesIn(credit: string | null, featured: string[]): string[] {
  if (credit && EAST_ASIAN.test(credit) && LATIN.test(credit)) {
    const own = credit.replace(/[\p{sc=Latin}][\p{sc=Latin}\s.'’,&-]*/gu, ' ').replace(/\s{2,}/g, ' ').trim();
    const latin = credit.replace(/[^\p{sc=Latin}\s.'’,&-]+/gu, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s,&-]+|[\s,&-]+$/g, '').trim();
    if (own && latin) return together(null, [...splitCredit(own), ...splitCredit(latin), ...featured]);
  }
  return together(credit, featured);
}

/** One reading of a name: who, and what it is called. */
function reading(artist: string | null, rawTitle: string): Identity {
  const { title, featured } = cleaned(rawTitle);
  const artists = namesIn(artist, featured);
  return { artist, artists, title, query: `${artists[0] ?? artist ?? ''} ${title}`.trim() };
}

/**
 * The same song's name given twice in one title, in two writings:
 * `Hologram (ホログラム)`, `ルル (RuLe)`, `Kyomu Densen - 凶夢伝染`. Each
 * half, the first first.
 */
function twoNames(title: string): string[] {
  const pair = /^(.+?)\s*[(（]([^)）]+)[)）]\s*$/.exec(title.trim()) ?? /^(.+?)\s+[-–—]\s+(.+)$/.exec(title.trim());
  if (!pair) return [];
  const [outside, inside] = [pair[1]!.trim(), pair[2]!.trim()];
  const writing = (text: string) => (EAST_ASIAN.test(text) ? 'east' : LATIN.test(text) ? 'latin' : 'other');
  return writing(outside) !== writing(inside) && writing(inside) !== 'other' ? [outside, inside] : [];
}

/** Each reading once, by what it would be searched for. */
function distinct(all: Identity[]): Identity[] {
  const seen = new Set<string>();
  return all.filter((one) => {
    const key = foldForMatch(`${one.artists[0] ?? one.artist ?? ''} ${one.title}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Every way a track's name can be read as who and what, the likeliest first.
 *
 * A name written `Artist - Title` has one reading, and is all most libraries
 * hold. A Japanese upload is named as its uploader likes, and the forms are
 * many: `【Ado】ルル`, `YOASOBI「勇者」`, `和楽器バンド / 千本桜` — or the
 * other way round, `青のすみか / キタニタツヤ`, since a title before its
 * singer is just as usual there — and often the same name again in Latin
 * letters after it. None of those has a ` - ` to cut at, so the whole of it
 * was taken for the title of a song by nobody, and no catalogue found it.
 * Where the form leaves the order in doubt, both orders are readings, and
 * whichever a catalogue knows is the one.
 */
export function readings(track: Track): Identity[] {
  if (track.artist) {
    // The same tagger that filled the artist in usually left `Artist - Title`
    // sitting in the title as well, and a catalogue reads that literally: a
    // search for `Ai Higuchi - Akuma no Ko` by Ai Higuchi finds nothing at all.
    const bare = bareTitle(track.title, track.artist);
    const first = reading(track.artist, bare);
    return distinct([first, ...twoNames(first.title).map((title) => reading(track.artist, title))]);
  }

  // The upload's notes off first, wherever they are: `[Official Video] ALI PROJECT - …` names ALI PROJECT.
  const named = withoutPackaging(track.title.replace(LABEL_IN_FRONT, ''));
  const found: Identity[] = [];

  // `【Ado】ルル (RuLe)`: the singer in thick brackets in front.
  const lenticular = /^【([^】]+)】\s*(.+)$/.exec(named);
  if (lenticular) {
    const artist = lenticular[1]!.trim();
    const title = lenticular[2]!.trim();
    found.push(reading(artist, title), ...twoNames(cleaned(title).title).map((name) => reading(artist, name)));
  }

  // `YOASOBI 「勇者」`, `美波「アメヲマツ、」`: the singer, then the song in corner brackets; or the song first, `『Lemon』 - Kenshi Yonezu`.
  const quoted = /^(.*?)\s*[「『]([^」』]+)[」』]\s*(.*)$/.exec(named);
  if (quoted && !lenticular) {
    const before = quoted[1]!.trim();
    const song = quoted[2]!.trim();
    const after = quoted[3]!.trim();
    if (before) {
      found.push(reading(before, song));
      // `緑黄色社会『花になって』 Official Video / Ryokuoushoku Shakai – Be a flower`: the same again in Latin letters after it.
      const rest = after.replace(/^(?:(?:official|music|lyric|video|audio|mv|pv)\s*)+/i, '').replace(/^[\s/／|｜]+/, '');
      const again = /^(.+?)\s+[-–—]\s+(.+)$/.exec(rest);
      if (again) found.push(reading(again[1]!.trim(), again[2]!.trim()));
    } else {
      const by = /^[-–—]\s*(.+?)(?:\s+[-–—]\s+.*)?$/.exec(after);
      found.push(reading(by ? by[1]!.trim() : null, song));
    }
  }

  // The usual `Artist - Title`, or the same with a slash or a long dash where there is no short one.
  // Not where the song was found in corner brackets: what is left round them is the singer, and notes.
  const cut = quoted
    ? undefined
    : [' - ', ' – ', ' — ', ' / ', ' ／ '].map((mark) => ({ mark, at: named.indexOf(mark) })).find((one) => one.at >= 0);
  if (cut) {
    const left = named.slice(0, cut.at).trim();
    const right = named.slice(cut.at + cut.mark.length).trim();
    const slashed = cut.mark.includes('/') || cut.mark.includes('／');
    // `青のすみか / キタニタツヤ - Where Our Blue Is / Tatsuya Kitani`: title and singer, twice over, each pair slashed.
    const pairs = !slashed && / [/／] /.test(left) && / [/／] /.test(right);
    if (pairs) {
      const [title, singer] = left.split(/ [/／] /).map((part) => part.trim());
      const [latinTitle, latinSinger] = right.split(/ [/／] /).map((part) => part.trim());
      found.push(reading(singer!, title!), reading(latinSinger!, latinTitle!));
    } else {
      found.push(reading(left, right), ...twoNames(cleaned(right).title).map((title) => reading(left, title)));
      // A slash leaves the order in doubt: `和楽器バンド / 千本桜` is singer first, `青のすみか / キタニタツヤ` title first.
      if (slashed) found.push(reading(right, left));
      // `アイナ・ジ・エンド 革命道中 - On The Way`: a singer and a song in their own writing before the dash, and the song again after it.
      if (EAST_ASIAN.test(left) && !LATIN.test(left) && !EAST_ASIAN.test(right) && / /.test(left)) {
        const space = left.indexOf(' ');
        found.push(reading(left.slice(0, space), left.slice(space + 1)), reading(left.slice(0, space), right));
      }
    }
  }

  if (found.length === 0) found.push(reading(null, named));
  return distinct(found).slice(0, MOST_READINGS);
}

/** How many readings of one name are tried at most: each is a search or two of every catalogue. */
const MOST_READINGS = 4;

/**
 * The likeliest reading of a track's name.
 *
 * A name with not a letter or a digit in it -- `???`, `♪`, a dash, nothing
 * at all -- has no reading worth searching for, and {@link readings} gives
 * it none. It is still the track's name, and whatever asks what the track is
 * called is answered with it as it stands. Left to the empty list, the answer
 * was nothing, and the library's search for copies of a song, which asks this
 * of every track, threw on opening for anybody with such a file.
 */
export function identify(track: Track): Identity {
  return readings(track)[0] ?? reading(track.artist, track.title ?? '');
}
