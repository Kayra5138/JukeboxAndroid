import { headerOf, isThrottle, pacer, request, sleep, USER_AGENT } from '../metadata/http.ts';
import type { Candidate } from './rank.ts';

/**
 * ListenBrainz, asked what goes with what.
 *
 * Chosen over the better-known alternatives because it answers without an
 * account, a key or a registered application: the whole of this file is plain
 * requests that work from a fresh install with nothing configured. The data is
 * built from what its users actually played — artists that keep turning up in
 * the same sittings — so the suggestions are listening habits rather than a
 * catalogue's idea of a genre.
 *
 * Nothing about the listener is said in any of them. Every request names an
 * artist, a recording or a tag and nothing else, and none carries a token:
 * the account somebody may have connected for scrobbling is not used here.
 *
 * Its labs host carries the similarity indexes and the main host carries
 * everything else; they are two services and the paths are not interchangeable.
 *
 * What a build asks of it, since 13 October 2026: who is near each artist
 * somebody plays (one request an artist, on the labs host), how many people
 * play each of those neighbours (one request), and what else it knows of them
 * — their genres, and where Deezer keeps them (one or two). The radio further
 * down is no longer what a list is built on. It is asked only for an artist
 * Deezer has nothing for, one artist at a time, and its maintainers have said
 * it is to need a login (blog.metabrainz.org, 11 December 2025): when it
 * starts answering 401 that path is simply closed, and nothing else is.
 * `deezer.ts` says what goes to whom across all three services.
 *
 * ---------------------------------------------------------------------------
 * What each of them really answered, asked by hand on 9 October 2026 with this
 * app's User-Agent and no token. The shapes below are those answers, trimmed.
 * ---------------------------------------------------------------------------
 *
 * GET {API}/lb-radio/artist/{artist_mbid}
 *       ?mode=easy&max_similar_artists=12&max_recordings_per_artist=12
 *       &pop_begin=50&pop_end=100
 *
 *   200, about 20 KB. Every parameter is required: leaving one out is a 400
 *   that says which ("Argument max_similar_artists must be specified.").
 *
 *   { "<artist_mbid>": [
 *       { "recording_mbid": "…", "similar_artist_mbid": "<the same artist_mbid>",
 *         "similar_artist_name": "supercell", "total_listen_count": 38108 }, … ],
 *     … }
 *
 *   One key for each artist, the one asked about among them — so a single
 *   request brings songs by an artist somebody plays and songs by its
 *   neighbours. There are no titles: those are a second question, below. Which
 *   neighbours come back is drawn afresh on every request, and an artist with
 *   nothing in the band asked for is left out, so fewer than the maximum is
 *   normal.
 *
 *   The band is a share of each artist's own range and not a number of
 *   listens. Asked about 妖精帝國, a recording's `total_listen_count` came back
 *   between 6 296 and 16 340 for 85–100, between 370 and 5 665 for 60–85 and
 *   between 91 and 328 for 40–60, with every neighbour banded against its own
 *   catalogue the same way. Below about 40 it is the catalogue's lint: for
 *   0–100 most of what came back had been played once or twice, and was a
 *   concert recording or a karaoke track. For an artist with thousands of
 *   recordings the lint reaches higher (Radiohead at 30–70 was all under fifty
 *   listens), which is why a floor is applied on this side as well.
 *
 * GET {API}/lb-radio/tags?tag=j-pop&tag=symphonic%20metal&operator=and
 *       &pop_begin=40&pop_end=100&count=50
 *
 *   200, about 4 KB.
 *
 *   [ { "recording_mbid": "…", "percent": 47.53, "source": "release-group",
 *       "tag_count": 5 }, … ]
 *
 *   Recordings tagged with both (`and`) or either (`or`). `percent` is where
 *   the recording sits in the same kind of band; `source` is what carried the
 *   tag (the recording, its release group or its artist). A narrow pair simply
 *   gives fewer than were asked for — 31 for the two above. No titles here
 *   either.
 *
 * POST {API}/metadata/recording/
 *       { "recording_mbids": ["…", …], "inc": "artist tag release" }
 *
 *   200, about 2.5 KB a recording; 130 asked for at once came back as 129. An
 *   object keyed by recording id, and an id it does not know is simply absent.
 *
 *   { "<recording_mbid>": {
 *       "recording": { "name": "防人ノ歌", "length": 258226, … },
 *       "artist": { "name": "風鳴翼(CV:水樹奈々)", "artists": [
 *           { "artist_mbid": "…", "name": "風鳴翼", "join_phrase": "(CV:" }, … ] },
 *       "release": { "name": "…", "caa_id": 28626401491,
 *                    "caa_release_mbid": "…", "year": 2019, … },
 *       "tag": { "recording": [ { "tag": "ballad", "count": 1, "genre_mbid": "…" } ],
 *                "release_group": [ … ],
 *                "artist": [ { "artist_mbid": "…", "tag": "j-pop", "count": 2,
 *                              "genre_mbid": "…" }, … ] } } }
 *
 *   A tag with a `genre_mbid` is one of MusicBrainz's genres; one without is
 *   whatever somebody typed ("bristol sound", "seen live").
 *
 * POST {LABS}/similar-artists/json
 *       [ { "artist_mbids": ["…", "…"], "algorithm": "<ARTIST_INDEX>" } ]
 *
 *   200, about 20 KB an artist. The GET form takes one artist and answers a
 *   400 for a comma-separated list; this form takes several.
 *
 *   [ { "artist_mbid": "…", "name": "Pixies", "comment": "", "type": "Group",
 *       "gender": null, "score": 3144, "reference_mbid": "<one of those asked>" }, … ]
 *
 *   Up to a hundred for each artist asked about. An artist that is near two of
 *   them is given once or twice but always against the same `reference_mbid`,
 *   so this says how near a neighbour is and cannot be relied on to say to
 *   whom. Who led to whom is read off the radio answers instead.
 *
 * GET {API}/popularity/top-recordings-for-artist/{artist_mbid}
 *
 *   What the list was built from until now, and no longer something to build
 *   on. For Radiohead it answered 200 with 2 170 recordings in 1.4 MB, each
 *   with `total_listen_count` and `total_user_count`; for Sonic Youth and
 *   Sigur Rós, asked the same minute, it answered
 *
 *   401 { "code": 401, "error": "Due to bad actors and AI scrapers causing
 *         undue traffic on our sites, you need to provide an Auth token for
 *         this endpoint. Sorry for this mess." }
 *
 *   — so it works only for whoever somebody else has lately asked about.
 *   {@link topRecordings} is kept for what still calls it and is not part of
 *   building the list.
 *
 * GET {LABS}/similar-recordings/json?recording_mbids=…&algorithm=…
 *
 *   200, a hundred rows with titles, credits and sleeves. Not adopted: it has
 *   to be asked about a recording by its MusicBrainz id, which the library
 *   does not have for its files, and what came back for `Karma Police` was
 *   `Where Is My Mind?`, `Song 2`, `Wonderwall` and `Smells Like Teen Spirit`
 *   — the most played songs of the decade, which is the bias this is trying
 *   to get away from.
 *
 * POST {API}/popularity/artist
 *       { "artist_mbids": ["…", …] }
 *
 *   200, with no token (13 October 2026), for six hundred ids at once.
 *
 *   [ { "artist_mbid": "…", "total_listen_count": 807462, "total_user_count": 16528 }, … ]
 *
 *   An artist it has never counted comes back with nulls. The users are what
 *   the similarity score is divided by: the score is a count of sittings two
 *   artists shared, and everybody shares sittings with the most played artists
 *   there are. Undivided, AURORA's nearest were Billie Eilish, Lana Del Rey,
 *   Lorde, Coldplay and The Weeknd; divided by the neighbour's users to the
 *   power 0.6 they were Pomme, BROODS, Oh Wonder, Allie X and Sigrid.
 *
 * GET {API}/metadata/artist/?artist_mbids=…,…&inc=tag
 *
 *   200. One object an artist:
 *
 *   [ { "artist_mbid": "…", "name": "AURORA",
 *       "rels": { "free streaming": "https://www.deezer.com/artist/7699874", … },
 *       "tag": { "artist": [ { "tag": "art pop", "count": 9, "genre_mbid": "…" }, … ] } }, … ]
 *
 *   The Deezer address is MusicBrainz's own link for the artist, which is the
 *   one way from an id here to an id there that does not go through a search
 *   by name. Eighteen of twenty-three artists tried had one.
 *
 * Every answer from the main host carries `X-RateLimit-Limit: 30` with
 * `X-RateLimit-Remaining` and `X-RateLimit-Reset-In` (seconds, ten at most
 * when seen), and the documentation says a client over it is answered 429.
 */
