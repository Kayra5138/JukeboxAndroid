import { fromItunesGenre } from './genres.ts';
import { isAbortError, isNetworkError, pause, statusOf } from './http.ts';
import { lookupTrack as lookupItunes } from './itunes.ts';
import { lookupTrack as lookupMusicBrainz } from './musicbrainz.ts';
import type { TrackMetadata } from '../db/metadata.ts';
import type { TagSource } from '../db/tags.ts';
import type { Track } from '../types.ts';

/**
 * A large library takes hours on its first pass, because Apple allows only
 * about twenty requests a minute. That is why every result is written as it
 * arrives and already-known tracks are skipped on the next run. The pacing
 * itself lives in the iTunes client, since one track can cost several requests.
 */

/** Back off rather than burning through the queue writing false misses. */
const RATE_LIMIT_BACKOFF_MS = 60_000;

/** A moment between retries, so a blink of a connection is not a verdict. */
const NETWORK_RETRY_MS = 2_000;

/**
 * How many tracks in a row may fail to reach the network before the pass is
 * called off. One failure is a dropped packet; three in a row is a device with
 * no connection, and grinding through a thousand tracks at a minute each to
 * discover that is worse than saying so.
 */
const OFFLINE_STRIKES = 3;

export type EnrichProgress = {
  phase?: 'metadata' | 'artwork';
  done: number;
  total: number;
  matched: number;
  /** Set while waiting out a rate limit, so the interface can say so. */
  throttled: boolean;
  /**
   * Set on the final update when the pass gave up because nothing could be
   * reached. It is mutually exclusive with `throttled` — one means "the service
   * asked us to wait", the other "there is no network" — and it is always the
   * last progress reported, so an interface should show it as an outcome rather
   * than as a state the run will come back from.
   */
  offline?: boolean;
};

export type EnrichResult = {
  coversSaved?: number;
  matched: number;
  missed: number;
  cancelled: boolean;
  /** Why the pass stopped short of the end of the queue, when it did. */
  stopped?: 'offline';
};

/**
 * The database, as this loop uses it.
 *
 * Passed in rather than imported so the loop can be exercised without SQLite
 * behind it; `enrich.ts` wires up the real tables and is the entry point
 * everything else calls.
 */
export type EnrichStore = {
  filterUnenriched: (trackIds: string[]) => string[];
  manualTrackIds: () => Set<string>;
  saveMetadata: (entry: TrackMetadata) => void;
  saveLookupTags: (trackId: string, tags: string[], source: TagSource) => void;
};

type Found = Omit<TrackMetadata, 'trackId' | 'status' | 'source'> & {
  /**
   * Narrower than the `string | null` the metadata row stores it in: a result
   * exists because one of the two catalogues answered, and saying so here is
   * what lets the tags be filed under the same source without re-deriving it.
   */
  source: 'musicbrainz' | 'itunes';
  /** Ranked, best first. The first also becomes the genre column.  */
  tags: string[];
};

/**
 * MusicBrainz first, Apple second.
 *
 * The order matters more than it looks. MusicBrainz pins the search to a
 * resolved artist id, so another performer's cover cannot come back at all —
 * and its aliases mean a band filed as 妖精帝國 is still found by searching for
 * `Yousei Teikoku`. Apple searches free text across everything, which for
 * anime and game music returns a wall of covers, remixes and instrumentals by
 * people who did not make the recording.
 *
 * Apple still earns its place second: it covers mainstream and Turkish releases
 * that MusicBrainz has no genre for, and it is the only free source that labels
 * Turkish music as such rather than flattening it to `Pop`.
 *
 * Finding the recording is not the same as finding a genre, and MusicBrainz
 * recordings carry no genre and no tags at any level far more often than not.
 * A hit like that used to end the search and be written down as a match with
 * genre, album and artwork all null — permanently, since a track with a row is
 * never looked at again. So the hit alone is not enough to stop here: Apple is
 * asked anyway, and the bare MusicBrainz record is only the answer when Apple
 * has nothing either.
 */
