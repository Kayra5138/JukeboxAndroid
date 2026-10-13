import { foldForMatch } from '../metadata/text.ts';
import { leadArtist } from './variants.ts';

/**
 * What somebody has said about the artists Discover showed them, and what
 * follows from it.
 *
 * The listening history says what is liked. This is the other half: what was
 * done with a suggestion. A song kept, a song sent away, a song skipped ten
 * seconds in, a song heard to the end — each says something about the song,
 * which was always acted on, and something about whoever made it, which was
 * not. Sending away three songs by one band and being shown a fourth is the
 * list not listening.
 *
 * Nothing here reads the database, the clock or the network. It is given
 * rows and a time and answers with numbers, so every rule in it has a test.
 */

const DAY = 86_400_000;

/** One thing that happened to one artist's song. */
export type Feedback = {
  kind: 'kept' | 'excluded' | 'skipped' | 'finished' | 'blocked';
  /** The credit as it was written; the first name in it is who this is about. */
  artist: string;
  /**
   * When, where that is known. A song kept or sent away before the table
   * kept dates has none, and one without is taken to be old: it says
   * nothing about the artist any more. (It still keeps its own song away,
   * which is the table's doing and not this file's.) Taken for recent, as it
   * used to be, it could never grow old, and three songs sent away at any
   * time in the app's life left their artist out for good — for everybody
   * who had used Discover for a while, from the day this rule arrived.
   */
  at?: number | null;
};

/** How an artist stands, from everything said about their songs. */
export type Standing = {
  name: string;
  kept: number;
  excluded: number;
  skipped: number;
  finished: number;
  /** What the artist's score is multiplied by. One is "nothing said either way". */
  factor: number;
  /** Not to be suggested at all for now: sent away too often, or blocked. */
  out: boolean;
  /** Blocked by name, which nothing but unblocking undoes. */
  blocked: boolean;
};

/**
 * How long a keep or an exclusion goes on counting.
 *
 * Half a year: long enough that "for a long while" is true of an artist sent
 * away, and short enough that a band somebody could not stand in the spring
 * gets one more chance by the winter.
 */
export const FEEDBACK_DAYS = 180;

/** How long a skip or a finished play counts. A skip is a mood as often as a verdict. */
export const LISTENING_DAYS = 30;

/** Each song of theirs sent away, and the artist counts for this much of what it did. */
export const EXCLUDED_FACTOR = 0.6;

/** Each song of theirs kept, and it counts for this much more — up to {@link MOST_KEEPS}. */
export const KEPT_FACTOR = 1.3;
const MOST_KEEPS = 3;

/**
 * This many more songs sent away than kept, and the artist is left out.
 *
 * Three, because one is a song and two is a coincidence. A keep takes one
 * back, so a band with five songs kept and three sent away is a band somebody
 * likes most of.
 */
export const OUT_AFTER = 3;

/** An early skip, set against what was heard through; see {@link standings}. */
export const SKIPPED_FACTOR = 0.85;
export const FINISHED_FACTOR = 1.1;
const MOST_SKIPS = 4;
const MOST_FINISHES = 4;

/** The name an artist is known by here: the first of the credit, folded. */
export function artistKey(credit: string | null | undefined): string {
  return foldForMatch(leadArtist(credit));
}

/**
 * Every artist anything was said about, and where that leaves them.
 *
 * The arithmetic, for one artist:
 *
 *  - each song sent away in the last half year multiplies by 0.6, so one is a
 *    nudge (0.6) and two is most of the way out (0.36);
 *  - each song kept multiplies by 1.3, up to three of them (2.2);
 *  - three more sent away than kept and the artist is out altogether, until
 *    enough of those are six months old or are allowed again — and a song
 *    sent away at a time nobody wrote down is taken to be older than that;
 *  - listening in the last month is netted: an early skip counts one against,
 *    and a play heard to the end counts half of one for. What is left over
 *    multiplies by 0.85 a skip (four at most, 0.52) or by 1.1 a play (four at
 *    most, 1.46). So an artist somebody has never played, skipped twice in
 *    the first seconds, counts for 0.72 — which is the case that used to
 *    count for nothing at all, because the penalty was only ever taken off a
 *    score and a new artist has none;
 *  - a block is a block.
 *
 * Only the first name of a credit is held to any of it. A guest on a song
 * somebody could not stand did not make the song.
 */