const LABS = 'https://labs.api.listenbrainz.org';
const API = 'https://api.listenbrainz.org/1';

/**
 * Which index to read.
 *
 * The service exposes several and names them after how they were built, so the
 * string is a parameter rather than a sensible word. This is the widest one it
 * offers — twenty years of listens rather than six months — which is what a
 * personal library wants: a quiet artist with few listeners has nothing at all
 * in the short windows.
 *
 * Not a guess. The endpoints answer a 400 listing every name they accept, and
 * these are copied from that list; a name it does not know fails the whole
 * request rather than quietly falling back.
 */
const ARTIST_INDEX =
  'session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30';

/**
 * A gap between calls to one host.
 *
 * The main host says thirty to a window of about ten seconds, and this keeps
 * to twenty-five of them with nobody counting. Each host has its own line, as
 * each has its own limit: a build asks both at once, and neither waits on the
 * other.
 */
const BETWEEN_MS = 400;

/** The longest a refusal's "come back in" is believed for; past it the build goes on without. */
const LONGEST_WAIT_MS = 15_000;

const turns = { [API]: pacer(BETWEEN_MS), [LABS]: pacer(BETWEEN_MS) };

async function ask<T>(
  host: typeof API | typeof LABS,
  path: string,
  body: unknown,
  signal?: AbortSignal,
  again = true
): Promise<T> {
  await turns[host](signal);

  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    return await request<T>(
      'ListenBrainz',
      `${host}${path}`,
      body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) },
      signal
    );
  } catch (error) {
    // Told to slow down, and told for how long: waited out once, and asked
    // again. A second refusal is the answer, and says "throttled" to whoever
    // asked, which is a different thing from "nothing found".
    if (again && isThrottle(error)) {
      const seconds = Number(headerOf(error, 'X-RateLimit-Reset-In'));
      const wait = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 2_000;
      await sleep(Math.min(wait, LONGEST_WAIT_MS), signal);
      return ask<T>(host, path, body, signal, false);
    }
    throw error;
  }
}

