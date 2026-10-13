import {
  abortError,
  asThrottle,
  httpError,
  networkError,
  pacer,
  request,
  sleep,
  USER_AGENT,
} from '../metadata/http.ts';

/**
 * Deezer, asked two things ListenBrainz cannot be: who its own catalogue
 * files beside an artist, and which of an artist's songs are the ones people
 * know.
 *
 * ---------------------------------------------------------------------------
 * What leaves the phone, and to whom
 * ---------------------------------------------------------------------------
 *
 * A Discover build names artists and nothing else. To MusicBrainz, the name
 * of an artist somebody plays, for its catalogue id. To ListenBrainz, those
 * ids, and the ids of the artists it answered with. To Deezer — which is a
 * company and not a foundation — an artist's name where its Deezer id is not
 * already known, and then artist ids. Nobody is told what was played, how
 * often, or what is in the library; no account, key or token goes with any
 * of it. Deezer sees, as any site does, the address the request came from and
 * which artists were asked about.
 *
 * ---------------------------------------------------------------------------
 * The terms this is used under, said plainly
 * ---------------------------------------------------------------------------
 *
 * These endpoints answer with no key, and that is tolerated and not granted.
 * Deezer's terms (developers.deezer.com/termsofuse, read 13 October 2026) are
 * written for a registered developer, and registration has been closed since
 * 2024; they limit use to "a non-commercial purpose", let Deezer "modify,
 * restrict or remove" access at any time, and forbid use "in any way or on
 * any website that is associated or promotes … unauthorized use, streaming,
 * download" — which an app that fetches from YouTube arguably is. The owner
 * of this app read that and chose to use it. So nothing here may be relied
 * on: a build must come out whole with every one of these calls refused,
 * and `pool.ts` is written so that it does.
 *
 * ---------------------------------------------------------------------------
 * What each of them answered, asked by hand on 13 October 2026
 * ---------------------------------------------------------------------------
 *
 * GET /search/artist?q=AURORA&limit=3
 *   { "data": [ { "id": 7699874, "name": "AURORA", "nb_fan": 560226, … }, … ] }
 *   The best match for the words first, which is not always the artist:
 *   `妖精帝國` found a namesake with 51 fans. Believed only where the name is
 *   the same name.
 *
 * GET /artist/7699874/related?limit=20
 *   { "data": [ { "id": …, "name": "Paris Paloma", "nb_fan": 41234 }, … ] }
 *   Nearest first, twenty at most. Empty for a small artist.
 *
 * GET /artist/7699874/top?limit=50
 *   { "data": [ { "id": 136336110, "title": "Runaway", "title_short": "Runaway",
 *       "title_version": "", "duration": 249, "rank": 945380,
 *       "artist": { "id": 7699874, "name": "AURORA" },
 *       "album": { "id": …, "title": "…", "cover_medium": "https://cdn-images.dzcdn.net/…" } }, … ] }
 *   Most played first. `title_version` is the bracket (`(Demo)`, `(Remastered
 *   2021)`); `artist` is who the track is filed under, which for a guest spot
 *   is somebody else.
 *
 * A refusal is a 200 with `{ "error": { "type": "…", "message": "…", "code": 4 } }`;
 * code 4 is the quota, which the unofficial word puts at fifty requests in
 * five seconds. This keeps under it by pacing: see `BETWEEN_MS`.
 */
const API = 'https://api.deezer.com';

/** Eight a second at the very most, against the ten the unofficial figure allows. */
const BETWEEN_MS = 120;
/** Shorter than the app's usual wait: this is the witness a build can do without. */
const TIMEOUT_MS = 8_000;
const QUOTA = 4;
const NO_DATA = 800;

const turn = pacer(BETWEEN_MS);

type Refusal = { error?: { type?: string; message?: string; code?: number } };

async function ask<T>(path: string, signal?: AbortSignal, again = true): Promise<T> {
  await turn(signal);

  // Its own, shorter deadline. Told apart from somebody stopping the build:
  // that is an abort, and this is a service that did not answer.
  const mine = new AbortController();
  let late = false;
  const timer = setTimeout(() => {
    late = true;
    mine.abort();
  }, TIMEOUT_MS);
  const forward = () => mine.abort();
  if (signal?.aborted) mine.abort();
  else signal?.addEventListener('abort', forward, { once: true });

  let body: T & Refusal;
  try {
    body = await request<T & Refusal>(
      'Deezer',
      `${API}${path}`,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
      mine.signal
    );
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (late) throw networkError('Deezer did not answer in time', true);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }

  const refusal = body?.error;
  if (!refusal) return body;
  if (refusal.code === QUOTA) {
    if (again) {
      await sleep(1_500, signal);
      return ask<T>(path, signal, false);
    }
    throw asThrottle(httpError('Deezer', 429));
  }
  // "No data" is an answer: there is no such artist. Anything else is a refusal.
  throw httpError('Deezer', refusal.code === NO_DATA ? 404 : 403);
}

