import { pause, request, USER_AGENT } from '../metadata/http.ts';
import type { Candidate } from './rank.ts';

/**
 * ListenBrainz, asked what goes with what.
 *
 * Chosen over the better-known alternatives because it answers without an
 * account, a key or a registered application: the whole of this file is plain
 * GETs that work from a fresh install with nothing configured. The data is
 * built from what its users actually played — artists that keep turning up in
 * the same sittings — so the suggestions are listening habits rather than a
 * catalogue's idea of a genre.
 *
 * Its labs host carries the similarity indexes and the main host carries the
 * popularity ones; they are two services and the paths are not interchangeable.
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
 * A courtesy gap between calls.
 *
 * ListenBrainz publishes no hard limit for these, but a discovery run is a
 * burst of twenty-odd requests at a free service that asks nothing of anybody,
 * and taking it as fast as the socket allows is how a client gets a limit
 * published about it.
 */
const BETWEEN_MS = 250;

let nextAt = 0;

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const wait = nextAt - Date.now();
  if (wait > 0) await pause(wait, signal);
  nextAt = Date.now() + BETWEEN_MS;

  return request<T>(
    'ListenBrainz',
    url,
    { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
    signal
  );
}

type SimilarArtist = { artist_mbid?: string; name?: string; score?: number };

/**
 * Artists whose listeners also play this one, strongest first.
 *
 * An unknown artist is not an error: the index only holds names with enough
 * listens behind them to say anything about, and most of a personal library
 * will not be in it. That comes back as an empty list, which is an answer.
 */
export async function similarArtists(mbid: string, signal?: AbortSignal): Promise<Candidate[]> {
  const rows = await get<SimilarArtist[]>(
    `${LABS}/similar-artists/json?artist_mbids=${encodeURIComponent(mbid)}` +
      `&algorithm=${ARTIST_INDEX}`,
    signal
  );

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row.artist_mbid && row.name)
    .map((row) => ({ mbid: row.artist_mbid!, name: row.name!, score: row.score ?? 0 }));
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
};

type TopRecording = {
  recording_mbid?: string;
  recording_name?: string;
  artist_name?: string;
  release_name?: string;
  caa_id?: number;
  caa_release_mbid?: string;
};

/**
 * What an artist is most played for.
 *
 * The point of a recommendation is somewhere to start, and a name on its own
 * is not one. These are the songs of theirs that people actually play, so the
 * suggestion can be "this artist, and begin here".
 */
export async function topRecordings(
  mbid: string,
  limit: number,
  signal?: AbortSignal
): Promise<Recording[]> {
  const rows = await get<TopRecording[]>(
    `${API}/popularity/top-recordings-for-artist/${encodeURIComponent(mbid)}`,
    signal
  );
  return readRecordings(rows, limit);
}

type SimilarRecording = TopRecording & { artist_credit_name?: string };

function readRecordings(rows: unknown, limit: number): Recording[] {
  if (!Array.isArray(rows)) return [];
  return (rows as SimilarRecording[])
    .filter((row) => row.recording_mbid && row.recording_name)
    .slice(0, limit)
    .map((row) => ({
      mbid: row.recording_mbid!,
      title: row.recording_name!,
      artist: row.artist_credit_name ?? row.artist_name ?? '',
      release: row.release_name ?? null,
      caaId: row.caa_id ?? null,
      caaReleaseMbid: row.caa_release_mbid ?? null,
    }));
}

/**
 * Where the sleeve for a recommendation lives.
 *
 * The Cover Art Archive addresses pictures by release, and both endpoints hand
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
