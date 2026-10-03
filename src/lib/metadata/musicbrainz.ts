import { rankGenres, type WeightedGenre } from './genres.ts';
import { request, sleep, statusOf, USER_AGENT } from './http.ts';
import { splitCredit } from './credit.ts';
import { identify } from './identify.ts';
import { foldForMatch, matchScore } from './text.ts';
import type { Track } from '../types.ts';

/**
 * MusicBrainz fills the gap Apple leaves: community-catalogued releases that no
 * store carries. Yousei Teikoku is the case that motivated it — absent from
 * Apple entirely, present here with exact release dates.
 *
 * The catalogue stores that artist as 妖精帝國, yet a search for the romaji name
 * still finds them, because MusicBrainz keeps aliases. That is why lookups
 * resolve the *artist* first and then search recordings by id: it sidesteps
 * transliteration completely, which matching on names never could.
 *
 * Data is CC0. The service asks for one request a second and a User-Agent that
 * identifies the application; both are honoured below.
 */
const ENDPOINT = 'https://musicbrainz.org/ws/2';

/**
 * MusicBrainz asks for no more than one request per second and answers 503 when
 * it decides you are over — with a little headroom, because the limit is
 * enforced on their side against a moving window that a client cannot see.
 */
const REQUEST_INTERVAL_MS = 1_400;

/** A 503 means slow down, not that the record is missing. */
const THROTTLE_BACKOFF_MS = 4_000;

/**
 * How close to the best hit an artist has to rank to be believed.
 *
 * `score` is not a confidence: MusicBrainz normalises it against the top result,
 * so the leader is 100 whether or not it is any good and everything below is a
 * percentage of that. This is therefore a tie-breaker — "the best hit, or as
 * good as it" — and not a quality bar. It is kept for artists because nothing
 * else can judge them: the whole point of resolving an artist here is that
 * 妖精帝國 is the right answer to `Yousei Teikoku`, and no comparison of names
 * would ever agree.
 *
 * Recordings are deliberately not filtered this way. `titlesAgree` decides them
 * on evidence, and a correct recording ranked below a near-tie was being thrown
 * out for scoring 87 against a first result that was simply wrong.
 *
 * Shared with the photograph lookup, which is asking the same question of the
 * same index and must not answer it differently: an artist good enough to take
 * genres from is an artist good enough to take a picture of.
 */
export const MIN_ARTIST_SCORE = 90;

/**
 * Release types that describe the package rather than the song. A recording is
 * listed under every release it ever appeared on, and a compilation's genres
 * are the compilation's — `Now That's What I Call Music` is not a genre of
 * anything on it.
 */
/**
 * How many names out of one credit are tried before giving up on it.
 *
 * Each costs up to three paced requests. The song is almost always under the
 * first or second name; a credit with nine on it is a compilation's, and nine
 * tries would hold the whole queue up for half a minute to learn that.
 */
const NAMES_TRIED = 4;

const REPACKAGED = new Set(['Compilation', 'Live', 'Remix', 'DJ-mix', 'Mixtape/Street']);

export type MusicBrainzMatch = {
  title: string;
  artist: string;
  /** Ranked, best first. The first is the genre; the rest are still true. */
  genres: string[];
  year: number | null;
  /**
   * What finding it said about the credit, when the credit could be read two
   * ways: `true` if the catalogue has it as one artist, `false` if the song
   * was only found under one of the names in it. Null when there was nothing
   * to settle.
   */
  oneArtist: boolean | null;
};

type Tagged = { genres?: WeightedGenre[]; tags?: WeightedGenre[] };
type ArtistResult = { id: string; name: string; score: number };
type ReleaseGroup = {
  id: string;
  'primary-type'?: string | null;
  'secondary-types'?: string[];
};
type RecordingResult = Tagged & {
  id: string;
  title: string;
  score: number;
  'first-release-date'?: string;
  releases?: { 'release-group'?: ReleaseGroup }[];
};

let nextRequestAt = 0;

/**
 * One request to MusicBrainz, paced and identified.
 *
 * Exported because the pacing is the point: the interval is counted here, in
 * one module-level clock, and a second client opening its own connection would
 * quietly double the rate the service sees while each half believed it was
 * behaving. Anything of ours that asks MusicBrainz anything comes through here.
 */