/** An artist as Deezer files it. */
export type DeezerArtist = { id: number; name: string; fans: number | null };

/** One line of an artist's most played, as far as this reads it. */
export type DeezerTrack = {
  id: number;
  title: string;
  /** The title without its bracket, and the bracket. */
  short: string;
  version: string;
  durationSec: number | null;
  rank: number;
  /** Who the track is filed under. */
  artistId: number | null;
  artistName: string;
  album: string | null;
  cover: string | null;
  /**
   * Where thirty seconds of it can be heard, or null for a track that has
   * none. Signed, and good for a short while only: to be used when it is
   * read and never kept.
   */
  preview?: string | null;
};

type ArtistRow = { id?: number; name?: string; nb_fan?: number };
type TrackRow = {
  id?: number;
  title?: string;
  title_short?: string;
  title_version?: string;
  duration?: number;
  rank?: number;
  artist?: { id?: number; name?: string };
  album?: { title?: string; cover_medium?: string; cover?: string };
  preview?: string;
};

export function readArtists(body: unknown): DeezerArtist[] {
  const rows = (body as { data?: unknown } | null)?.data;
  return (Array.isArray(rows) ? (rows as ArtistRow[]) : [])
    .filter((row) => typeof row?.id === 'number' && !!row.name)
    .map((row) => ({ id: row.id!, name: row.name!, fans: typeof row.nb_fan === 'number' ? row.nb_fan : null }));
}

export function readTracks(body: unknown): DeezerTrack[] {
  const rows = (body as { data?: unknown } | null)?.data;
  return (Array.isArray(rows) ? (rows as TrackRow[]) : [])
    .filter((row) => typeof row?.id === 'number' && !!row.title)
    .map((row) => ({
      id: row.id!,
      title: row.title!,
      short: row.title_short || row.title!,
      version: row.title_version ?? '',
      durationSec: row.duration ? row.duration : null,
      rank: row.rank ?? 0,
      artistId: row.artist?.id ?? null,
      artistName: row.artist?.name ?? '',
      album: row.album?.title ?? null,
      cover: row.album?.cover_medium ?? row.album?.cover ?? null,
      preview: typeof row.preview === 'string' && row.preview ? row.preview : null,
    }));
}

/** The artists a search for a name comes back with, best match first. Whether one is the artist is the caller's to say. */
export async function searchArtists(name: string, signal?: AbortSignal): Promise<DeezerArtist[]> {
  return readArtists(await ask<unknown>(`/search/artist?q=${encodeURIComponent(name)}&limit=3`, signal));
}

/** Who the catalogue files beside an artist, nearest first. */
export async function relatedArtists(id: number, signal?: AbortSignal): Promise<DeezerArtist[]> {
  return readArtists(await ask<unknown>(`/artist/${id}/related?limit=20`, signal));
}

/** An artist's most played, the most played first. */
export async function topTracks(id: number, limit: number, signal?: AbortSignal): Promise<DeezerTrack[]> {
  return readTracks(await ask<unknown>(`/artist/${id}/top?limit=${limit}`, signal));
}

/*
 * ---------------------------------------------------------------------------
 * Previews, asked by hand on 13 October 2026
 * ---------------------------------------------------------------------------
 *
 * GET /track/3135556
 *   { "id": 3135556, "title": "Harder, Better, Faster, Stronger", "duration": 226,
 *     "preview": "https://cdnt-preview.dzcdn.net/api/1/1/6/a/2/0/6a2c….mp3?hdnea=exp=…~hmac=…",
 *     "artist": { "id": 27, "name": "Daft Punk" }, "album": { … } }
 *   One track, not in a `data` list. `preview` is thirty seconds of it as an
 *   MP3, at an address signed for a short while: empty for a track with none.
 *
 * GET /search/track?q=daft punk harder better faster stronger&limit=5
 *   { "data": [ { "id": 3135556, "title": "…", "title_short": "…", "duration": 226,
 *       "artist": { … }, "preview": "https://cdnt-preview.dzcdn.net/…" }, … ] }
 *   The words as they come, best match first. The form with fields in it
 *   (`artist:"…" track:"…"`) answered nothing at all for the same song, for
 *   the commas in its title, so the plain form is the one used, and whether
 *   a row is the song is the caller's to say.
 *
 * What this tells Deezer is one song at a time, at the moment somebody taps
 * it: more than a build does, which names artists only. Nothing is sent that
 * says who, and nothing is asked for a song nobody tapped.
 */

/** One track by Deezer's number for it, or null where there is none. */
export async function trackById(id: number, signal?: AbortSignal): Promise<DeezerTrack | null> {
  const row = await ask<unknown>(`/track/${Math.trunc(id)}`, signal);
  return readTracks({ data: [row] })[0] ?? null;
}

/** The tracks a search for some words comes back with, best match first. */
export async function searchTracks(words: string, signal?: AbortSignal): Promise<DeezerTrack[]> {
  return readTracks(await ask<unknown>(`/search/track?q=${encodeURIComponent(words)}&limit=8`, signal));
}