type SimilarArtist = { artist_mbid?: string; name?: string; score?: number; reference_mbid?: string };

/**
 * Artists whose listeners also play this one, strongest first.
 *
 * An unknown artist is not an error: the index only holds names with enough
 * listens behind them to say anything about, and most of a personal library
 * will not be in it. That comes back as an empty list, which is an answer.
 */
export async function similarArtists(mbid: string, signal?: AbortSignal): Promise<Candidate[]> {
  const rows = await ask<SimilarArtist[]>(
    LABS,
    `/similar-artists/json?artist_mbids=${encodeURIComponent(mbid)}&algorithm=${ARTIST_INDEX}`,
    undefined,
    signal
  );

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row.artist_mbid && row.name)
    .map((row) => ({ mbid: row.artist_mbid!, name: row.name!, score: row.score ?? 0 }));
}

/** How near an artist is to something that was asked about: one for the nearest of all. */
export type Nearness = { name: string; similarity: number };

/**
 * The same question for several artists in one request, as nearness.
 *
 * The service's score is a count of sittings two artists shared, so it is
 * thousands for a famous pair and tens for an obscure one, and says nothing
 * across artists. Each is therefore divided by the largest score given against
 * the same artist: one is "as near as anything is to that one", and a half is
 * half as often heard with it.
 *
 * An artist near two of those asked about is kept at its nearer.
 */
export function readNearness(rows: unknown): Map<string, Nearness> {
  const list = (Array.isArray(rows) ? rows : []) as SimilarArtist[];
  const top = new Map<string, number>();
  for (const row of list) {
    const reference = row.reference_mbid ?? '';
    top.set(reference, Math.max(top.get(reference) ?? 0, row.score ?? 0));
  }

  const near = new Map<string, Nearness>();
  for (const row of list) {
    if (!row.artist_mbid || !row.name) continue;
    const most = top.get(row.reference_mbid ?? '') ?? 0;
    const similarity = most > 0 ? Math.min(1, Math.max(0, (row.score ?? 0) / most)) : 0;
    const already = near.get(row.artist_mbid);
    if (!already || similarity > already.similarity) {
      near.set(row.artist_mbid, { name: row.name, similarity });
    }
  }
  return near;
}

