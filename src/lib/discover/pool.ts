import { isAbortError, isNetworkError, isSlow, isThrottle, statusOf } from '../metadata/http.ts';
import { foldForMatch } from '../metadata/text.ts';
import type { DeezerArtist, DeezerTrack } from './deezer.ts';
import {
  coverUrl,
  DETAILS_AT_ONCE,
  type ArtistFacts,
  type Band,
  type RadioArtist,
  type Recording,
  type TaggedRecording,
} from './listenbrainz.ts';
import { filedNear, listenedNear, sharePlaces, together } from './nearness.ts';
import { tagFit, type Popularity } from './policy.ts';
import type { Candidate } from './rank.ts';
import {
  FIRST_KEPT,
  listenedOffers,
  MORE_KEPT,
  shopOffers,
  type Issued,
  type Offer,
} from './songs.ts';
import { chance, standingOf, type Seed, type Standing } from './taste.ts';
import {
  anotherTake,
  doubtfulRecord,
  isNobody,
  isSongLength,
  isTalk,
  leadArtist,
  looseSongKey,
  plainTitle,
} from './variants.ts';
import type { Why } from './why.ts';

/**
 * The songs a Discover list is chosen from, gathered.
 *
 * Given the artists to start from, this finds out who is near each of them,
 * by two witnesses (`nearness.ts`); shares the places for new artists out
 * between the artists started from, so that the one played most leads to
 * most; and asks, for each artist that is to have a place, which of their
 * songs are the ones to offer (`songs.ts`). It does not choose the list: that
 * is `selectSongs`, later, and as often as a place on the list falls empty —
 * which is why more artists are gathered than there are places.
 *
 * Nothing here knows what it is asking. The questions are handed in, so that
 * in the app they are three services behind their pacers and in a test they
 * are the answers those gave on the day they were tried.
 *
 * What it costs, for six artists to start from and a list of twenty: on
 * ListenBrainz six requests for neighbours, one for how many people play each
 * of them and two for where Deezer keeps them; on Deezer six for related
 * artists, six for the songs of the artists started from and some twenty-five
 * for the songs of the new ones. About forty-five, and six more to
 * MusicBrainz the first time, when the artists' ids have to be looked up. The
 * hosts are asked side by side: about six seconds.
 *
 * Any of the three may be gone. Without Deezer the neighbours are
 * ListenBrainz's alone and the songs are asked of ListenBrainz an artist at a
 * time; without ListenBrainz the neighbours are Deezer's alone; an artist
 * Deezer has never heard of is asked about on ListenBrainz and the other way
 * about. What stops a build is all of them being gone at once.
 */

/** The questions. Each may fail, and a failure is one answer missing and not the build. */
export type Sources = {
  /** An artist's catalogue id by name, or null where the catalogue has nobody of that name. */
  resolve(name: string, signal?: AbortSignal): Promise<string | null>;
  /** Who is played in the same sittings as an artist, with how often. */
  similar(mbid: string, signal?: AbortSignal): Promise<Candidate[]>;
  /** How many people play each of these artists. */
  popularity(mbids: string[], signal?: AbortSignal): Promise<Map<string, number>>;
  /** Where Deezer keeps each of these artists, and their genres. */
  facts(mbids: string[], signal?: AbortSignal): Promise<Map<string, ArtistFacts>>;
  /** Deezer's artists for a name, best match first. */
  find(name: string, signal?: AbortSignal): Promise<DeezerArtist[]>;
  related(id: number, signal?: AbortSignal): Promise<DeezerArtist[]>;
  top(id: number, limit: number, signal?: AbortSignal): Promise<DeezerTrack[]>;
  /** One artist's recordings from a stretch of their range: asked with no neighbours wanted. */
  radio(
    mbid: string,
    band: Band,
    size: { artists: number; recordings: number },
    signal?: AbortSignal
  ): Promise<RadioArtist[]>;
  details(mbids: string[], signal?: AbortSignal): Promise<Map<string, Recording>>;
  /** What each recording was issued on, by MusicBrainz. */
  issued(mbids: string[], signal?: AbortSignal): Promise<Map<string, Issued>>;
  tagged(
    tags: string[],
    operator: 'and' | 'or',
    band: Band,
    count: number,
    signal?: AbortSignal
  ): Promise<TaggedRecording[]>;
};

export type TagSearch = { label: string; tags: string[]; operator: 'and' | 'or' };

export type PoolInput = {
  seeds: Seed[];
  /** Asked only where no artist led anywhere: a library with tags and nobody played. */
  searches: TagSearch[];
  /** How much each tag is played, as a share of the most played; see `tagMix`. */
  weights: Map<string, number>;
  /** Folded names of every artist the library has or the history has played. */
  owned: Set<string>;
  /** {@link looseSongKey} of every track in the library. */
  ownedSongs: Set<string>;
  standings: Map<string, Standing>;
  /** Catalogue ids of artists blocked by id, for a name the catalogue spells otherwise. */
  blockedIds?: Set<string>;
  popularity: Popularity;
  /** What this build's chance is drawn from. The same edition gathers the same pool. */
  edition: string | number;
  /** How long the list is to be. Left out, twenty. */
  count?: number;
};

