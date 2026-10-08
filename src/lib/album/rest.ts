import { sameRecordName, withoutEdition } from '../metadata/covers.ts';
import { isAbortError, isNetworkError, isThrottle, statusOf } from '../metadata/http.ts';
import { escapeLucene } from '../metadata/musicbrainz.ts';
import { bareTitle, foldForMatch, VARIANT_MARKERS } from '../metadata/text.ts';

/**
 * The rest of a record: what is on it that the library does not have.
 *
 * The library holds records a track at a time, and most of them in part — the
 * three songs somebody liked off an album of twelve. MusicBrainz knows the
 * other nine. This asks it for the record, picks the pressing of it the
 * library's tracks came off, and says of each track on that pressing whether
 * it is here.
 *
 * Nothing in this file reaches the network or the database for itself. What it
 * asks goes through whatever it is handed, which in the app is the one paced
 * door to MusicBrainz and in a test is a list of answers.
 */

/** One question to MusicBrainz: a path under its endpoint, answered with the body. */
export type Get = <T>(path: string, signal?: AbortSignal) => Promise<T>;

/** A track of the record the library already has, as far as this needs to know it. */
export type OwnedTrack = {
  id: string;
  title: string;
  artist: string | null;
  trackNumber: number | null;
  discNumber?: number | null;
};

export type RestTrack = {
  disc: number;
  position: number;
  title: string;
  lengthSec: number | null;
  /** Who it is by, said only where that is somebody other than the record's artist. */
  artist: string | null;
  /** The library's own track that is this one, or null: this one is missing. */
  have: string | null;
};

export type AlbumRest = {
  groupId: string;
  /** The pressing the list below was read off. */
  release: { id: string; title: string; artist: string; year: number | null };
  /** How many discs it is on; the disc is only worth saying when this is not one. */
  discs: number;
  tracks: RestTrack[];
  /**
   * How many of the library's tracks were found on it.
   *
   * None is a warning and not a failure: the name and the artist agreed, but
   * nothing here says the record is the same one, and a track "missing" from
   * it may be sitting in the library under a title this could not read.
   */
  covered: number;
  /** Other records of the same name that were passed over for this one. */
  rivals: number;
};

/**
 * Why there is no answer, each of them something different to say:
 *
 *  - `unnamed`: the record has no name, or no one artist, to ask with;
 *  - `notFound`: MusicBrainz was asked and has no such record;
 *  - `offline`: nothing answered;
 *  - `throttled`: it answered "slow down", and went on saying so;
 *  - `failed`: it answered something else that was not an answer.
 */
export type RestFailure = 'unnamed' | 'notFound' | 'offline' | 'throttled' | 'failed';

export type RestOutcome = { ok: true; rest: AlbumRest } | { ok: false; why: RestFailure };

/**
 * How many records of one name are looked into before the best so far is kept.
 *
 * Each is a request, a second and a half apart. An album, the single it was
 * named after and an EP of remixes is the usual crowd; past three the name is
 * one like `Greatest Hits`, and the first three by this artist are the ones
 * with any claim.
 */
const GROUPS_TRIED = 3;

type Credit = { name?: string; joinphrase?: string };
type ReleaseGroup = { id: string; title?: string; 'primary-type'?: string | null };
type ListedTrack = {
  position?: number;
  title?: string;
  length?: number | null;
  recording?: { title?: string; length?: number | null; video?: boolean };
  'artist-credit'?: Credit[];
};
export type Release = {
  id: string;
  title?: string;
  status?: string | null;
  date?: string;
  'artist-credit'?: Credit[];
  media?: { position?: number; format?: string | null; tracks?: ListedTrack[] }[];
};

type Listed = Omit<RestTrack, 'artist' | 'have'> & { credit: string };

/**
 * A track of a record as whoever listed it has it: where it sits and what it
 * is called. All that telling whether the library has it goes by, so that a
 * list read off a pressing and one read off a playlist are compared by the
 * same rules.
 */
export type ListedTitle = { disc: number; position: number; title: string };

/** A credit as it is printed: the names, with whatever joins them. */
function creditOf(credits: Credit[] | undefined): string {
  return (credits ?? [])
    .map((credit) => `${credit.name ?? ''}${credit.joinphrase ?? ''}`)
    .join('')
    .trim();
}

/**
 * The tracks of one pressing, in the order they play.
 *
 * Only what can be listened to. A deluxe box often has a DVD in it, catalogued
 * as a disc like the others, and its music videos are not tracks of the album
 * that anybody is missing.
 */
function listingOf(release: Release): Listed[] {
  const listed: Listed[] = [];
  (release.media ?? []).forEach((medium, index) => {
    if (/video|vhs/i.test(medium.format ?? '')) return;
    const disc = medium.position ?? index + 1;
    (medium.tracks ?? []).forEach((track, at) => {
      if (track.recording?.video) return;
      const title = (track.title ?? track.recording?.title ?? '').trim();
      if (!title) return;
      const length = track.length ?? track.recording?.length ?? null;
      listed.push({
        disc,
        position: track.position ?? at + 1,
        title,
        lengthSec: length ? Math.round(length / 1000) : null,
        credit: creditOf(track['artist-credit']),
      });
    });
  });
  return listed;
}