export async function nearnessTo(mbids: string[], signal?: AbortSignal): Promise<Map<string, Nearness>> {
  if (!mbids.length) return new Map();
  const rows = await ask<unknown>(
    LABS,
    '/similar-artists/json',
    [{ artist_mbids: mbids, algorithm: ARTIST_INDEX }],
    signal
  );
  return readNearness(rows);
}

/**
 * A stretch of every artist's own range, from its least played to its most.
 *
 * Not a number of listens: forty to sixty is the middle of a small band's
 * catalogue and the middle of a stadium act's, and those are three hundred
 * listens and thirty thousand.
 */
export type Band = { begin: number; end: number };

/** One artist of a radio answer, with the recordings drawn for it. */
export type RadioArtist = {
  mbid: string;
  name: string;
  recordings: { mbid: string; listens: number }[];
};

type RadioRow = {
  recording_mbid?: string;
  similar_artist_mbid?: string;
  similar_artist_name?: string;
  total_listen_count?: number;
};

export function readRadio(body: unknown): RadioArtist[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const artists: RadioArtist[] = [];

  for (const [mbid, rows] of Object.entries(body as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue;
    const seen = new Set<string>();
    const recordings: RadioArtist['recordings'] = [];
    let name = '';
    for (const row of rows as RadioRow[]) {
      name ||= row.similar_artist_name ?? '';
      if (!row.recording_mbid || seen.has(row.recording_mbid)) continue;
      seen.add(row.recording_mbid);
      recordings.push({ mbid: row.recording_mbid, listens: row.total_listen_count ?? 0 });
    }
    if (name && recordings.length) artists.push({ mbid, name, recordings });
  }
  return artists;
}

/**
 * An artist and its neighbours, each with a handful of recordings from one
 * stretch of its range.
 *
 * This is what makes a build a dozen requests and not seventy. It used to be
 * one request for an artist's neighbours and then one more for every
 * neighbour's songs; this is both, for one artist somebody plays, in one
 * answer, and with the songs already drawn from the part of the range that
 * was asked for and not from the top of it.
 *
 * `easy` is the service's word for the nearest of the neighbours. The other
 * two reach further out, to artists that share less with the one asked about
 * than this has any way of explaining to somebody.
 */
export async function artistRadio(
  mbid: string,
  band: Band,
  size: { artists: number; recordings: number },
  signal?: AbortSignal
): Promise<RadioArtist[]> {
  const body = await ask<unknown>(
    API,
    `/lb-radio/artist/${encodeURIComponent(mbid)}?mode=easy` +
      `&max_similar_artists=${size.artists}&max_recordings_per_artist=${size.recordings}` +
      `&pop_begin=${band.begin}&pop_end=${band.end}`,
    undefined,
    signal
  );
  return readRadio(body);
}

/** A recording that carries the tags asked about, and where it sits in the band. */
export type TaggedRecording = { mbid: string; percent: number };

export function readTagRadio(body: unknown): TaggedRecording[] {
  if (!Array.isArray(body)) return [];
  const seen = new Set<string>();
  return (body as { recording_mbid?: string; percent?: number }[])
    .filter((row) => {
      if (!row.recording_mbid || seen.has(row.recording_mbid)) return false;
      seen.add(row.recording_mbid);
      return true;
    })
    .map((row) => ({ mbid: row.recording_mbid!, percent: row.percent ?? 0 }));
}

/**
 * Recordings tagged with all of these, or with any of them.
 *
 * Asked of recordings and not of artists, which is the difference from what
 * this replaced. A search of MusicBrainz for artists tagged `rock` and `j-pop`
 * gave the fifteen its search engine thought the best match for the words,
 * and then those artists' most played songs, whatever they were tagged. This
 * gives songs that are themselves the two things, from the stretch of the
 * range that was asked for.
 */
export async function tagRadio(
  tags: string[],
  operator: 'and' | 'or',
  band: Band,
  count: number,
  signal?: AbortSignal
): Promise<TaggedRecording[]> {
  if (!tags.length) return [];
  const body = await ask<unknown>(
    API,
    `/lb-radio/tags?${tags.map((tag) => `tag=${encodeURIComponent(tag)}`).join('&')}` +
      `&operator=${operator}&pop_begin=${band.begin}&pop_end=${band.end}&count=${count}`,
    undefined,
    signal
  );
  return readTagRadio(body);
}

/** One song, with enough to find it again and a picture to show it by. */
export type Recording = {
  mbid: string;
  title: string;
  artist: string;
  release: string | null;
  /** Cover Art Archive id, which is how the sleeve is addressed. */
  caaId: number | null;
  caaReleaseMbid: string | null;
  durationSec: number | null;
  tags: string[];
  /** Everybody in the credit, in the order it is written. Absent where the answer did not say. */
  artists?: { mbid: string; name: string }[];
};

type Tag = { tag?: string; count?: number; genre_mbid?: string };

type Details = {
  recording?: { name?: string; length?: number | null };
  artist?: { name?: string; artists?: { artist_mbid?: string; name?: string }[] };
  release?: { name?: string; caa_id?: number | null; caa_release_mbid?: string | null } | null;
  tag?: { recording?: Tag[]; release_group?: Tag[]; artist?: Tag[] };
};

/** How many tags a song is given. Past this they describe the artist's whole career. */
const TAGS_KEPT = 5;

/**
 * A recording's genres, the nearest to the song first.
 *
 * What somebody tagged the recording itself says most about it, the record it
 * is on says a little less, and the artist's tags are true of everything they
 * ever made. Within each, the tag more people agreed on comes first. Only
 * MusicBrainz's own genres are kept: the rest is `seen live` and `female
 * vocals`, and these end up as the song's tags if it is kept.
 */
function genresOf(tag: Details['tag']): string[] {
  const ordered: string[] = [];
  for (const level of [tag?.recording, tag?.release_group, tag?.artist]) {
    const genres = (level ?? [])
      .filter((entry) => entry.tag && entry.genre_mbid)
      .sort((left, right) => (right.count ?? 0) - (left.count ?? 0));
    for (const entry of genres) if (!ordered.includes(entry.tag!)) ordered.push(entry.tag!);
  }
  return ordered.slice(0, TAGS_KEPT);
}

export function readDetails(body: unknown): Map<string, Recording> {
  const found = new Map<string, Recording>();
  if (!body || typeof body !== 'object' || Array.isArray(body)) return found;

  for (const [mbid, value] of Object.entries(body as Record<string, Details | null>)) {
    const title = value?.recording?.name;
    const artist = value?.artist?.name;
    if (!title || !artist) continue;
    found.set(mbid, {
      mbid,
      title,
      artist,
      release: value.release?.name ?? null,
      caaId: value.release?.caa_id ?? null,
      caaReleaseMbid: value.release?.caa_release_mbid ?? null,
      durationSec: value.recording?.length ? value.recording.length / 1000 : null,
      tags: genresOf(value.tag),
      artists: (value.artist?.artists ?? [])
        .filter((entry) => entry.artist_mbid && entry.name)
        .map((entry) => ({ mbid: entry.artist_mbid!, name: entry.name! })),
    });
  }
  return found;
}

/**
 * How many recordings are asked about at once.
 *
 * A hundred and thirty were answered in one go when tried; a hundred leaves
 * room, and is a quarter of a megabyte, which is as much as one answer on a
 * phone's connection ought to be.
 */
export const DETAILS_AT_ONCE = 100;

/**
 * What the radio answers leave out: what each recording is called, who it is
 * by, what it is on and what it is tagged.
 *
 * A recording the service has no details for is absent from the answer, and
 * is then not a song anybody can be shown.
 */
export async function recordingDetails(
  mbids: string[],
  signal?: AbortSignal
): Promise<Map<string, Recording>> {
  if (!mbids.length) return new Map();
  const body = await ask<unknown>(
    API,
    '/metadata/recording/',
    { recording_mbids: mbids, inc: 'artist tag release' },
    signal
  );
  return readDetails(body);
}

type TopRecording = {
  recording_mbid?: string;
  recording_name?: string;
  artist_name?: string;
  artist_credit_name?: string;
  release_name?: string;
  caa_id?: number;
  caa_release_mbid?: string;
  length?: number;
  tags?: Tag[];
};

/**
 * What an artist is most played for.
 *
 * Not asked while building the list any more — see the top of the file for
 * why: it is the most played and nothing else, it is a megabyte for an artist
 * with a long career, and it now refuses anybody without a token for most
 * artists. Kept because it is still a true answer when it is given.
 */
export async function topRecordings(
  mbid: string,
  limit: number,
  signal?: AbortSignal
): Promise<Recording[]> {
  const rows = await ask<TopRecording[]>(
    API,
    `/popularity/top-recordings-for-artist/${encodeURIComponent(mbid)}`,
    undefined,
    signal
  );
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row.recording_mbid && row.recording_name)
    .slice(0, limit)
    .map((row) => ({
      mbid: row.recording_mbid!,
      title: row.recording_name!,
      artist: row.artist_credit_name ?? row.artist_name ?? '',
      release: row.release_name ?? null,
      caaId: row.caa_id ?? null,
      caaReleaseMbid: row.caa_release_mbid ?? null,
      durationSec: row.length ? row.length / 1000 : null,
      tags: (row.tags ?? []).filter((tag) => !!tag.genre_mbid && !!tag.tag).map((tag) => tag.tag!),
    }));
}