/** One song of the pool: an `Entry` as the engine keeps it, and why it is there. */
export type Gathered = {
  /**
   * What the song is known by everywhere after this: a MusicBrainz recording
   * id where it came from ListenBrainz, and Deezer's number for the track
   * written in the same shape where it came from Deezer (`shopSongId`; the
   * phone's queue takes no other shape). It is a name and is never looked up
   * anywhere; the song's sleeve and its length are in their own fields.
   */
  recordingMbid: string;
  title: string;
  artist: string;
  /** The artist's MusicBrainz id, or `dz:artist:<id>` for one only Deezer knows. */
  artistMbid: string;
  release: string | null;
  coverUrl: string | null;
  /** The artist somebody plays that this is on the list for, and a second where two led here; joined by ` · `. */
  because: string;
  familiar: boolean;
  score: number;
  tags: string[];
  durationSec: number | null;
  why: Why;
  /** How many times anybody at all has played it, where the service said. */
  listens: number | null;
  /** The build it came from, which is what a selection's chance is drawn from. */
  edition: string | number;
  /**
   * How hard the artist it is on the list for pulls, from nought to one.
   * `selectSongs` shares the places out by this; a song without it (one kept
   * from before) is chosen the way songs always were.
   */
  share?: number;
};

/** What became of a build's requests, for whoever wants to say so. */
export type BuildReport = {
  asked: number;
  failed: number;
  offline: number;
  throttled: number;
  /** Seeds that led anywhere, out of those tried. */
  seeds: number;
  artists: number;
  /** Songs looked at, and how many were another take, too short or long, owned, or shut out. */
  considered: number;
  dropped: { take: number; length: number; owned: number; out: number; unknown: number };
  /** Which witnesses answered at all. */
  heard?: { listened: boolean; filed: boolean };
  /** Artists whose songs came from each place, and those that had none to offer. */
  songs?: { shop: number; listened: number; none: number };
};

export type Step = {
  done: number;
  total: number;
  artist: string;
  /** `near` while neighbours are being found, `songs` while their songs are. */
  phase?: 'near' | 'songs';
};

/**
 * Why a build came to nothing.
 *
 * `offline` is requests that never left: no route, no name resolved. That is
 * as near as anything here can come to "the phone has no connection", and
 * whoever can ask the phone itself should (the engine does). `unreachable`
 * is the services' side of it: requests that went out and were not answered
 * in time, or were answered by a server saying it is broken. The two used to
 * be one, and a ListenBrainz that was down for an hour told everybody to
 * check their Wi-Fi. `throttled` is being told to wait, and `nothing` is
 * having asked, been answered, and still having nothing.
 */
export type BuildFault = 'offline' | 'unreachable' | 'throttled' | 'nothing';

export function buildFault(code: BuildFault): Error {
  return Object.assign(new Error(`Discover: ${code}`), { discover: code });
}

/** Which of the three a failure is, or null for anything else that went wrong. */
export function buildFaultOf(error: unknown): BuildFault | null {
  const code = (error as { discover?: unknown } | null)?.discover;
  return code === 'offline' || code === 'unreachable' || code === 'throttled' || code === 'nothing' ? code : null;
}

/**
 * The stretch of an artist's range asked of ListenBrainz, by what somebody
 * asked for — where ListenBrainz is asked at all, which is for an artist
 * Deezer has nothing for.
 *
 * The top of the range in every case, because the order is then made here,
 * by listens, and the stretch of that order is `songs.ts`'s to take. It used
 * to be the upper half drawn evenly, and the lower part of that half is the
 * catalogue's lint: for an artist with thousands of recordings, bootlegs
 * played five times.
 */
export const BANDS: Record<Popularity, Band> = {
  known: { begin: 88, end: 100 },
  any: { begin: 85, end: 100 },
  deep: { begin: 70, end: 100 },
};
/** For an artist already played, where what is wanted is further down. */
const OWN_BAND: Band = { begin: 65, end: 100 };

const TAGGED_AT_ONCE = 40;
const PER_SEARCH = 25;
/** What a song found by its tags alone starts from, beside an artist's own songs at one. */
const TAG_WEIGHT = 0.5;

/** How many of an artist's most played are asked of Deezer: for a new artist, and for one already played. */
const SHOP_FIRST = 15;
const SHOP_MORE = 50;
/** And for an artist somebody has that was only come upon: enough to get past what the library holds. */
const SHOP_OWNED = 30;
/** The same of ListenBrainz, which then has to be asked what each one is. */
const LISTENED_FIRST = 12;
const LISTENED_MORE = 30;
/** And how many of those, the most played, are then asked about: a stretch of the order needs no more. */
const NAMED_FIRST = 8;
const NAMED_MORE = 16;
/** How many times a seed's next neighbour is tried past what it wants, when neighbours keep having no songs. */
const SPARE_TRIES = 4;
/** How many artists Deezer is asked for by name in one build. A search is the least sure way to an artist. */
const FINDS = 6;
/** How many artists somebody has, that were not started from, get songs of their own for being near one that was. */
const OWNED_NEIGHBOURS = 2;
/** A second artist led here too, if it pulled at least this much of what the first did. */
export const SECOND_PULL = 0.6;
/** Requests running that failed on one service before the build stops asking it. */
const GIVE_UP_AFTER = 2;
/** How many recordings go in one question to MusicBrainz. */
export const ISSUED_AT_ONCE = 50;

/** MusicBrainz's stand-in for a compilation's credit. It is near everything and is nobody. */
const VARIOUS_ARTISTS = '89ad4ac3-39f7-470e-963a-56509c546377';

/**
 * How a recording's place in its artist's range moves its score.
 *
 * Kept for the songs found by tags, which have a place in a band and no
 * order of their own. Everything else is ordered and then a stretch of the
 * order is taken; see `songs.ts`.
 */
