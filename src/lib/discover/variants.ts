import { looseTitle } from '../album/rest.ts';
import { splitCredit } from '../metadata/credit.ts';
import { bareTitle, foldForMatch, VARIANT_MARKERS, withoutUploadNotes } from '../metadata/text.ts';

/**
 * Telling a song from another recording of it, for a list of songs to go and
 * find.
 *
 * A catalogue built from what people played holds every form a song was ever
 * played in: the album cut, the same cut remastered, the concert, the karaoke
 * track off the single's B-side, the ninety seconds an anime opened with. Two
 * things go wrong if they are all taken as songs. Somebody who has `Numb` is
 * offered `Numb (2011 Remaster)`, which is the thing they have; and somebody
 * who has never heard the band is offered `Numb (Live in Texas)`, which is
 * not where anybody would choose to start.
 *
 * So there are two readings here. A note that only says how a recording was
 * issued — remastered, the album version, an official video — is taken off,
 * and what is left is the song and is compared as the song. A note that says
 * the recording is a different one makes it a different one, and it is not
 * suggested.
 */

/**
 * Words that make a recording another take wherever in the title they stand.
 *
 * Nobody calls a song `Karaoke`. These are safe to believe without a bracket
 * round them, and have to be, because half of them are written without one:
 * `Xtreme Vibes off vocal`.
 */
const ANYWHERE = new Set(['instrumental', 'karaoke', 'nightcore', 'remix', 'remixed', 'acapella']);

/**
 * Words that only mean it in a note: inside a bracket, or after a dash.
 *
 * `Live and Let Die` is a song and `Let Die (Live)` is a concert. The app's
 * own list of such words is the start of it, and the rest are the ones a
 * catalogue of listens is full of and a search for one named song never met.
 */
const IN_A_NOTE = new Set([
  ...VARIANT_MARKERS,
  'acoustic', 'cover', 'unplugged', 'session', 'sessions', 'rehearsal', 'bootleg', 'concert',
  'mix', 'dub', 'medley', 'commentary', 'interview', 'skit', 'slowed', 'reverb', 'inst',
  'rework', 'reworked', 'reconstruction', 'alternate', 'outtake',
  'interlude', 'intro', 'outro',
]);

/**
 * `version` and `edition`, which say another take unless everything said with
 * them is only how the same take was issued.
 *
 * `Numb (Album Version)` and `Numb (2011 Remastered Version)` are the song.
 * `Ribs (Let's Have a Sleepover version)`, `Kiss It Better (Kaytranada
 * edition)` and `Running with the Wolves (WolfWalkers Version)` are something
 * made out of it, and each of those was offered as the song before this was
 * read. One exception by name: a `(Taylor's Version)` is the recording its
 * artist means people to hear.
 */
const ISSUE_WORDS = new Set(['version', 'edition', 'ver']);
const PLAIN_ISSUE = new Set([
  'album', 'single', 'original', 'studio', 'explicit', 'clean', 'mono', 'stereo', 'deluxe', 'bonus',
  'track', 'remaster', 'remastered', 'the', 'lp', 'ep', 'full', 'standard', 'taylor', 's',
]);

function issuedOtherwise(words: string[]): boolean {
  return (
    words.some((word) => ISSUE_WORDS.has(word)) &&
    !words.every((word) => ISSUE_WORDS.has(word) || PLAIN_ISSUE.has(word) || /^\d+$/.test(word))
  );
}

/**
 * The same said in two words, or in Japanese, where a word is not something a
 * space ends.
 *
 * Folded here the way a title is folded before it is searched, and not
 * written out folded: folding takes the voicing marks off kana along with
 * every other accent, so `サイズ` is looked for as `サイス`, and a pattern
 * typed by hand with the marks on never matched anything.
 *
 * The second list is believed only in a note, for what the folding costs:
 * with its mark gone `ライブ`, a concert, is `ライフ`, a life, and there are
 * songs called that.
 */
const phrases = (list: string[]) =>
  new RegExp(list.map((phrase) => foldForMatch(phrase).replace(/ /g, ' ?')).join('|'));
const PHRASES = phrases([
  'sped up', 'speed up', 'off vocal', 'tv size', 'tv edit', 'anime size', 'game size', 'short ver',
  'a cappella', 'vocal only', 'カラオケ', 'オフボーカル',
]);
const NOTE_PHRASES = phrases(['インスト', 'ライブ', 'tv サイズ', 'アニメ サイズ', 'ゲーム サイズ']);