/**
 * Where the sleeve for a recommendation lives.
 *
 * The Cover Art Archive addresses pictures by release, and the answers hand
 * back the release the picture belongs to beside the id of the picture itself.
 * 250 pixels because these are list thumbnails and the originals are scans
 * running to several megabytes each.
 *
 * Its own host rather than the storage behind it: this answers a redirect to
 * wherever the file currently sits, which is the supported way in and the only
 * one that keeps working when the archive moves things.
 */
export function coverUrl(recording: Recording): string | null {
  if (recording.caaId == null || !recording.caaReleaseMbid) return null;
  return `https://coverartarchive.org/release/${recording.caaReleaseMbid}/${recording.caaId}-250.jpg`;
}

/**
 * How many people play each of these artists, by id.
 *
 * An artist the service has never counted is absent, and is then somebody
 * whose nearness cannot be weighed against how well known they are.
 */
export function readPopularity(body: unknown): Map<string, number> {
  const users = new Map<string, number>();
  for (const row of (Array.isArray(body) ? body : []) as { artist_mbid?: string; total_user_count?: number | null }[]) {
    if (row?.artist_mbid && typeof row.total_user_count === 'number' && row.total_user_count > 0) {
      users.set(row.artist_mbid, row.total_user_count);
    }
  }
  return users;
}

