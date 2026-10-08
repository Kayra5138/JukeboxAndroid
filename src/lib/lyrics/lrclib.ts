import { isSynced } from './lrc.ts';
import { request, sleep, statusOf, USER_AGENT } from '../metadata/http.ts';
import { bareTitle, matchScore } from '../metadata/text.ts';

/**
 * LRCLIB is a lyrics database built for music players: open, free, no key and
 * no account. It holds timed lyrics as well as plain ones, which is what makes
 * words that follow the song possible rather than a wall of text.
 *
 * Its exact lookup takes the track's duration, and that is the part that
 * matters most here. Matching on title and artist alone is how a cover, a live
 * take or a TV-size edit ends up with the wrong words; a length has to agree
 * before anything else is believed.
 */
const ENDPOINT = 'https://lrclib.net/api';

/**
 * LRCLIB publishes no rate limit, which is not the same as not having one, and
 * one track can cost several requests — skipping through a queue fires them
 * back to back. Pacing at the same order as the catalogues is the polite
 * reading, and the searches a skipped track started are cancelled anyway.
 */
const REQUEST_INTERVAL_MS = 1_000;

/** Two versions of a song within this many seconds are the same recording. */
const DURATION_TOLERANCE_SEC = 4;

export type Lyrics = {
  plain: string | null;
  /** LRC text with timings, when the database has them. */
  synced: string | null;
};

export type LyricsQuery = {
  title: string;
  artist: string | null;
  album: string | null;
  durationSec: number | null;
};

type LrcRecord = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

let nextRequestAt = 0;