/** Titles that are the whole of what a track is and none of a song's name. */
const WHOLE_TITLE = new Set(['intro', 'outro', 'interlude', 'skit', 'prelude', 'untitled']);

/** A day written out, which in a title is the night of a concert: `(2003-07-03 Belfort)`. */
const A_DATE = /\b(19|20)\d{2}\s?[-‐‑./]\s?\d{1,2}\s?[-‐‑./]\s?\d{1,2}\b/;

/** Where a title stops being the song's name and starts being a note about it. */
const NOTE_STARTS = /[([（【「『〜~]|\s[-–—]\s|\s-(?=\S)/;

/**
 * What kind of other take a title says it is, or null for the song itself.
 *
 * The word is returned and not only the fact, so that whoever asked can say
 * why something was left out — and so that a test can.
 */
export function anotherTake(title: string): string | null {
  const whole = foldForMatch(title);
  // A track called nothing but what it is for: the forty seconds before the first song.
  if (WHOLE_TITLE.has(whole)) return whole;
  const phrase = PHRASES.exec(whole);
  if (phrase) return phrase[0];
  for (const word of whole.split(' ')) if (ANYWHERE.has(word)) return word;

  const at = title.search(NOTE_STARTS);
  // A title that begins with a bracket is a name in brackets, not a note.
  if (at <= 0) return null;
  const note = title.slice(at);
  if (A_DATE.test(note)) return 'live';
  const said = NOTE_PHRASES.exec(foldForMatch(note));
  if (said) return said[0];
  for (const word of foldForMatch(note).split(' ')) if (IN_A_NOTE.has(word)) return word;
  // Each bracket on its own: `(feat. X) (Album Version)` is one plain note and one name.
  for (const part of note.split(/[()[\]（）【】]|\s[-–—]\s/)) {
    if (issuedOtherwise(foldForMatch(part).split(' ').filter(Boolean))) return 'version';
  }
  return null;
}

/** Records that are, as a whole, another take of what is on them. */
const A_CONCERT = /(^| )(live (at|in|from|on) |in concert|unplugged|mtv unplugged)|( live)$/;
const A_COLLECTION_OF_TAKES = phrases(['remixes', 'remixed', 'instrumentals', 'karaoke', 'カラオケ', 'off vocal']);

/**
 * Whether the record a recording is on says what its title does not.
 *
 * `Only You` on `Roseland NYC Live` is a concert recording with nothing in
 * its own name to say so. The record's name is read more warily than a
 * title, because a record can be called anything: `Live Through This` is a
 * studio album. So `live` counts where it ends the name or is followed by
 * where — `Live at Leeds`, `Live in Tokyo` — and not otherwise.
 */
export function recordOfTakes(release: string | null | undefined): boolean {
  if (!release) return false;
  const name = foldForMatch(release);
  return A_CONCERT.test(name) || A_COLLECTION_OF_TAKES.test(name);
}

/** A record named for the night it was taped: `2022-06-10: Primavera Sound Festival, Barcelona, Spain`. */
const DATED = /^\s*(19|20)\d{2}\s?[-‐‑./]\s?\d{1,2}\s?[-‐‑./]\s?\d{1,2}\b/;
const LEFTOVERS = phrases([
  'demo', 'demos', 'unreleased', 'outtakes', 'rarities', 'bootleg', 'like a version', 'cast recording',
  'b sides', 'b side', 'sessions', 'session', 'radio broadcast', 'broadcast', 'interview', 'interviews',
  'commentary', 'tribute',
]);

/**
 * What is wrong with the record a recording is on, as a word, or null.
 *
 * For recordings that come from a catalogue of everything anybody played,
 * where the title is clean and the record is the giveaway. Each of these was
 * on a list: `Cruel Summer` off `2022-06-10: Primavera Sound Festival`,
 * `Across the Universe` off `Across the Universe (triple j Like A Version)`,
 * `Oooh Baby` off `Demo & Unreleased`, and a song with no record at all, which
 * is somebody's upload under a famous name.
 *
 * Not asked of a record a shop sells: there the shop has already said what
 * the track is, in the track's own bracket.
 */
export function doubtfulRecord(release: string | null | undefined): string | null {
  if (!release || !release.trim()) return 'no record';
  if (DATED.test(release)) return 'dated';
  if (recordOfTakes(release)) return 'takes';
  const folded = foldForMatch(release);
  const said = new RegExp(`(^| )(${LEFTOVERS.source})( |$)`).exec(folded);
  return said ? said[2]! : null;
}

/** Genres that say a recording is not music: somebody talking. */
const TALK = new Set(['interview', 'spoken word', 'audiobook', 'comedy', 'stand-up', 'speech', 'audio drama', 'radio play']);

export function isTalk(tags: readonly string[]): boolean {
  return tags.some((tag) => TALK.has(tag.toLowerCase()));
}

/**
 * Names the catalogue files a recording under when it does not know who made
 * it: `[unknown]`, `[no artist]`, `<information not found>`. None is somebody
 * whose songs can be gone and found.
 */
export function isNobody(artist: string): boolean {
  return /^\s*[\[<]/.test(artist);
}

/**
 * The song's name as it would be said: without the artist in front of it and
 * without the notes about how this copy was issued.
 *
 * This is what a suggestion is shown as and searched for by. `Numb (2011
 * Remaster)` is found on YouTube as `Numb`, and asking for the remaster by
 * name finds a worse upload of the same thing or nothing.
 */
export function plainTitle(title: string, artist: string | null): string {
  return withoutUploadNotes(bareTitle(title, artist)).trim() || title;
}

/** The name a credit is filed under: the first one written in it. */
export function leadArtist(credit: string | null | undefined): string {
  return splitCredit(credit)[0] ?? (credit ?? '').trim();
}

/**
 * One key for every spelling of one song by one artist.
 *
 * The artist is the first name of the credit, because the guests are what two
 * catalogues disagree about: `supercell` here and `supercell feat. 初音ミク`
 * there. The title is read the way the rest of an album is matched against the
 * library — a bracket is dropped unless it says the take is another one — so
 * `Numb`, `Numb [2011 Remaster]` and `Numb (feat. Jay-Z)` are one key and
 * `Numb (Live)` is its own.
 *
 * That last part is deliberate in both directions. Somebody who has only the
 * concert recording does not have the song as it was made, and may be offered
 * it; and the concert recording they have is never offered to them again.
 */
export function looseSongKey(song: { title: string; artist?: string | null }): string {
  const artist = song.artist ?? '';
  return `${foldForMatch(leadArtist(artist))}|${looseTitle(plainTitle(song.title, artist || null))}`;
}

const FEATURING_TAIL = /\s(feat|ft|featuring)\s.*$/;
const NOTE_TAIL =
  /(\s(\d{4}\s)?(remaster|remastered|version|mono|stereo|official|audio|video|lyric|lyrics|hd|hq|explicit|clean)(\s\d{4})?)+$/;

/**
 * The nearest thing to {@link looseSongKey} that can be made from a key that
 * was folded already.
 *
 * The songs to keep away from arrive as a set of `artist|title` folds, with
 * the brackets gone and nothing to say where they were. What can still be
 * seen in one is a trailing `feat …` and a trailing run of the words that only
 * describe an issue, and with those off `numb 2011 remaster` and `numb` meet.
 * It errs toward leaving a key alone: anything else at the end of a title
 * might be the title.
 */
export function loosenFolded(key: string): string {
  const bar = key.indexOf('|');
  if (bar < 0) return key;
  const title = key.slice(bar + 1);
  const loose = title.replace(FEATURING_TAIL, '').replace(NOTE_TAIL, '').trim();
  return `${key.slice(0, bar)}|${loose || title}`;
}

const GUESTS = /\s(feat|ft|featuring|with|and|vs|x)\s.*$/;

/**
 * A folded `artist|title` key with the artist cut down to the first name of
 * the credit, as near as a fold lets that be told.
 *
 * Two catalogues credit one song two ways — `Halsey` in one and `Halsey feat.
 * SUGA` in the other — and a song turned away under the first must not come
 * back under the second. Only ever compared with a key cut the same way, so
 * a band with `and` in its name is cut on both sides alike.
 */
export function leadOfFolded(key: string): string {
  const bar = key.indexOf('|');
  if (bar < 0) return key;
  const loose = loosenFolded(key);
  const artist = key.slice(0, bar).replace(GUESTS, '').trim() || key.slice(0, bar);
  return `${artist}|${loose.slice(loose.indexOf('|') + 1)}`;
}

/**
 * How long a song can be and still be one.
 *
 * Under a minute and a quarter it is an intro, a jingle, a spoken track off a
 * drama CD or the cut a programme opened with. Over ten minutes it is a
 * medley, a DJ set or a whole side of a record, and a list of things to try
 * is the wrong place for it.
 */
export function isSongLength(seconds: number | null | undefined): boolean {
  return seconds == null || (seconds >= 75 && seconds <= 600);
}