async function lookup(track: Track, signal?: AbortSignal): Promise<Found | null> {
  const musicbrainz = await lookupMusicBrainz(track, signal);
  const found: Found | null = musicbrainz
    ? {
        source: 'musicbrainz',
        title: musicbrainz.title,
        artist: musicbrainz.artist,
        album: null,
        genre: musicbrainz.genres[0] ?? null,
        year: musicbrainz.year,
        artworkUrl: null,
        // MusicBrainz is asked about the recording, not about the release it
        // appears on, so it has nothing to say about where that is.
        trackNumber: null,
        discNumber: null,
        tags: musicbrainz.genres,
      }
    : null;

  if (found && found.tags.length > 0) return found;

  const itunes = await lookupItunes(track, signal);
  if (itunes) {
    // Apple gives exactly one label per track, so there is no ranking to keep —
    // but it is Apple's word for the genre, and it goes into the same column
    // MusicBrainz writes to, where `hip-hop/rap` beside `hip hop` is one genre
    // counted as two.
    const tags = itunes.genre ? fromItunesGenre(itunes.genre) : [];
    return {
      source: 'itunes',
      title: itunes.title,
      artist: itunes.artist,
      album: itunes.album,
      genre: tags[0] ?? null,
      // MusicBrainz dates the recording; Apple dates the release it is selling,
      // which for a reissue is decades late. Prefer the earlier authority.
      year: found?.year ?? itunes.year,
      artworkUrl: itunes.artworkUrl,
      trackNumber: itunes.trackNumber,
      discNumber: itunes.discNumber,
      tags,
    };
  }

  return found;
}

/**
 * Whether a result says anything worth writing down.
 *
 * The pass exists to produce genre statistics, so a record naming no genre has
 * answered the question that was asked — unless it brought an album or artwork,
 * which nothing else supplies and which the library shows.
 *
 * What is left is recorded as a miss rather than as a match, and that is the
 * whole point: `filterUnenriched` skips any track that has a row at all, so a
 * `matched` row with nothing in it is final. A miss is not — `clearMisses` can
 * take it back, and the tags MusicBrainz is missing today are the sort that get
 * contributed next year.
 */
function isUseful(found: Found): boolean {
  return found.tags.length > 0 || found.album != null || found.artworkUrl != null;
}

function miss(trackId: string): TrackMetadata {
  return {
    trackId,
    status: 'not_found',
    source: null,
    title: null,
    artist: null,
    album: null,
    genre: null,
    year: null,
    artworkUrl: null,
    trackNumber: null,
    discNumber: null,
  };
}

/**
 * Look up everything not looked up before. Safe to stop and restart: progress
 * lives in the database, not in this function.
 *
 * Never rejects. Every way this can end — a stop, a dead network, a service
 * refusing to talk — comes back as a resolved `EnrichResult`, because the only
 * caller is a screen with a Stop button on it and a rejection from here would
 * be an unhandled one.
 */
export async function runEnrichment(
  tracks: Track[],
  onProgress: (progress: EnrichProgress) => void,
  signal: AbortSignal | undefined,
  store: EnrichStore
): Promise<EnrichResult> {
  // Hand-written entries are excluded even when explicitly selected: an edit is
  // an answer, not a guess waiting to be improved on.
  const edited = store.manualTrackIds();
  const pendingIds = new Set(store.filterUnenriched(tracks.map((track) => track.id)));
  const pending = tracks.filter(
    (track) => pendingIds.has(track.id) && !edited.has(track.id)
  );

  let matched = 0;
  let missed = 0;
  let unreachable = 0;

  for (const [index, track] of pending.entries()) {
    if (signal?.aborted) return { matched, missed, cancelled: true };
    onProgress({ done: index, total: pending.length, matched, throttled: false });

    try {
      const match = await lookup(track, signal);
      unreachable = 0;

      if (match && isUseful(match)) {
        const { tags, ...metadata } = match;
        matched += 1;
        store.saveMetadata({ trackId: track.id, status: 'matched', ...metadata });
        store.saveLookupTags(track.id, tags, metadata.source);
      } else {
        missed += 1;
        store.saveMetadata(miss(track.id));
      }
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        return { matched, missed, cancelled: true };
      }

      // Nothing reachable. Nothing is written either, so whenever the device
      // has a connection again this track is still waiting to be tried.
      if (isNetworkError(error)) {
        unreachable += 1;
        if (unreachable >= OFFLINE_STRIKES) {
          onProgress({
            done: index,
            total: pending.length,
            matched,
            throttled: false,
            offline: true,
          });
          return { matched, missed, cancelled: false, stopped: 'offline' };
        }
        await pause(NETWORK_RETRY_MS, signal);
        continue;
      }
      unreachable = 0;

      // A refusal that is not a throttle, or an answer that would not parse:
      // the service was reached and had nothing usable to say about this track.
      // Waiting a minute changes none of that, so it counts as a miss and the
      // queue keeps moving.
      const status = statusOf(error);
      if (status === null || (status >= 400 && status < 500 && status !== 429)) {
        missed += 1;
        store.saveMetadata(miss(track.id));
        continue;
      }

      // 429 and the 5xx range mean "later". Nothing is written for this track,
      // so the next pass retries it.
      onProgress({ done: index, total: pending.length, matched, throttled: true });
      await pause(RATE_LIMIT_BACKOFF_MS, signal);
      if (signal?.aborted) return { matched, missed, cancelled: true };
    }
  }

  onProgress({ done: pending.length, total: pending.length, matched, throttled: false });
  return { matched, missed, cancelled: false };
}