export function standings(feedback: Feedback[], now: number): Map<string, Standing> {
  const all = new Map<string, Standing>();

  for (const event of feedback) {
    const key = artistKey(event.artist);
    if (!key) continue;
    const within = event.kind === 'skipped' || event.kind === 'finished' ? LISTENING_DAYS : FEEDBACK_DAYS;
    // A block is a block whenever it was made. Anything else counts for its time, and with no date its time is over.
    if (event.kind !== 'blocked' && (event.at == null || event.at > now || event.at < now - within * DAY)) continue;

    const standing = all.get(key) ?? {
      name: leadArtist(event.artist),
      kept: 0,
      excluded: 0,
      skipped: 0,
      finished: 0,
      factor: 1,
      out: false,
      blocked: false,
    };
    if (event.kind === 'blocked') standing.blocked = true;
    else standing[event.kind] += 1;
    all.set(key, standing);
  }

  for (const standing of all.values()) {
    const against = standing.skipped - standing.finished / 2;
    const listening =
      against > 0
        ? Math.pow(SKIPPED_FACTOR, Math.min(MOST_SKIPS, against))
        : Math.pow(FINISHED_FACTOR, Math.min(MOST_FINISHES, -against));
    standing.factor =
      Math.pow(EXCLUDED_FACTOR, standing.excluded) *
      Math.pow(KEPT_FACTOR, Math.min(MOST_KEEPS, standing.kept)) *
      listening;
    standing.out = standing.blocked || standing.excluded - standing.kept >= OUT_AFTER;
  }
  return all;
}

/** How much an artist counts for, and whether at all, by any name they go under. */
export function standingOf(
  all: Map<string, Standing>,
  ...credits: (string | null | undefined)[]
): { factor: number; out: boolean } {
  let factor = 1;
  let out = false;
  const seen = new Set<string>();
  for (const credit of credits) {
    const key = artistKey(credit);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const standing = all.get(key);
    if (!standing) continue;
    factor *= standing.factor;
    out ||= standing.out;
  }
  return { factor, out };
}

/* ------------------------------------------------------------------------ */
/* Where what was said is kept.                                             */
/* ------------------------------------------------------------------------ */

/** A row of `discover_exclusions`, as far as this reads one. */
export type ExclusionRow = {
  id: string;
  song_key: string;
  title: string;
  artist: string;
  reason: string;
  until_at: number | null;
  /** Not a column yet. Read if it ever is, so that what was said can grow old. */
  created_at?: number | null;
};

/** The three things done to that table from here, so that a test can be the table. */
export type ExclusionStore = {
  all(): ExclusionRow[];
  put(row: ExclusionRow): void;
  remove(id: string): void;
};

/**
 * The reason an artist's row carries.
 *
 * A song's row is `blocked`, `saved`, `expired` or `unmatched`. An artist's
 * is this, in the same table, and is told from a song's by it: nothing that
 * lists excluded songs lists it, and allowing a song again cannot remove it.
 */
export const ARTIST_REASON = 'artist';

/**
 * What an artist's row is filed under, by name and by catalogue id.
 *
 * Both are in the set of things to keep away from that a selection is handed
 * — it is made of every row's `id` and `song_key` — which is how a block
 * reaches the choosing of songs with nothing new passed to it. Neither can be
 * mistaken for a recording's id or for a song's `artist|title`.
 */
export const artistBlockKey = (credit: string) => `artist:${artistKey(credit)}`;
export const artistBlockId = (mbid: string) => `artist-mbid:${mbid}`;

/** Never this artist again, until {@link unblockArtistIn}. */
export function blockArtistIn(store: ExclusionStore, credit: string, mbid?: string | null): void {
  const name = leadArtist(credit);
  if (!artistKey(name)) return;
  store.put({
    id: artistBlockKey(name),
    // The id where there is one: a name is spelled three ways and an id is not.
    song_key: mbid ? artistBlockId(mbid) : artistBlockKey(name),
    title: '',
    artist: name,
    reason: ARTIST_REASON,
    until_at: null,
  });
}

/** By the name, or by the row's own id as {@link blockedArtistsIn} gave it. */
export function unblockArtistIn(store: ExclusionStore, nameOrId: string): void {
  const wanted = nameOrId.startsWith('artist:') ? nameOrId : artistBlockKey(nameOrId);
  for (const row of store.all()) {
    if (row.reason === ARTIST_REASON && row.id === wanted) store.remove(row.id);
  }
}