export async function musicBrainzGet<T>(path: string, signal?: AbortSignal, attempt = 0): Promise<T> {
  const wait = nextRequestAt - Date.now();
  if (wait > 0) await sleep(wait, signal);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

  try {
    return await request<T>(
      'MusicBrainz',
      `${ENDPOINT}${path}`,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
      signal
    );
  } catch (error) {
    // Backing off and retrying matters: treating a throttle as a miss would
    // write "not found" for a track that was never looked at.
    if (statusOf(error) === 503 && attempt < 2) {
      await sleep(THROTTLE_BACKOFF_MS * (attempt + 1), signal);
      return musicBrainzGet<T>(path, signal, attempt + 1);
    }
    throw error;
  }
}

/**
 * Both caches exist because a library repeats itself: tracks share an artist,
 * and an album's tracks share a release group. The first track pays; the rest
 * are free. Misses are cached too, so a name that resolves to nothing is not
 * asked about once per track.
 */
const artistCache = new Map<string, ResolvedArtist | null>();
const releaseGroupCache = new Map<string, WeightedGenre[]>();

type ResolvedArtist = { id: string; genres: WeightedGenre[] };

/** Curated genres and free tags, merged; the vocabulary filter cleans them later. */
function labelsOf(entity: Tagged): WeightedGenre[] {
  return [...(entity.genres ?? []), ...(entity.tags ?? [])];
}