async function get(path: string, signal?: AbortSignal): Promise<unknown | null> {
  const wait = nextRequestAt - Date.now();
  if (wait > 0) await sleep(wait, signal);
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

  try {
    return await request<unknown>(
      'LRCLIB',
      `${ENDPOINT}${path}`,
      { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
      signal
    );
  } catch (error) {
    // 404 is the ordinary answer for "no lyrics for this", not a failure.
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

function toLyrics(record: LrcRecord): Lyrics | null {
  // An instrumental is a real answer — there are no words — but there is
  // nothing to show, so it is treated as nothing found.
  if (record.instrumental) return null;
  if (!record.plainLyrics && !record.syncedLyrics) return null;
  return {
    plain: record.plainLyrics ?? null,
    synced: isSynced(record.syncedLyrics) ? record.syncedLyrics : null,
  };
}

const query = (params: Record<string, string | number | null | undefined>) =>
  Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

/**
 * The words for one track, or null when the database has none.
 *
 * Three attempts, narrowest first: the exact lookup with everything known, the
 * same without the album — releases get named differently and a mismatch there
 * loses an otherwise perfect hit — and finally a search, whose results are
 * filtered rather than trusted.
 */
export async function fetchLyrics(
  track: LyricsQuery,
  signal?: AbortSignal
): Promise<Lyrics | null> {
  if (!track.artist) return searchLyrics(track, signal);

  const duration = track.durationSec ? Math.round(track.durationSec) : null;
  /*
    The song's own name is tried before the tagged one. Files here are named
    `Artist - Title` and keep that in the title tag, which the exact lookup
    reads literally: `Ai Higuchi - Akuma no Ko` finds nothing where
    `Akuma no Ko` finds the words. The tagged title is still tried after, for
    the songs whose real name happens to contain a dash.
  */
  const titles = [bareTitle(track.title, track.artist), track.title];
  const names = [...new Set(titles)].map((track_name) => ({
    artist_name: track.artist,
    track_name,
  }));

  // Narrowing a lookup that had nothing to narrow it by asks the same question
  // twice: `query` drops empty values, so a track with no album builds the same
  // url with and without one, and a track with neither album nor duration
  // builds it three times. Comparing the finished urls is what catches that,
  // because it is the urls, not the intent, that are identical.
  const attempts = [
    ...names.map((name) => ({ ...name, album_name: track.album, duration })),
    ...names.map((name) => ({ ...name, duration })),
    ...names,
  ].map(query);

  for (const params of new Set(attempts)) {
    const found = (await get(`/get?${params}`, signal)) as LrcRecord | null;
    if (!found) continue;
    // An instrumental, or a record with neither kind of lyric, is an answer
    // about *that* entry and not about the song: LRCLIB holds several entries
    // per track and the next one along often has the words. Returning here is
    // what used to throw away the remaining attempts and the search with them.
    const lyrics = toLyrics(found);
    if (lyrics) return lyrics;
  }

  return searchLyrics(track, signal);
}

/**
 * The fallback: ask broadly, then refuse most of it.
 *
 * A search answers with whatever is closest, which for a track the database
 * does not have is still a list of other songs. Length is the deciding test —
 * the title and artist only have to be plausible.
 */
async function searchLyrics(
  track: LyricsQuery,
  signal?: AbortSignal
): Promise<Lyrics | null> {
  const params = track.artist
    ? { artist_name: track.artist, track_name: bareTitle(track.title, track.artist) }
    : { q: track.title };

  const results = ((await get(`/search?${query(params)}`, signal)) ?? []) as LrcRecord[];
  if (results.length === 0) return null;

  const wanted = track.durationSec ? Math.round(track.durationSec) : null;

  for (const record of results) {
    if (wanted != null) {
      if (record.duration == null) continue;
      if (Math.abs(record.duration - wanted) > DURATION_TOLERANCE_SEC) continue;
    }

    const asked = [track.artist, track.title].filter(Boolean).join(' ');
    if (matchScore(asked, { title: record.trackName, artist: record.artistName }) === 0) {
      continue;
    }

    const lyrics = toLyrics(record);
    if (lyrics) return lyrics;
  }

  return null;
}

/**
 * Every entry the database holds for this recording, for a caller that wants
 * one written a particular way.
 *
 * The catalogue files a Japanese song several times over: as it was written,
 * romanised, sometimes translated. The automatic lookup takes the first with
 * words in it, which is as likely to be the romanised one as not. This is the
 * same search with the same test — the length has to agree — but answers with
 * all that pass, and whoever asked picks by what the words are written in.
 *
 * Nothing at all for a track whose length is not known. Length is the only
 * thing here that tells a recording from another of the same name, and words
 * that are going to be laid line against line under somebody else's have to
 * be the same recording.
 */
export async function fetchLyricsVersions(
  track: LyricsQuery,
  signal?: AbortSignal
): Promise<Lyrics[]> {
  if (!track.durationSec) return [];
  const wanted = Math.round(track.durationSec);
  const title = bareTitle(track.title, track.artist);

  // By name and artist first, then by name alone: the entry in the original
  // writing is often filed under the artist's name in that writing too, where
  // an artist spelled in Latin letters does not find it.
  const searches = track.artist
    ? [{ artist_name: track.artist, track_name: title }, { track_name: title }]
    : [{ q: title }];

  const versions: Lyrics[] = [];
  const seen = new Set<number>();
  for (const params of searches) {
    const results = ((await get(`/search?${query(params)}`, signal)) ?? []) as LrcRecord[];
    for (const record of results) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      if (record.duration == null) continue;
      if (Math.abs(record.duration - wanted) > DURATION_TOLERANCE_SEC) continue;
      const lyrics = toLyrics(record);
      if (lyrics) versions.push(lyrics);
    }
    if (versions.length > 0) break;
  }
  return versions;
}

export type LyricsCandidate = {
  id: number;
  title: string;
  artist: string;
  album: string | null;
  durationSec: number | null;
  synced: boolean;
  lyrics: Lyrics;
};

/**
 * Everything the database has for a freely typed query, for a person to choose
 * from.
 *
 * Deliberately unfiltered, unlike the automatic path. That one refuses anything
 * whose length disagrees by more than a few seconds, which is what stops the
 * wrong take of a song being attached to it — and is also why a track whose
 * duration is recorded oddly never finds its words at all. Choosing by hand is
 * the way round that, so nothing is ruled out here; the reader can see the
 * lengths and decide.
 */
export async function findLyricsCandidates(
  search: string,
  signal?: AbortSignal
): Promise<LyricsCandidate[]> {
  const trimmed = search.trim();
  if (trimmed.length === 0) return [];

  // The same paced, deadlined request every other call here goes through.
  const results = ((await get(`/search?${query({ q: trimmed })}`, signal)) ?? []) as LrcRecord[];

  return results.flatMap((record) => {
    const lyrics = toLyrics(record);
    if (!lyrics) return [];
    return [{
      id: record.id,
      title: record.trackName,
      artist: record.artistName,
      album: record.albumName,
      durationSec: record.duration,
      synced: lyrics.synced !== null,
      lyrics,
    }];
  });
}