export function popularityTilt(popularity: Popularity, place: number): number {
  if (popularity === 'known') return 0.6 + 0.8 * place;
  if (popularity === 'deep') return 1.4 - 0.8 * place;
  return 1;
}

/** One of several artists a search by name came back with is the artist only if nothing else could be. */
export function sameArtist(found: DeezerArtist[], name: string): DeezerArtist | null {
  const wanted = foldForMatch(name);
  const same = found
    .filter((artist) => foldForMatch(artist.name) === wanted)
    .sort((left, right) => (right.fans ?? 0) - (left.fans ?? 0));
  if (!same.length || !wanted) return null;
  // Two of one name: the one with ten times the following is who was meant, and otherwise nobody can say.
  if (same.length > 1 && (same[0]!.fans ?? 0) < 10 * Math.max(1, same[1]!.fans ?? 0)) return null;
  return same[0]!;
}

type Pull = { seed: Seed; near: number; listened: number; filed: number; pull: number };

type Neighbour = {
  key: string;
  name: string;
  mbid: string | null;
  shop: DeezerArtist | null;
  by: Map<string, { seed: Seed; listened: number; filed: number }>;
  pulls: Pull[];
  worth: number;
  familiar: boolean;
  tags: string[];
  factor: number;
};

/**
 * How much an artist counts for.
 *
 * The strongest thing that led to them in full and the rest at half. Two
 * artists somebody plays agreeing on a third is a direction, and worth more
 * than either alone; but added whole, a middling artist near five seeds
 * outranks the nearest neighbour of the one played most.
 */
function worthOf(pulls: Pull[]): number {
  return pulls.reduce((sum, part, index) => sum + (index === 0 ? part.pull : part.pull * 0.5), 0);
}

const witnessOf = (pull: Pull): NonNullable<Why['witness']> =>
  pull.listened > 0 && pull.filed > 0 ? 'both' : pull.filed > 0 ? 'deezer' : 'listenbrainz';

/**
 * Gathers the pool.
 *
 * Throws only when it has nothing at all to give, and says which of four
 * things that was — see {@link buildFaultOf} — or when it is stopped. Anything
 * less is a smaller pool and a line in the report.
 */