/** Lucene treats these as syntax, and a stray one fails the whole query. */
function escapeLucene(value: string): string {
  return value.replace(/[+\-!(){}\[\]^"~*?:\\/]|&&|\|\|/g, ' ').trim();
}

async function resolveArtist(
  name: string,
  signal?: AbortSignal
): Promise<ResolvedArtist | null> {
  // Keyed on the folded name so `Kanako Itō` and `Kanako Ito` are one artist
  // and not two round trips.
  const key = foldForMatch(name);
  const cached = artistCache.get(key);
  if (cached !== undefined) return cached;

  const escaped = escapeLucene(name);
  if (!escaped) {
    artistCache.set(key, null);
    return null;
  }

  const search = await musicBrainzGet<{ artists?: ArtistResult[] }>(
    `/artist?query=${encodeURIComponent(`"${escaped}"`)}&fmt=json&limit=3`,
    signal
  );
  const best = (search.artists ?? []).find((artist) => artist.score >= MIN_ARTIST_SCORE);
  if (!best) {
    artistCache.set(key, null);
    return null;
  }

  const detail = await musicBrainzGet<Tagged>(`/artist/${best.id}?inc=genres+tags&fmt=json`, signal);
  const resolved = { id: best.id, genres: labelsOf(detail) };
  artistCache.set(key, resolved);
  return resolved;
}

async function releaseGroupGenres(
  id: string,
  signal?: AbortSignal
): Promise<WeightedGenre[]> {
  const cached = releaseGroupCache.get(id);
  if (cached) return cached;

  const detail = await musicBrainzGet<Tagged>(`/release-group/${id}?inc=genres+tags&fmt=json`, signal);
  const genres = labelsOf(detail);
  releaseGroupCache.set(id, genres);
  return genres;
}

/** The release the song is actually from, as far as the search results say. */
function releaseGroupOf(recording: RecordingResult): string | undefined {
  const groups = (recording.releases ?? [])
    .map((release) => release['release-group'])
    .filter((group): group is ReleaseGroup => group != null);

  const original = groups.find(
    (group) =>
      !REPACKAGED.has(group['primary-type'] ?? '') &&
      !(group['secondary-types'] ?? []).some((type) => REPACKAGED.has(type))
  );
  return (original ?? groups[0])?.id;
}

/** Lucene scores loosely, so confirm the titles genuinely agree. */
function titlesAgree(candidate: string, wanted: string): boolean {
  return (
    foldForMatch(candidate) === foldForMatch(wanted) ||
    // matchScore refuses single-word queries, which is right when guessing at a
    // whole catalogue but wrong here: the search was already pinned to one
    // artist or release, so an exact title is conclusive.
    matchScore(wanted, { title: candidate }) > 0
  );
}

async function searchRecordings(
  query: string,
  wantedTitle: string,
  signal?: AbortSignal
): Promise<RecordingResult | null> {
  const search = await musicBrainzGet<{ recordings?: RecordingResult[] }>(
    `/recording?query=${encodeURIComponent(query)}&fmt=json&limit=5`,
    signal
  );
  const agreeing = (search.recordings ?? []).filter((recording) =>
    titlesAgree(recording.title, wantedTitle)
  );

  /*
    The earliest of the ones that agree, not the first.

    A song that did well is in the catalogue several times over under the same
    title -- the album cut, the one on the greatest hits, a reissue -- and each
    is dated to its own release. Taking whichever the search ranked first filed
    a 2010 song under 2022 because the reissue happened to score a point
    higher. The earliest is the recording the others are copies of, and its
    release is the one whose genres describe the song.

    One with no date at all only wins when none of them has one.
  */
  const yearOf = (recording: RecordingResult) => {
    const year = Number(recording['first-release-date']?.slice(0, 4));
    return Number.isInteger(year) && year > 1900 ? year : Infinity;
  };
  let best: RecordingResult | null = null;
  for (const recording of agreeing) {
    if (!best || yearOf(recording) < yearOf(best)) best = recording;
  }
  return best;
}

export async function lookupTrack(
  track: Track,
  signal?: AbortSignal
): Promise<MusicBrainzMatch | null> {
  const { artist, artists, title } = identify(track);
  if (!artist) return null;

  // Quoted so the words have to appear together, but escaped first: a title
  // carrying a quote or a backslash closes the phrase early and MusicBrainz
  // answers 400, which used to surface as a rate limit and cost a minute.
  const phrase = escapeLucene(title);

  /*
    The credit as written goes first, then each name in it.

    As written, because `Earth, Wind & Fire` is an artist and has to be found
    as one before anybody tries looking for Earth. Then name by name, because
    `Eminem, Rihanna` is not an artist anywhere: the search used to stop at
    that, with a song both of them are credited on sitting one request away.
    An artist id finds every recording the artist is credited on, guest or
    lead, so whichever name resolves first is enough.

    Pinning to a resolved artist is the precise search, which is why all of
    this comes before the looser one below.
  */
  const names = [artist, ...artists]
    .filter((name, index, all) => all.findIndex((other) => foldForMatch(other) === foldForMatch(name)) === index)
    .slice(0, NAMES_TRIED);

  let recording: RecordingResult | null = null;
  let resolved: ResolvedArtist | null = null;
  let under: string | null = null;
  for (const name of names) {
    const found = await resolveArtist(name, signal);
    // The genres of whoever the record is filed under are the fallback even
    // when the song itself turns up under somebody else.
    resolved ??= found;
    if (!found || !phrase) continue;
    recording = await searchRecordings(`arid:${found.id} AND recording:"${phrase}"`, title, signal);
    if (recording) {
      resolved = found;
      under = name;
      break;
    }
  }

  // `JoJo - Doppio` and `Minecraft - C418 Aria Math` name a work rather than a
  // performer. Treating that as the alternative case assumed resolving them as
  // artists would fail — it does not, because MusicBrainz really does list a
  // group called Minecraft and a singer called JoJo, both scoring 100. So the
  // artist search succeeds, matches nothing, and the franchise reading has to
  // be tried afterwards rather than instead.
  //
  // Unquoted on purpose: the composer sits in the middle of `C418 Aria Math`,
  // so that phrase is nobody's title even though its words are. titlesAgree
  // still has to approve whatever comes back.
  if (!recording && phrase) {
    recording = await searchRecordings(
      `recording:(${phrase}) AND release:(${escapeLucene(artist)})`,
      title,
      signal
    );
  }
  if (!recording) return null;

  // Genre lives at every level and is populated at almost none. The recording
  // is the most specific answer and the rarest, the release group sometimes
  // carries something, and the artist is the reliable fallback — so all three
  // are merged in that order of confidence.
  const releaseGroupId = releaseGroupOf(recording);
  const groupGenres = releaseGroupId
    ? await releaseGroupGenres(releaseGroupId, signal)
    : undefined;

  const year = Number(recording['first-release-date']?.slice(0, 4));

  // Only a credit the rules would take apart has anything to be settled, and
  // only a search pinned to an artist settles it.
  const ambiguous = splitCredit(artist).length > 1;
  const oneArtist =
    !ambiguous || under == null ? null : foldForMatch(under) === foldForMatch(artist);

  return {
    title: recording.title,
    artist,
    genres: rankGenres(labelsOf(recording), groupGenres, resolved?.genres),
    year: Number.isInteger(year) && year > 1900 ? year : null,
    oneArtist,
  };
}
