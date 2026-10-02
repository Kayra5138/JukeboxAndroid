import { request, sleep } from './http.ts';
import { identify } from './identify.ts';
import { foldForMatch, matchScore, tokens } from './text.ts';
import type { Track } from '../types.ts';

/**
 * Apple's Search API needs no key and returns a genre and a release date, which
 * is exactly the pair the year-end summary is missing. It is also the only free
 * source that labels Turkish music as such rather than flattening it to `Pop`.
 *
 * Apple documents the limit as "approximately 20 calls per minute". Exceeding it
 * answers 403 *with an empty result list*, which reads exactly like "no match" —
 * so requests are paced and a 403 is raised rather than believed.
 */
const ENDPOINT = 'https://itunes.apple.com/search';

/** Just under Apple's stated ceiling of about twenty requests a minute. */
export const REQUEST_INTERVAL_MS = 3_500;

/**
 * Half the query is enough *because* matchScore already refuses anything with
 * fewer than two agreeing words or a title that does not line up. Requiring
 * more would throw away covers, which are often the only catalogue entry for a
 * song and carry the genre being looked up.
 */
const MIN_SCORE = 0.5;

/**
 * Storefronts differ in catalogue, which is why a Japanese release can be
 * missing from one and present in another. Turkey first because it is the only
 * one that returns Turkey-aware genres; the others are tried only when a track
 * would otherwise be recorded as a miss.
 */
const STOREFRONTS = ['TR', 'US', 'JP'] as const;

export type ItunesMatch = {
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  year: number | null;
  artworkUrl: string | null;
  /** Where the catalogue says it sits on its record. */
  trackNumber: number | null;
  discNumber: number | null;
  score: number;
  storefront: string;
};

type ItunesResult = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackNumber?: number;
  discNumber?: number;
};

/**
 * The rate limit belongs to the API, not to any one track, and a single track
 * can cost several requests once storefront fallbacks kick in. Pacing here
 * rather than in the caller keeps the budget correct however many are made.
 */
let nextRequestAt = 0;

async function paced<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const wait = nextRequestAt - Date.now();
  if (wait > 0) await sleep(wait, signal);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
  return request();
}

/**
 * Whether a result is by the artist that was asked for.
 *
 * Apple searches free text across its whole catalogue, so a search for an
 * obscure Japanese song returns other people's covers of it. Those are the
 * wrong recording by the wrong performer, and accepting them was filling the
 * library with confidently wrong credits.
 */
function sameArtist(wanted: string, candidateArtist: string | undefined): boolean {
  if (!candidateArtist) return false;
  if (foldForMatch(wanted) === foldForMatch(candidateArtist)) return true;
  // Credits vary — `C418` against `C418 & Protostar` — so agreement on the
  // distinctive words is enough.
  const asked = tokens(wanted);
  if (asked.length === 0) return false;
  const credited = new Set(tokens(candidateArtist));
  return asked.filter((word) => credited.has(word)).length / asked.length >= 0.5;
}

function parseYear(releaseDate: string | undefined): number | null {
  const year = Number(releaseDate?.slice(0, 4));
  return Number.isInteger(year) && year > 1900 ? year : null;
}

/** Apple serves artwork at whatever size the url asks for. */
function upscaleArtwork(url: string | undefined): string | null {
  return url ? url.replace(/\/\d+x\d+bb\./, '/600x600bb.') : null;
}

async function searchStorefront(
  query: string,
  wantedArtist: string | null,
  storefront: string,
  fallbackTitle: string,
  signal?: AbortSignal
): Promise<ItunesMatch | null> {
  const url =
    `${ENDPOINT}?term=${encodeURIComponent(query)}` +
    `&entity=song&limit=5&country=${storefront}`;

  // A refusal is raised rather than believed: 403 means the rate limit was hit,
  // and recording "not found" for a track that was never looked up is worse
  // than looking it up again later.
  const body = await paced(
    () => request<{ results?: ItunesResult[] }>(`iTunes ${storefront}`, url, {}, signal),
    signal
  );

  let best: ItunesMatch | null = null;
  for (const result of body.results ?? []) {
    if (!result.trackName) continue;
    // When the artist is known, it is the strongest signal available and a
    // mismatch is decisive. Without one, the title has to carry the match.
    if (wantedArtist && !sameArtist(wantedArtist, result.artistName)) continue;
    const score = matchScore(query, {
      title: result.trackName,
      artist: result.artistName,
      album: result.collectionName,
    });
    if (score < MIN_SCORE || (best && score <= best.score)) continue;
    best = {
      title: result.trackName ?? fallbackTitle,
      artist: result.artistName ?? '',
      album: result.collectionName ?? null,
      genre: result.primaryGenreName ?? null,
      year: parseYear(result.releaseDate),
      artworkUrl: upscaleArtwork(result.artworkUrl100),
      // A single is track one of a collection of one, which is true and
      // useless; it is kept anyway, since the ordering only consults it when
      // several tracks share an album.
      trackNumber: position(result.trackNumber),
      discNumber: position(result.discNumber),
      score,
      storefront,
    };
  }

  return best;
}

export async function lookupTrack(
  track: Track,
  signal?: AbortSignal
): Promise<ItunesMatch | null> {
  const { artist, query } = identify(track);
  if (!query) return null;

  for (const storefront of STOREFRONTS) {
    const match = await searchStorefront(query, artist, storefront, track.title, signal);
    if (match) return match;
  }
  return null;
}

/** A position the catalogue gave, or null for one it did not. */
function position(value: number | undefined): number | null {
  // Zero is what a missing field decodes to in more than one catalogue, and no
  // record has a track zero.
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}