export type BlockedArtist = { id: string; artist: string; mbid: string | null };

export function blockedArtistsIn(store: ExclusionStore): BlockedArtist[] {
  return store
    .all()
    .filter((row) => row.reason === ARTIST_REASON)
    .map((row) => ({
      id: row.id,
      artist: row.artist,
      mbid: row.song_key.startsWith('artist-mbid:') ? row.song_key.slice('artist-mbid:'.length) : null,
    }))
    .sort((left, right) => (foldForMatch(left.artist) < foldForMatch(right.artist) ? -1 : 1));
}

/**
 * What the table says, as things that happened.
 *
 * A song saved is a keep, a song blocked is an exclusion and an artist's row
 * is a block. A song that only ran out its time on the list, or could not be
 * found, says nothing about anybody.
 */
export function feedbackFrom(rows: ExclusionRow[]): Feedback[] {
  const said: Feedback[] = [];
  for (const row of rows) {
    const kind =
      row.reason === 'saved'
        ? 'kept'
        : row.reason === 'blocked'
          ? 'excluded'
          : row.reason === ARTIST_REASON
            ? 'blocked'
            : null;
    if (kind && row.artist) said.push({ kind, artist: row.artist, at: row.created_at ?? null });
  }
  return said;
}

/** An early skip, by the rule the listening profile already goes by. */
export function isEarlySkip(skip: { seconds_played: number; duration_sec: number | null }): boolean {
  return skip.seconds_played < Math.min(30, (skip.duration_sec || 120) * 0.25);
}

/* ------------------------------------------------------------------------ */
/* Chance that can be had again.                                            */
/* ------------------------------------------------------------------------ */

function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let at = 0; at < text.length; at++) {
    value ^= text.charCodeAt(at);
    value = Math.imul(value, 0x01000193);
  }
  // One more stir: the ends of two ids that differ in a character are close.
  value ^= value >>> 15;
  value = Math.imul(value, 0x2c1b3c6d);
  value ^= value >>> 12;
  return value >>> 0;
}

/**
 * A number from nought to one that is the same every time for the same two
 * things, and has nothing to do with the number for any other two.
 *
 * This is the whole of the randomness in Discover. A list ought to differ
 * from the last one, or there is no reason to refresh it; and making the same
 * list again ought to give the same list, or a song disappears from under a
 * thumb because something was recounted. So nothing is drawn: each song has a
 * number that belongs to it in this edition of the list, and the edition is
 * what changes.
 */
export function chance(edition: string | number, key: string): number {
  return hash(`${edition}\u0000${key}`) / 0x1_0000_0000;
}

