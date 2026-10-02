import { canonicalLabel } from '../metadata/text.ts';
import type { Album } from './albums.ts';
import type { EnrichedTrack } from './enriched.ts';

/**
 * The three questions anybody actually asks of a library: what is it called,
 * when did it get here, and when did I last want it.
 *
 * Stored under these words rather than as a position in a list. The setting
 * outlives every rearrangement of the list, and a stored `1` would quietly
 * become a different order the day a fourth question is worth asking.
 */
export type SortOrder = 'name' | 'added' | 'played';

export const SORT_ORDERS = ['name', 'added', 'played'] as const;

/**
 * Alphabetical for anything the setting does not recognise, which covers both a
 * library that has never been sorted and one whose stored order belongs to a
 * version of this that no longer exists.
 */
export function asSortOrder(value: string | null): SortOrder {
  return SORT_ORDERS.find((order) => order === value) ?? 'name';
}

/** The order a tap lands on, wrapping round. */
export function nextSort(order: SortOrder): SortOrder {
  return SORT_ORDERS[(SORT_ORDERS.indexOf(order) + 1) % SORT_ORDERS.length]!;
}

/**
 * The alphabet, as Turkish reads it.
 *
 * Written out rather than handed to `localeCompare`, for the same reason the
 * dates in `format/date.ts` are written out: left to itself the comparison
 * takes its order from whatever locale the phone is set to, and a Turkish
 * collection on a phone in English files `ısı` among the i's and `öz` among the
 * o's — which is not a near miss but the wrong half of the alphabet. Intl on
 * React Native's engine has never been something to lean on either. The order a
 * library is read in is a choice this app makes, not one it inherits.
 *
 * `q`, `w` and `x` are not Turkish letters at all, but a shelf carrying anime
 * and game music is full of them, so they keep the places the rest of the Latin
 * world gives them.
 */
const ALPHABET = 'abcçdefgğhıijklmnoöpqrsştuüvwxyz';

const RANKS = new Map([...ALPHABET].map((letter, at) => [letter, at]));

/** Where the alphabet begins, clear of every ASCII character that is not one. */
const LETTER = 0x80;

/** Where the scripts this has no opinion about begin, clear of the alphabet. */
const ELSEWHERE = LETTER + ALPHABET.length;

/**
 * Where one character sits, in three bands: space, digits and punctuation in
 * their own ASCII order; then the alphabet; then everything written in a script
 * the alphabet says nothing about, by code point, so that at least it is stable.
 *
 * Folding to ASCII first — what {@link foldForMatch} does — would have been
 * shorter and is exactly wrong here. That fold exists to *find* things and
 * throws away the letters Turkish orders by: `ı` before `i`, `ö` after `o`, `ş`
 * after `s`. Put a library through it and `Şımarık` files itself between `Si-`
 * and `Sj-`, which is where a Turkish reader will never look for it.
 */
function rankOf(character: string): number {
  const known = RANKS.get(character);
  if (known != null) return LETTER + known;

  // A letter the alphabet does not have but recognises underneath: `é` is an
  // `e` wearing something. Filing it past `z` would put Beyoncé at the end of
  // the library, so it is ranked as the letter it is built on and its accent is
  // simply not something the ordering notices — which, for a letter Turkish has
  // no opinion about, is the right amount of attention to pay it.
  const bare = character.normalize('NFD')[0]!;
  const beneath = bare === character ? undefined : RANKS.get(bare);
  if (beneath != null) return LETTER + beneath;

  const code = character.codePointAt(0)!;
  return code < LETTER ? code : ELSEWHERE + code;
}

/** Two names already put through {@link canonicalLabel}. */
function compareFolded(left: string, right: string): number {
  const ours = [...left];
  const theirs = [...right];
  const shared = Math.min(ours.length, theirs.length);

  for (let at = 0; at < shared; at += 1) {
    const order = rankOf(ours[at]!) - rankOf(theirs[at]!);
    if (order !== 0) return order;
  }

  // The shorter of two names that agree as far as they go comes first, so
  // `Kar` precedes `Karanlık`.
  return ours.length - theirs.length;
}

/**
 * Two names in the order a Turkish reader expects them.
 *
 * Case is taken off with {@link canonicalLabel} rather than with a plain
 * `toLowerCase`, and rather than with `foldForMatch`. It is the one of the two
 * folds that keeps the letters and loses only the case, and it is already what
 * the app uses to decide that two spellings of a tag are one tag — so a library
 * ordered by it agrees with a library grouped by it, which two different folds
 * would not guarantee. The dotted capital is the reason it exists: `İ` lowered
 * by the engine's own rules becomes `i` with a combining dot, a character the
 * alphabet above has never heard of.
 */
export function compareNames(left: string, right: string): number {
  return compareFolded(canonicalLabel(left), canonicalLabel(right));
}