/** Words in a bracket that make what is in front of it another recording. */
const ANOTHER_TAKE = new Set([...VARIANT_MARKERS, 'acoustic']);

/**
 * A title without what one catalogue adds to it and another leaves off.
 *
 * `Numb (feat. Jay-Z)`, `Numb [2011 Remaster]` and `Numb` are one track of the
 * record, spelled by three shops. `Numb (Live)` is not: it is the other track,
 * the one on the bonus disc, and folding it into the first would report the
 * record complete with half of it here. So a bracket is dropped unless it
 * says the take is a different one.
 */
export function looseTitle(title: string): string {
  const stripped = title
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (whole: string, inside: string) =>
      foldForMatch(inside).split(' ').some((word) => ANOTHER_TAKE.has(word)) ? whole : ''
    )
    .replace(/\s+(feat|ft|featuring)\.?\s[^([]*/i, '');
  // A title that was nothing but a bracket is still a title.
  return foldForMatch(stripped) || foldForMatch(title);
}

/**
 * Gives each listed track that has none yet the library's track of the same
 * title, as [keyOf] reads titles.
 *
 * Twice over the list. A title can be on a record twice — an intro on each
 * disc — and the library's copy says which of them it is by where it sits, so
 * the ones whose place agrees are paired first and only then the leftovers, in
 * order. A library track is only ever given once.
 */
function pair(
  listing: ListedTitle[],
  owned: OwnedTrack[],
  held: (string | null)[],
  used: Set<string>,
  keyOf: (title: string) => string
): void {
  const waiting = new Map<string, OwnedTrack[]>();
  for (const track of owned) {
    if (used.has(track.id)) continue;
    // `Artist - Title` in the title is the file's doing, not the record's.
    const key = keyOf(bareTitle(track.title, track.artist));
    if (!key) continue;
    const others = waiting.get(key);
    if (others) others.push(track);
    else waiting.set(key, [track]);
  }

  for (const placed of [true, false]) {
    listing.forEach((entry, index) => {
      if (held[index] != null) return;
      const candidates = waiting.get(keyOf(entry.title));
      if (!candidates || candidates.length === 0) return;
      const at = placed
        ? candidates.findIndex(
            (track) =>
              track.trackNumber === entry.position && (track.discNumber ?? 1) === entry.disc
          )
        : 0;
      if (at < 0) return;
      const [found] = candidates.splice(at, 1);
      held[index] = found!.id;
      used.add(found!.id);
    });
  }
}

/**
 * Which of the library's tracks each listed track is, or null for none.
 *
 * Titles as they are written first, and only what is left over by the looser
 * reading, so that a library holding both `Numb` and `Numb (feat. Jay-Z)` does
 * not have the wrong one of them taken for the album cut.
 *
 * Whatever the list was read off: a pressing in the catalogue here, and the
 * record as YouTube has it in `youtube.ts`.
 */
export function matchTracks(listing: ListedTitle[], owned: OwnedTrack[]): (string | null)[] {
  const held: (string | null)[] = listing.map(() => null);
  const used = new Set<string>();
  pair(listing, owned, held, used, foldForMatch);
  pair(listing, owned, held, used, looseTitle);
  return held;
}

export type Chosen = {
  release: Release;
  listing: Listed[];
  held: (string | null)[];
  covered: number;
};

/**
 * The one pressing of a record to read its track list from.
 *
 * A record is in the catalogue once for every time it was pressed: the album,
 * the Japanese one with a bonus track, the deluxe box with nine. Reading the
 * list off the longest reports nine tracks missing from an album that is all
 * here. So, in this order:
 *
 *  1. the pressing most of the library's tracks are on — the tracks that are
 *     here came off one of them, and that one is what "the rest" is the rest
 *     of. Somebody with two of the bonus tracks does want the box;
 *  2. an official one before a bootleg or a promo;
 *  3. the shortest of those, which is the album as it was first sold;
 *  4. the earliest of those, and then whichever the catalogue listed first.
 *
 * Null when none of them lists any tracks at all.
 */
export function chooseRelease(releases: Release[], owned: OwnedTrack[]): Chosen | null {
  let best: (Chosen & { at: number }) | null = null;
  for (const [at, release] of releases.entries()) {
    const listing = listingOf(release);
    if (listing.length === 0) continue;
    const held = matchTracks(listing, owned);
    const entry = { release, listing, held, covered: held.filter(Boolean).length, at };
    if (!best || before(entry, best)) best = entry;
  }
  return best;
}

const official = (release: Release) => (release.status === 'Official' ? 0 : 1);
// A year alone sorts before a day in it, and no date at all after everything.
const dated = (release: Release) => release.date || '9999';

function before(one: Chosen & { at: number }, other: Chosen & { at: number }): boolean {
  const order =
    other.covered - one.covered ||
    official(one.release) - official(other.release) ||
    one.listing.length - other.listing.length ||
    (dated(one.release) < dated(other.release) ? -1 : dated(one.release) > dated(other.release) ? 1 : 0) ||
    one.at - other.at;
  return order < 0;
}

/**
 * What kind of record the library's name for it says it is.
 *
 * A shop sells a single as `Ruins - Single`, and a library that took the name
 * from there has the single, not the album the song later went onto. Where
 * the name says nothing, an album: that is what this is asked about.
 */
function kindNamed(name: string): string {
  const said = /\s-\s+(single|ep)\s*$/i.exec(name)?.[1]?.toLowerCase();
  return said === 'single' ? 'Single' : said === 'ep' ? 'EP' : 'Album';
}

/**
 * Looks a record up and says what the library is missing from it.
 *
 * Two or three requests as a rule, and never more than five: one search for
 * the record under its artist, a second by its name alone only where the
 * first found nothing, and then one request per record looked into — which
 * brings every pressing of it with its tracks — for at most three of them,
 * stopping at the first that has every track the library does.
 *
 * The second search is for an artist the catalogue writes otherwise. 妖精帝國
 * is `Yousei Teikoku` in a library, and a search for the record under that
 * name finds nothing because records, unlike artists, are not indexed under
 * their artist's other names. A record found by name alone has nobody
 * vouching for it, so it is only believed when the library's own tracks are
 * on it.
 *
 * A stop while this is waiting is passed on as the rejection it arrived as;
 * everything else that goes wrong is answered and not thrown.
 */
export async function findAlbumRest(
  album: { name: string; artist: string | null; tracks: OwnedTrack[] },
  get: Get,
  signal?: AbortSignal
): Promise<RestOutcome> {
  // A name that is all bracket is asked for as it stands.
  const name = escapeLucene(withoutEdition(album.name) || album.name);
  const artist = escapeLucene(album.artist ?? '');
  // No guessing at a record nobody named, or one whose tracks do not agree
  // whose it is: the first hit for a bare title is somebody else's album.
  if (!name || !artist) return { ok: false, why: 'unnamed' };

  const search = async (query: string) => {
    const found = await get<{ 'release-groups'?: ReleaseGroup[] }>(
      `/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=5`,
      signal
    );
    // The score is how a hit ranks against the first, not how good it is, so
    // the names are what is believed — as they are for a recording.
    const agreeing = (found['release-groups'] ?? []).filter((group) =>
      sameRecordName(group.title, album.name)
    );
    const kind = kindNamed(album.name);
    const wanted = (group: ReleaseGroup) => (group['primary-type'] === kind ? 0 : 1);
    // Stable, so within a kind they stay in the order they were ranked.
    return agreeing.sort((left, right) => wanted(left) - wanted(right));
  };

  try {
    let groups = await search(`releasegroup:"${name}" AND artist:"${artist}"`);
    const vouched = groups.length > 0;
    if (!vouched) groups = await search(`releasegroup:"${name}"`);

    let best: { group: ReleaseGroup; chosen: Chosen } | null = null;
    for (const group of groups.slice(0, GROUPS_TRIED)) {
      const browsed = await get<{ releases?: Release[] }>(
        `/release?release-group=${group.id}&inc=recordings+media+artist-credits&fmt=json&limit=100`,
        signal
      );
      const chosen = chooseRelease(browsed.releases ?? [], album.tracks);
      if (!chosen) continue;
      if (!best || chosen.covered > best.chosen.covered) best = { group, chosen };
      if (chosen.covered === album.tracks.length) break;
    }
    if (!best) return { ok: false, why: 'notFound' };

    const { group, chosen } = best;
    if (!vouched && chosen.covered < Math.min(2, album.tracks.length)) {
      return { ok: false, why: 'notFound' };
    }

    const by = creditOf(chosen.release['artist-credit']);
    const year = Number(chosen.release.date?.slice(0, 4));
    return {
      ok: true,
      rest: {
        groupId: group.id,
        release: {
          id: chosen.release.id,
          title: chosen.release.title?.trim() || group.title?.trim() || album.name,
          artist: by,
          year: Number.isInteger(year) && year > 1900 ? year : null,
        },
        discs: new Set(chosen.listing.map((entry) => entry.disc)).size,
        tracks: chosen.listing.map(({ credit, ...entry }, index) => ({
          ...entry,
          artist: credit && foldForMatch(credit) !== foldForMatch(by) ? credit : null,
          have: chosen.held[index] ?? null,
        })),
        covered: chosen.covered,
        rivals: groups.length - 1,
      },
    };
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) throw error;
    if (isNetworkError(error)) return { ok: false, why: 'offline' };
    // The client has already waited and asked again twice by the time a 503
    // gets this far.
    if (isThrottle(error) || statusOf(error) === 503) return { ok: false, why: 'throttled' };
    return { ok: false, why: 'failed' };
  }
}