/** The same, as a run of numbers, for where one after another is wanted. */
export function seededRandom(edition: string | number): () => number {
  let state = hash(String(edition)) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/* ------------------------------------------------------------------------ */
/* Whose neighbours to go and look at.                                      */
/* ------------------------------------------------------------------------ */

/** Why an artist is being started from. */
export type SeedSource = 'recent' | 'kept' | 'allTime' | 'library';

export type Seed = {
  name: string;
  /** How hard it pulls, from nought to one. */
  weight: number;
  source: SeedSource;
};

export type SeedInput = {
  /** Artists by what was played lately, as the listening profile scores them. */
  recent: { name: string; score: number }[];
  /** Artists a Discover song was kept from. */
  kept: string[];
  /** Artists by everything ever played, in seconds. */
  allTime: { name: string; seconds: number }[];
  /** Artists by how many of their tracks are in the library. */
  library: { name: string; tracks: number }[];
  standings: Map<string, Standing>;
  limit: number;
  edition: string | number;
};

/** What each rung is worth beside the one above it. */
const KEPT_WEIGHT = 0.7;
const ALL_TIME_WEIGHT = 0.6;
const LIBRARY_WEIGHT = 0.4;

/**
 * The artists a list is built out from.
 *
 * Down a ladder, and only as far down it as is needed:
 *
 *  1. what was played in the last month, each by the square root of its share
 *     of the most played — the flattening is so that a favourite at four times
 *     the next one has twice the say and not four times — and by what was
 *     said about it, with the heaviest of them all then counted as one;
 *  2. artists a Discover song was kept from, at 0.7, which is how keeping a
 *     song makes that artist's neighbours likelier at once and not a month
 *     later when the plays have built up;
 *  3. where that is not twice as many as are wanted — a new install, a month
 *     away — everything ever played, at 0.6 of the same reckoning;
 *  4. and where that is still short, the library itself by how many tracks of
 *     each artist it holds, at 0.4: twelve tracks by somebody is a taste even
 *     if the app never played one.
 *
 * It used to stop at the first rung and, finding it empty, take the first ten
 * artists the scan of the folder happened to meet.
 *
 * Of those, the strongest half are always started from and the other places
 * are drawn from the next few by weight, with {@link chance}: so the list is
 * anchored on what is played most, and the rest of it moves about between
 * refreshes rather than being the same ten neighbourhoods every week.
 *
 * An artist that is out is not started from. Their neighbours are who else
 * the same people play, and somebody who has sent the artist away three times
 * has said something about that crowd.
 */
export function chooseSeeds(input: SeedInput): Seed[] {
  const { standings: all, limit, edition } = input;
  const wanted = new Map<string, Seed>();
  const add = (name: string, weight: number, source: SeedSource) => {
    const key = artistKey(name);
    if (!key || wanted.has(key) || !(weight > 0)) return;
    const standing = all.get(key);
    if (standing?.out) return;
    // What was said about them moves them up or down the order, within reason.
    const said = Math.min(1.25, Math.max(0.25, standing?.factor ?? 1));
    wanted.set(key, { name, weight: weight * said, source });
  };
  const rung = <T extends { name: string }>(
    rows: T[],
    amount: (row: T) => number,
    scale: number,
    source: SeedSource
  ) => {
    const top = Math.max(0, ...rows.map(amount));
    if (top <= 0) return;
    for (const row of [...rows].sort((left, right) => amount(right) - amount(left))) {
      add(row.name, scale * Math.sqrt(Math.max(0, amount(row)) / top), source);
    }
  };

  rung(input.recent, (row) => row.score, 1, 'recent');
  for (const name of input.kept) add(name, KEPT_WEIGHT, 'kept');
  if (wanted.size < limit * 2) rung(input.allTime, (row) => row.seconds, ALL_TIME_WEIGHT, 'allTime');
  if (wanted.size < limit * 2) rung(input.library, (row) => row.tracks, LIBRARY_WEIGHT, 'library');

  /*
    Brought back under one together, and not each cut off at one.

    Cut off singly, the favourite could gain nothing from having been heard to
    the end — it stood at one already — while everybody below it gained a
    quarter, and a favourite played twice as much as the next artist pulled
    barely harder than it. Divided by the heaviest instead, the favourite is
    one and the rest are the shares they really are.
  */
  const heaviest = Math.max(0, ...[...wanted.values()].map((seed) => seed.weight));
  if (heaviest > 1) for (const seed of wanted.values()) seed.weight /= heaviest;

  // A stable order before anything is drawn: by weight, and by name where two weigh the same.
  const ordered = [...wanted.values()].sort(
    (left, right) => right.weight - left.weight || (artistKey(left.name) < artistKey(right.name) ? -1 : 1)
  );
  const anchored = ordered.slice(0, Math.ceil(limit / 2));
  const open = limit - anchored.length;
  const drawn = ordered
    .slice(anchored.length, anchored.length + open * 3)
    // The larger the weight, the nearer the root is to one: a heavier artist
    // is likelier to be drawn and a lighter one is never impossible.
    .map((seed) => ({ seed, ticket: Math.pow(chance(edition, artistKey(seed.name)), 1 / seed.weight) }))
    .sort((left, right) => right.ticket - left.ticket)
    .slice(0, Math.max(0, open))
    .map((entry) => entry.seed);

  return [...anchored, ...drawn].sort((left, right) => right.weight - left.weight);
}

/**
 * Seconds of listening by credit, as seconds by artist.
 *
 * A credit of three names is three artists who each made a third of it. The
 * spelling kept is the first one met.
 */
export function byArtist<T>(
  rows: T[],
  credit: (row: T) => string | null | undefined,
  amount: (row: T) => number,
  split: (credit: string | null | undefined) => string[]
): { name: string; amount: number }[] {
  const totals = new Map<string, { name: string; amount: number }>();
  for (const row of rows) {
    const names = split(credit(row));
    for (const name of names) {
      const key = foldForMatch(name);
      if (!key) continue;
      const already = totals.get(key);
      const share = amount(row) / names.length;
      if (already) already.amount += share;
      else totals.set(key, { name, amount: share });
    }
  }
  return [...totals.values()];
}