export async function gatherPool(
  input: PoolInput,
  sources: Sources,
  hooks: {
    signal?: AbortSignal;
    onStep?: (step: Step) => void;
    /** Called once, when the neighbours are in and their songs are being asked for. */
    onNaming?: () => void;
    onReport?: (report: BuildReport) => void;
  } = {}
): Promise<Gathered[]> {
  const { signal } = hooks;
  const { popularity, edition } = input;
  const count = input.count ?? 20;
  const report: BuildReport = {
    asked: 0,
    failed: 0,
    offline: 0,
    throttled: 0,
    seeds: 0,
    artists: 0,
    considered: 0,
    dropped: { take: 0, length: 0, owned: 0, out: 0, unknown: 0 },
    heard: { listened: false, filed: false },
    songs: { shop: 0, listened: 0, none: 0 },
  };

  /*
    One question, asked so that its failing is an answer.

    A stop is the one thing let through. What ends the asking early is two
    requests running that failed on one service: that service is not asked
    again in this build — it is down, and the others are what the build is
    finished with. Each service is judged on its own, because one of them
    being gone is exactly what a build has to come through. But once one has
    been given up for want of any answer at all, the next to go unanswered is
    given up at its first: with no network every service fails alike, and
    waiting out a quarter of a minute on each to learn it twice is how a
    build took two minutes to say "offline". A name whose id was already
    known proves nothing about the network either way, so `proves` is false
    for those.

    `closable` is for the radio, which its maintainers have said will want a
    login: a 401 or 403 from it is the door closing, not a failure, and the
    rest of the build goes on as if it had never been there.
  */
  type Line = 'ids' | 'labs' | 'listens' | 'shop' | 'radio';
  const running: Record<Line, number> = { ids: 0, labs: 0, listens: 0, shop: 0, radio: 0 };
  let unreached = false;
  let slow = 0;
  let broken = 0;
  const open = (line: Line) => running[line] < GIVE_UP_AFTER;
  const attempt = async <T>(
    line: Line,
    question: () => Promise<T>,
    { proves = true, closable = false } = {}
  ): Promise<T | undefined> => {
    if (!open(line)) return undefined;
    report.asked++;
    try {
      const answer = await question();
      if (proves) running[line] = 0;
      return answer;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error;
      const status = statusOf(error) ?? 0;
      if (closable && (status === 401 || status === 403)) {
        running[line] = GIVE_UP_AFTER;
        return undefined;
      }
      // Nobody of that name, or no such artist: an answer, and the service is well.
      if (status === 404) return undefined;
      report.failed++;
      running[line]++;
      if (isNetworkError(error)) {
        report.offline++;
        if (isSlow(error)) slow++;
        if (unreached) running[line] = GIVE_UP_AFTER;
        else if (running[line] >= GIVE_UP_AFTER) unreached = true;
      } else if (isThrottle(error)) report.throttled++;
      else if (status >= 500) broken++;
      return undefined;
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Who is near the artists started from.                                  */
  /* ---------------------------------------------------------------------- */

  type Start = {
    seed: Seed;
    mbid: string | null;
    shop: DeezerArtist | null;
    listened: Candidate[];
    filed: DeezerArtist[];
    tags: string[];
  };
  const starts: Start[] = [];
  const asking: Promise<void>[] = [];
  const seen = new Set<string>();

  // One seed after another: the lookups of their ids are a second and a half
  // apart whatever is done here, and it is what lets a build with no network
  // find that out from the first three. Each one's neighbours are asked for
  // on the other host as soon as its id is known.
  for (const seed of input.seeds) {
    const mbid = (await attempt('ids', () => sources.resolve(seed.name, signal), { proves: false })) ?? null;
    const key = mbid ?? `name:${foldForMatch(seed.name)}`;
    // Two spellings of one artist are one neighbourhood, asked about once.
    if (seen.has(key)) continue;
    seen.add(key);
    const start: Start = { seed, mbid, shop: null, listened: [], filed: [], tags: [] };
    starts.push(start);
    if (mbid) {
      asking.push(
        (async () => {
          start.listened = (await attempt('labs', () => sources.similar(mbid, signal))) ?? [];
        })()
      );
    }
  }

  const known = starts.flatMap((start) => (start.mbid ? [start.mbid] : []));
  const about = known.length ? ((await attempt('listens', () => sources.facts(known, signal))) ?? new Map()) : new Map();
  let nearDone = 0;
  let finds = 0;
  const inShop = async (
    name: string,
    mbid: string | null,
    facts: Map<string, ArtistFacts>,
    counted = true
  ): Promise<DeezerArtist | null> => {
    const id = mbid ? facts.get(mbid)?.deezerId : null;
    if (id != null) return { id, name, fans: null };
    // An artist somebody plays is always worth a search. A neighbour is one of many, and only so many are searched for.
    if (counted && finds++ >= FINDS) return null;
    return sameArtist((await attempt('shop', () => sources.find(name, signal))) ?? [], name);
  };
  for (const start of starts) {
    start.tags = (start.mbid ? about.get(start.mbid)?.tags : null) ?? [];
    asking.push(
      (async () => {
        start.shop = await inShop(start.seed.name, start.mbid, about, false);
        const shop = start.shop;
        if (shop) start.filed = (await attempt('shop', () => sources.related(shop.id, signal))) ?? [];
        hooks.onStep?.({ done: ++nearDone, total: starts.length, artist: start.seed.name, phase: 'near' });
      })()
    );
  }
  await Promise.all(asking);

  const everybody = [...new Set(starts.flatMap((start) => start.listened.map((row) => row.mbid)))];
  const users = everybody.length
    ? ((await attempt('listens', () => sources.popularity(everybody, signal))) ?? new Map<string, number>())
    : new Map<string, number>();

  const own = new Set(starts.flatMap((start) => [foldForMatch(start.seed.name), ...(start.mbid ? [start.mbid] : [])]));
  const neighbours = new Map<string, Neighbour>();
  const neighbour = (name: string): Neighbour => {
    const key = foldForMatch(name);
    const had = neighbours.get(key);
    if (had) return had;
    const made: Neighbour = {
      key, name, mbid: null, shop: null, by: new Map(), pulls: [], worth: 0, familiar: false, tags: [], factor: 1,
    };
    neighbours.set(key, made);
    return made;
  };
  const led = (entry: Neighbour, seed: Seed) => {
    const had = entry.by.get(seed.name);
    if (had) return had;
    const made = { seed, listened: 0, filed: 0 };
    entry.by.set(seed.name, made);
    return made;
  };

  for (const start of starts) {
    for (const row of listenedNear(start.listened, users, popularity)) {
      if (row.mbid === VARIOUS_ARTISTS || isNobody(row.name) || own.has(row.mbid) || own.has(foldForMatch(row.name))) continue;
      if (!foldForMatch(row.name)) continue;
      const entry = neighbour(row.name);
      entry.mbid ??= row.mbid;
      const mark = led(entry, start.seed);
      mark.listened = Math.max(mark.listened, row.near);
      report.heard!.listened = true;
    }
    for (const row of filedNear(start.filed)) {
      if (isNobody(row.artist.name) || own.has(foldForMatch(row.artist.name)) || !foldForMatch(row.artist.name)) continue;
      const entry = neighbour(row.artist.name);
      entry.shop ??= row.artist;
      const mark = led(entry, start.seed);
      mark.filed = Math.max(mark.filed, row.near);
      report.heard!.filed = true;
    }
  }

  const blocked = (entry: { mbid: string | null; shop: DeezerArtist | null }) =>
    (!!entry.mbid && !!input.blockedIds?.has(entry.mbid)) ||
    (!!entry.shop && !!input.blockedIds?.has(`dz:artist:${entry.shop.id}`));

  for (const entry of [...neighbours.values()]) {
    const standing = standingOf(input.standings, entry.name);
    if (standing.out || blocked(entry)) {
      neighbours.delete(entry.key);
      report.dropped.out++;
      continue;
    }
    entry.factor = standing.factor;
    entry.familiar = input.owned.has(entry.key);
    entry.pulls = [...entry.by.values()]
      .map(({ seed, listened, filed }) => {
        const near = together(listened, filed);
        return { seed, near, listened, filed, pull: seed.weight * near };
      })
      .sort((left, right) => right.pull - left.pull || (left.seed.name < right.seed.name ? -1 : 1));
    entry.worth = worthOf(entry.pulls) * entry.factor;
  }
  report.artists = neighbours.size;
  report.seeds = starts.filter((start) => start.listened.length || start.filed.length || start.shop || start.mbid).length;

  /* ---------------------------------------------------------------------- */
  /* Whose songs to ask for.                                                */
  /* ---------------------------------------------------------------------- */

  const places = Math.ceil(count / 2);
  const mine = (start: Start) =>
    [...neighbours.values()]
      .filter((entry) => !entry.familiar && entry.pulls[0]?.seed === start.seed)
      .map((entry) => {
        const [first, second] = entry.pulls;
        const agreed = second && second.pull >= SECOND_PULL * first!.pull ? 1.15 : 1;
        return { entry, draw: first!.near * agreed * entry.factor * (0.7 + 0.6 * chance(edition, entry.key)) };
      })
      .sort((left, right) => right.draw - left.draw || (left.entry.key < right.entry.key ? -1 : 1))
      .map(({ entry }) => entry);
  const lines = starts.map((start) => ({ start, queue: mine(start) }));
  const leading = lines.filter((line) => line.queue.length);
  const shares = sharePlaces(leading.map((line) => line.start.seed.weight), places);
  // Half as many again as each has places, and one at least: what the list needs, and something to put in a
  // place that falls empty. With the shop gone every artist is three requests and not one, so one spare is all.
  const wanted = (share: number) => share + (open('shop') ? Math.max(1, Math.ceil(share / 2)) : 1);
  const plan = leading.map((line, index) => ({ ...line, want: wanted(shares[index]!) }));

  // What is known of the ones likely to be asked about — their genres, and where Deezer keeps
  // those only ListenBrainz named — asked together and once.
  const unplaced = plan
    .flatMap((line) => line.queue.slice(0, line.want + SPARE_TRIES))
    .filter((entry) => entry.mbid)
    .map((entry) => entry.mbid!);
  const more = unplaced.length
    ? ((await attempt('listens', () => sources.facts([...new Set(unplaced)].slice(0, 50), signal))) ?? new Map<string, ArtistFacts>())
    : new Map<string, ArtistFacts>();
  for (const entry of neighbours.values()) {
    if (entry.mbid) entry.tags = more.get(entry.mbid)?.tags ?? about.get(entry.mbid)?.tags ?? [];
  }

  type Waiting = {
    artist: { name: string; mbid: string };
    familiar: boolean;
    rows: { mbid: string; listens: number }[];
    put: (offers: Offer[]) => void;
    sift: (offers: Offer[]) => Offer[];
  };
  const waiting: Waiting[] = [];
  let shut = false;
  /** The first question put to the radio, which the rest wait on: if it is refused, none of them is asked. */
  let knock: Promise<unknown> | null = null;
  /** Titles the library has, whoever by. */
  const ownedTitles = new Set([...input.ownedSongs].map((key) => key.slice(key.indexOf('|') + 1)));
  /**
   * A new artist is not met by their recording of a song somebody already
   * has by somebody else. Deezer's most played for Motörhead includes their
   * `Enter Sandman`, and nothing a shop says of a track tells a cover from
   * a song.
   */
  const notACover = (offers: Offer[]) =>
    offers.filter((offer) => !ownedTitles.has(looseSongKey({ title: offer.title, artist: '' }).slice(1)));

  /**
   * An artist's songs: Deezer's where it has the artist, and otherwise
   * ListenBrainz's — which are only ids at first, so those wait in a line and
   * are named together at the end. True where there is, or may yet be, a song.
   */
  const songsOf = async (
    artist: { name: string; mbid: string | null; shop: DeezerArtist | null },
    familiar: boolean,
    put: (offers: Offer[]) => void,
    sift: (offers: Offer[]) => Offer[] = (offers) => offers,
    most = familiar ? SHOP_MORE : SHOP_FIRST
  ): Promise<boolean> => {
    let shop = artist.shop;
    if (!shop && open('shop')) shop = artist.shop = await inShop(artist.name, artist.mbid, more);
    if (shop && open('shop')) {
      const at = shop;
      const tracks = await attempt('shop', () => sources.top(at.id, most, signal));
      if (tracks?.length) {
        const offers = sift(shopOffers(tracks, at, input.ownedSongs, familiar, popularity));
        report.considered += tracks.length;
        if (offers.length) report.songs!.shop++;
        else report.songs!.none++;
        put(offers);
        return offers.length > 0;
      }
    }
    const mbid = artist.mbid;
    if (mbid && !shut && open('radio') && open('listens')) {
      const size = { artists: 0, recordings: familiar ? LISTENED_MORE : LISTENED_FIRST };
      const band = familiar ? OWN_BAND : BANDS[popularity];
      if (knock) await knock;
      const asked = open('radio') ? attempt('radio', () => sources.radio(mbid, band, size, signal), { closable: true }) : undefined;
      knock ??= asked ?? null;
      const answer = await asked;
      if (!open('radio')) shut = true;
      const rows = answer?.find((entry) => entry.mbid === mbid)?.recordings ?? [];
      if (rows.length) {
        waiting.push({ artist: { name: artist.name, mbid }, familiar, rows, put, sift });
        return true;
      }
    }
    report.songs!.none++;
    return false;
  };

  type Found = { offers: Offer[]; make: (offer: Offer) => Gathered };
  const found: Found[] = [];
  const total =
    plan.reduce((sum, line) => sum + Math.min(line.want, line.queue.length), 0) + starts.length;
  let songsDone = 0;
  const stepped = (name: string) =>
    hooks.onStep?.({ done: Math.min(++songsDone, total), total, artist: name, phase: 'songs' });

  const entryOf = (
    offer: Offer,
    artist: { name: string; mbid: string | null; shop: DeezerArtist | null },
    rest: Pick<Gathered, 'because' | 'familiar' | 'score' | 'why' | 'share'>
  ): Gathered => ({
    recordingMbid: offer.id,
    title: offer.title,
    artist: offer.credit || artist.name,
    artistMbid: artist.mbid ?? `dz:artist:${artist.shop?.id ?? foldForMatch(artist.name)}`,
    release: offer.release,
    coverUrl: offer.cover,
    tags: offer.tags,
    durationSec: offer.durationSec,
    listens: offer.listens,
    edition,
    ...rest,
  });

  if (plan.length || starts.length) hooks.onNaming?.();

  const fetching: Promise<void>[] = [];

  // The artists started from: more of what somebody already plays.
  for (const start of starts) {
    const standing = standingOf(input.standings, start.seed.name);
    if (standing.out || blocked(start)) continue;
    const artist = { name: start.seed.name, mbid: start.mbid, shop: start.shop };
    fetching.push(
      (async () => {
        await songsOf(artist, true, (offers) =>
          found.push({
            offers: drawn(offers, MORE_KEPT, edition),
            make: (offer) => {
              const tags = offer.tags.length ? offer.tags : start.tags;
              return entryOf({ ...offer, tags }, artist, {
                because: start.seed.name,
                familiar: true,
                share: start.seed.weight,
                score: start.seed.weight * standing.factor * (1 + tagFit(tags, input.weights) * 0.3) * offer.weight,
                // Theirs, and said to be theirs whoever else is near them.
                why: { kind: 'yours', seeds: [start.seed.name], searched: [], tags, similarity: null, fresh: false },
              });
            },
          })
        );
        stepped(start.seed.name);
      })()
    );
  }

  const nearEntry = (entry: Neighbour) => (offer: Offer): Gathered => {
    const [first, second] = entry.pulls;
    const seeds = [first!.seed.name, ...(second && second.pull >= SECOND_PULL * first!.pull ? [second.seed.name] : [])];
    const tags = offer.tags.length ? offer.tags : entry.tags;
    const score = entry.worth * (1 + tagFit(tags, input.weights) * 0.3) * offer.weight;
    const said = { similarity: first!.near, witness: witnessOf(first!), searched: [], tags };
    return entryOf({ ...offer, tags }, entry, {
      because: seeds.join(' · '),
      familiar: entry.familiar,
      share: first!.seed.weight,
      score,
      why: entry.familiar
        ? // Somebody's own artist, come upon by way of another: theirs first, and the way here kept beside it.
          { kind: 'yours', seeds: [entry.name], via: seeds, fresh: false, ...said }
        : { kind: 'near', seeds, fresh: true, ...said },
    });
  };

  // The new artists, each seed filling its own places from its own nearest.
  // One that turns out to have no song to offer gives its turn to the next.
  for (const line of plan) {
    fetching.push(
      (async () => {
        let have = 0;
        let tried = 0;
        for (const entry of line.queue) {
          if (have >= line.want || tried >= line.want + SPARE_TRIES) break;
          tried++;
          const any = await songsOf(
            entry,
            false,
            (offers) => found.push({ offers: drawn(offers, FIRST_KEPT, edition), make: nearEntry(entry) }),
            notACover
          );
          if (any) {
            have++;
            stepped(entry.name);
          }
        }
      })()
    );
  }

  // And a couple of artists somebody has but was not started from, for being near one that was.
  const theirs = [...neighbours.values()]
    .filter((entry) => entry.familiar)
    .sort((left, right) => right.worth - left.worth || (left.key < right.key ? -1 : 1))
    .slice(0, OWNED_NEIGHBOURS);
  for (const entry of theirs) {
    fetching.push(
      songsOf(
        entry,
        true,
        (offers) => found.push({ offers: drawn(offers, FIRST_KEPT, edition), make: nearEntry(entry) }),
        undefined,
        SHOP_OWNED
      ).then(() => undefined)
    );
  }
  await Promise.all(fetching);

  // What ListenBrainz offered, named and checked together.
  if (waiting.length) {
    const kept = waiting.map((wait) => ({
      ...wait,
      rows: [...wait.rows]
        .sort((left, right) => right.listens - left.listens || (left.mbid < right.mbid ? -1 : 1))
        .slice(0, wait.familiar ? NAMED_MORE : NAMED_FIRST),
    }));
    const ids = [...new Set(kept.flatMap((wait) => wait.rows.map((row) => row.mbid)))];
    const batches = <T>(all: T[], size: number) =>
      Array.from({ length: Math.ceil(all.length / size) }, (_, at) => all.slice(at * size, (at + 1) * size));
    const details = new Map<string, Recording>();
    const issued = new Map<string, Issued>();
    const [named, checked] = await Promise.all([
      Promise.all(batches(ids, DETAILS_AT_ONCE).map((batch) => attempt('listens', () => sources.details(batch, signal)))),
      Promise.all(batches(ids, ISSUED_AT_ONCE).map((batch) => attempt('ids', () => sources.issued(batch, signal)))),
    ]);
    for (const answer of named) for (const [mbid, recording] of answer ?? []) details.set(mbid, recording);
    for (const answer of checked) for (const [mbid, kind] of answer ?? []) issued.set(mbid, kind);
    for (const wait of kept) {
      report.considered += wait.rows.length;
      const offers = wait.sift(
        listenedOffers(wait.rows, details, issued, wait.artist, input.ownedSongs, wait.familiar, popularity, coverUrl)
      );
      if (offers.length) report.songs!.listened++;
      else report.songs!.none++;
      wait.put(offers);
    }
  }

  const best = new Map<string, Gathered>();
  const keep = (entry: Gathered) => {
    // One place for one song, whichever catalogue it came from and however it spells it.
    const key = looseSongKey({ title: entry.title, artist: entry.artist });
    if (input.ownedSongs.has(key)) {
      report.dropped.owned++;
      return;
    }
    const rival = best.get(key);
    if (!rival || entry.score > rival.score) best.set(key, entry);
  };
  for (const { offers, make } of found) for (const offer of offers) keep(make(offer));

  /* ---------------------------------------------------------------------- */
  /* Nobody led anywhere: what is tagged the way somebody listens.          */
  /* ---------------------------------------------------------------------- */

  if (!best.size && input.searches.length && !shut && open('radio')) {
    const band = popularity === 'known' ? { begin: 80, end: 100 } : popularity === 'deep' ? { begin: 50, end: 85 } : { begin: 50, end: 100 };
    const searched = await Promise.all(
      input.searches.map(async (search) => ({
        search,
        rows:
          (await attempt('radio', () => sources.tagged(search.tags, search.operator, band, TAGGED_AT_ONCE, signal), {
            closable: true,
          })) ?? [],
      }))
    );
    const picked = new Map<string, { search: TagSearch; place: number }>();
    for (const { search, rows } of searched) {
      rows
        .map((row) => ({ row, draw: chance(edition, row.mbid) }))
        .sort((left, right) => right.draw - left.draw)
        .slice(0, PER_SEARCH)
        .forEach(({ row }) => {
          if (!picked.has(row.mbid)) picked.set(row.mbid, { search, place: Math.min(1, Math.max(0, row.percent / 100)) });
        });
    }
    const ids = [...picked.keys()];
    const details = ids.length ? ((await attempt('listens', () => sources.details(ids.slice(0, DETAILS_AT_ONCE), signal))) ?? new Map<string, Recording>()) : new Map<string, Recording>();
    for (const [mbid, { search, place }] of picked) {
      report.considered++;
      const recording = details.get(mbid);
      const credited = recording?.artists?.[0];
      if (!recording || !credited || credited.mbid === VARIOUS_ARTISTS || isNobody(recording.artist)) {
        report.dropped.unknown++;
        continue;
      }
      if (anotherTake(recording.title) || doubtfulRecord(recording.release) || isTalk(recording.tags)) {
        report.dropped.take++;
        continue;
      }
      if (!isSongLength(recording.durationSec)) {
        report.dropped.length++;
        continue;
      }
      const standing = standingOf(input.standings, credited.name, recording.artist);
      if (standing.out || (recording.artists ?? []).some((entry) => input.blockedIds?.has(entry.mbid))) {
        report.dropped.out++;
        continue;
      }
      const familiar = [credited.name, recording.artist, leadArtist(recording.artist)].some((name) => input.owned.has(foldForMatch(name)));
      keep({
        recordingMbid: recording.mbid,
        title: plainTitle(recording.title, recording.artist),
        artist: recording.artist || credited.name,
        artistMbid: credited.mbid,
        release: recording.release,
        coverUrl: coverUrl(recording),
        because: search.label,
        familiar,
        score: TAG_WEIGHT * standing.factor * (1 + tagFit(recording.tags, input.weights) * 0.3) * popularityTilt(popularity, place),
        tags: recording.tags,
        durationSec: recording.durationSec,
        why: { kind: 'tags', seeds: [], searched: search.tags, tags: recording.tags, similarity: null, fresh: !familiar },
        listens: null,
        edition,
      });
    }
  }

  const pool = [...best.values()].sort(
    (left, right) => right.score - left.score || (left.recordingMbid < right.recordingMbid ? -1 : 1)
  );
  hooks.onReport?.(report);

  if (!pool.length) {
    // Nothing reached is one thing, told to wait is another, and having asked
    // and been answered and still having nothing is the third.
    const unanswered = report.offline + broken;
    if (unanswered > 0 && unanswered >= report.failed - report.throttled) {
      // Offline only where something never left the phone at all. Every one of them sent and unanswered is the far end's trouble.
      throw buildFault(report.offline > slow ? 'offline' : 'unreachable');
    }
    if (report.throttled > 0) throw buildFault('throttled');
    throw buildFault('nothing');
  }
  return pool;
}

/**
 * As many of an artist's offers as the pool keeps, drawn by this edition's
 * chance and leaning the way the offers are weighted — so that the next
 * edition offers other songs of the same artist, and the same edition the
 * same ones.
 */
function drawn(offers: Offer[], most: number, edition: string | number): Offer[] {
  return offers
    .map((offer) => ({ offer, draw: offer.weight * (0.5 + chance(edition, offer.id)) }))
    .sort((left, right) => right.draw - left.draw || (left.offer.id < right.offer.id ? -1 : 1))
    .slice(0, most)
    .map(({ offer }) => offer);
}

/* ------------------------------------------------------------------------ */
/* Answers kept, so that the same thing is not asked twice in a day.        */
/* ------------------------------------------------------------------------ */

/** Somewhere to put an answer. In the app a map in memory, unless the engine hands in a longer one. */
export type AnswerCache = {
  get(key: string): { at: number; value: unknown } | undefined;
  set(key: string, entry: { at: number; value: unknown }): void;
};

const HOUR = 3_600_000;

/**
 * How long each kind of answer is believed.
 *
 * What an artist is most played for, for a day: long enough that a second
 * refresh the same evening asks almost nothing, and short enough that a new
 * single is on the list the week it comes out. Who a shop files beside whom,
 * for a week. How near two artists are, how many people play them, where
 * another catalogue keeps them and what a recording is called do not change
 * from one month to the next. What makes one list differ from the last is
 * the edition's chance and not a fresh answer, so nothing is lost by keeping.
 */
export const KEPT_FOR = {
  radio: 24 * HOUR,
  tagged: 24 * HOUR,
  top: 24 * HOUR,
  related: 7 * 24 * HOUR,
  similar: 30 * 24 * HOUR,
  popularity: 30 * 24 * HOUR,
  facts: 30 * 24 * HOUR,
  find: 30 * 24 * HOUR,
  details: 30 * 24 * HOUR,
  issued: 30 * 24 * HOUR,
};

/** A cache in memory that forgets its oldest when it has grown past all use. */
export function memoryCache(limit = 4_000): AnswerCache {
  const held = new Map<string, { at: number; value: unknown }>();
  return {
    get: (key) => held.get(key),
    set(key, entry) {
      held.delete(key);
      held.set(key, entry);
      while (held.size > limit) held.delete(held.keys().next().value!);
    },
  };
}

/**
 * The same five questions, answered from what was kept where that is fresh.
 *
 * A failure is never kept, so it is asked again next time; an empty answer
 * is, because "nobody is near this artist" is as true an hour later. Details
 * are kept a recording at a time, and only the recordings not already known
 * are asked about — a second build the same day asks for the names of almost
 * nothing.
 */
export function remembering(sources: Sources, cache: AnswerCache, now: () => number): Sources {
  const through = async <T>(key: string, life: number, ask: () => Promise<T>): Promise<T> => {
    const kept = cache.get(key);
    if (kept && now() - kept.at < life && now() >= kept.at) return kept.value as T;
    const value = await ask();
    cache.set(key, { at: now(), value });
    return value;
  };
  const bandOf = (band: Band) => `${band.begin}-${band.end}`;

  /** A question about many ids at once, answered an id at a time from what was kept. */
  const each = async <T>(
    kind: string,
    life: number,
    ids: string[],
    ask: (missing: string[]) => Promise<Map<string, T>>,
    /** What to keep for an id the answer left out, so that it is not asked about again; undefined keeps nothing. */
    absent?: T
  ): Promise<Map<string, T>> => {
    const found = new Map<string, T>();
    const missing: string[] = [];
    for (const id of ids) {
      const kept = cache.get(`${kind}|${id}`);
      if (kept && now() - kept.at < life && now() >= kept.at) {
        if (kept.value !== null) found.set(id, kept.value as T);
      } else missing.push(id);
    }
    if (missing.length) {
      const answer = await ask(missing);
      for (const id of missing) {
        const value = answer.get(id);
        if (value !== undefined) {
          cache.set(`${kind}|${id}`, { at: now(), value });
          found.set(id, value);
        } else if (absent !== undefined) cache.set(`${kind}|${id}`, { at: now(), value: absent });
      }
    }
    return found;
  };

  return {
    resolve: sources.resolve,
    similar: (mbid, signal) => through(`similar|${mbid}`, KEPT_FOR.similar, () => sources.similar(mbid, signal)),
    popularity: (mbids, signal) =>
      each('popularity', KEPT_FOR.popularity, mbids, (missing) => sources.popularity(missing, signal), null as unknown as number),
    facts: (mbids, signal) => each('facts', KEPT_FOR.facts, mbids, (missing) => sources.facts(missing, signal)),
    find: (name, signal) => through(`find|${foldForMatch(name)}`, KEPT_FOR.find, () => sources.find(name, signal)),
    related: (id, signal) => through(`related|${id}`, KEPT_FOR.related, () => sources.related(id, signal)),
    top: (id, limit, signal) => through(`top|${id}|${limit}`, KEPT_FOR.top, () => sources.top(id, limit, signal)),
    radio: (mbid, band, size, signal) =>
      through(`radio|${mbid}|${bandOf(band)}|${size.artists}x${size.recordings}`, KEPT_FOR.radio, () =>
        sources.radio(mbid, band, size, signal)
      ),
    tagged: (tags, operator, band, count, signal) =>
      through(`tagged|${tags.join('+')}|${operator}|${bandOf(band)}|${count}`, KEPT_FOR.tagged, () =>
        sources.tagged(tags, operator, band, count, signal)
      ),
    details: (mbids, signal) => each('details', KEPT_FOR.details, mbids, (missing) => sources.details(missing, signal)),
    issued: (mbids, signal) => each('issued', KEPT_FOR.issued, mbids, (missing) => sources.issued(missing, signal)),
  };
}

/**
 * The same questions, with a door that stays closed once it has closed.
 *
 * ListenBrainz has said its radio is to want a login. The day it does, every
 * question put to it is a 401; and asking again on every build, for every
 * artist, to be told so again, is traffic of exactly the kind that closed it.
 * So the first 401 or 403 is remembered for as long as the app stays open,
 * and after it the question is answered here, with the same refusal and
 * without asking.
 */
export function closing(sources: Sources, state: { closed: boolean } = { closed: false }): Sources {
  const refused = () => Object.assign(new Error('ListenBrainz radio is closed'), { status: 401 });
  const guard = async <T>(ask: () => Promise<T>): Promise<T> => {
    if (state.closed) throw refused();
    try {
      return await ask();
    } catch (error) {
      const status = statusOf(error);
      if (status === 401 || status === 403) state.closed = true;
      throw error;
    }
  };
  return {
    ...sources,
    radio: (mbid, band, size, signal) => guard(() => sources.radio(mbid, band, size, signal)),
    tagged: (tags, operator, band, count, signal) => guard(() => sources.tagged(tags, operator, band, count, signal)),
  };
}