/** How many ids go in one question. Six hundred were answered at once when tried. */
export const POPULARITY_AT_ONCE = 500;

export async function artistPopularity(mbids: string[], signal?: AbortSignal): Promise<Map<string, number>> {
  const users = new Map<string, number>();
  for (let at = 0; at < mbids.length; at += POPULARITY_AT_ONCE) {
    const body = await ask<unknown>(
      API,
      '/popularity/artist',
      { artist_mbids: mbids.slice(at, at + POPULARITY_AT_ONCE) },
      signal
    );
    for (const [mbid, count] of readPopularity(body)) users.set(mbid, count);
  }
  return users;
}

/** What else is known of an artist: where Deezer keeps them, and their genres, the most agreed first. */
export type ArtistFacts = { deezerId: number | null; tags: string[] };

type FactsRow = {
  artist_mbid?: string;
  rels?: Record<string, unknown>;
  tag?: { artist?: Tag[] };
};

const DEEZER_ARTIST = /deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/;

export function readFacts(body: unknown): Map<string, ArtistFacts> {
  const facts = new Map<string, ArtistFacts>();
  for (const row of (Array.isArray(body) ? body : []) as FactsRow[]) {
    if (!row?.artist_mbid) continue;
    let deezerId: number | null = null;
    for (const link of Object.values(row.rels ?? {})) {
      const found = typeof link === 'string' ? DEEZER_ARTIST.exec(link) : null;
      if (found) deezerId = Number(found[1]);
    }
    const tags = (row.tag?.artist ?? [])
      .filter((entry) => entry.tag && entry.genre_mbid)
      .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))
      .map((entry) => entry.tag!)
      .filter((tag, index, all) => all.indexOf(tag) === index)
      .slice(0, TAGS_KEPT);
    facts.set(row.artist_mbid, { deezerId, tags });
  }
  return facts;
}

/** As many as make an address of a sensible length. */
export const FACTS_AT_ONCE = 25;

export async function artistFacts(mbids: string[], signal?: AbortSignal): Promise<Map<string, ArtistFacts>> {
  const facts = new Map<string, ArtistFacts>();
  for (let at = 0; at < mbids.length; at += FACTS_AT_ONCE) {
    const body = await ask<unknown>(
      API,
      `/metadata/artist/?artist_mbids=${mbids.slice(at, at + FACTS_AT_ONCE).join(',')}&inc=tag`,
      undefined,
      signal
    );
    for (const [mbid, fact] of readFacts(body)) facts.set(mbid, fact);
  }
  return facts;
}