/**
 * One row, with everything it will be compared by worked out in advance.
 *
 * Folded once here rather than inside the comparison, which a sort of a few
 * thousand tracks would otherwise reach some tens of thousands of times — and
 * `canonicalLabel` normalises twice per call.
 */
type Ranked<T> = {
  item: T;
  /** Milliseconds since the epoch, or null where nothing can be said. */
  at: number | null;
  /** Folded, most significant first; every row in a list carries as many. */
  names: string[];
};

/**
 * A row nothing can be dated goes after every row that can.
 *
 * Not to the beginning of time, which is what treating a missing date as zero
 * would do. A track the media store will not date is not a track added in 1970,
 * and one never played is not one played longest ago: it has no place on the
 * scale at all. Sending it to the end says so, and leaves it among its own kind
 * in alphabetical order, which is the only order left that means anything.
 */
function byDate(left: Ranked<unknown>, right: Ranked<unknown>, order: SortOrder): number {
  if (order === 'name') return 0;
  if (left.at == null || right.at == null) {
    return (left.at == null ? 1 : 0) - (right.at == null ? 1 : 0);
  }
  // Newest first, always. Both dates are asked about to find what is recent —
  // nobody opens a library wondering which track they have ignored the longest.
  return right.at - left.at;
}

/**
 * The names a row carries, in order, until one of them decides it.
 *
 * The last of them is unique within the list, and that is not decoration. Two
 * tracks really are called the same thing — a studio take and a live one, the
 * same song on two records — and without a tiebreaker that cannot end in a draw
 * their order is whatever the engine's sort happened to do this time, which
 * moves rows under the reader's finger between one visit to the screen and the
 * next.
 */
function byName(left: Ranked<unknown>, right: Ranked<unknown>): number {
  for (let at = 0; at < left.names.length; at += 1) {
    const order = compareFolded(left.names[at]!, right.names[at]!);
    if (order !== 0) return order;
  }
  return 0;
}

function arrange<T>(entries: Ranked<T>[], order: SortOrder): T[] {
  entries.sort((left, right) => byDate(left, right, order) || byName(left, right));
  return entries.map((entry) => entry.item);
}

/**
 * The most recent of a set of dates, or null when none of them is one.
 *
 * What a record's own date is made of — see {@link sortAlbums}.
 */
function latestOf(dates: (number | null)[]): number | null {
  let newest: number | null = null;
  for (const at of dates) {
    if (at != null && (newest == null || at > newest)) newest = at;
  }
  return newest;
}

/**
 * The library in the order asked for. A copy: the list handed in is the one the
 * search returned, and unsorted callers still hold it.
 *
 * Alphabetically means by title, not by artist — which is a departure from the
 * order the media store hands the library over in, and deliberate. The title is
 * the first line of a row and the word the eye is scanning for; somebody asking
 * for A to Z and getting artists has to know who a song is by before they can
 * find it, which is the thing they were looking it up to remember.
 *
 * @param lastPlayed when each track was last listened to, keyed by track id.
 *   Passed in rather than read here, so the ordering can be exercised without
 *   the listening history behind it.
 */
export function sortTracks(
  tracks: readonly EnrichedTrack[],
  order: SortOrder,
  lastPlayed: ReadonlyMap<string, number>
): EnrichedTrack[] {
  return arrange(
    tracks.map((track) => ({
      item: track,
      at: order === 'played' ? (lastPlayed.get(track.id) ?? null) : (track.addedAt ?? null),
      names: [canonicalLabel(track.title), canonicalLabel(track.artist ?? ''), track.id],
    })),
    order
  );
}

/**
 * The same three questions asked of records, where two of them have no answer
 * of their own.
 *
 * A record is not a file, so nothing added it; and nobody listens to a record,
 * they listen to its tracks. Both are therefore taken from the tracks, and by
 * the same rule — the most recent — which is what keeps the two consistent: a
 * record stands wherever its strongest-answering track stands.
 *
 * The most recent rather than the earliest, and for `added` that is the whole
 * decision. A record arrives over time: a track at a time out of a download, or
 * one that was missing filled in months later. Dating the record by its first
 * track leaves a record that gained something yesterday sitting exactly where it
 * was, which hides the only new thing on the shelf in the very view built to
 * show what is new.
 *
 * Alphabetically means by the record's name, then by whoever it is by — the
 * same rule as for tracks, the name on the first line of the row.
 */
export function sortAlbums(
  albums: readonly Album[],
  order: SortOrder,
  lastPlayed: ReadonlyMap<string, number>
): Album[] {
  return arrange(
    albums.map((album) => ({
      item: album,
      at: latestOf(
        album.tracks.map((track) =>
          order === 'played' ? (lastPlayed.get(track.id) ?? null) : (track.addedAt ?? null)
        )
      ),
      names: [canonicalLabel(album.name), canonicalLabel(album.artist ?? ''), album.key],
    })),
    order
  );
}
