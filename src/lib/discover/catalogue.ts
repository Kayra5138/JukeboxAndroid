import { db, readSetting } from '../db/index.ts';
import { knownArtistId, rememberArtistId } from '../db/discover.ts';
import { allTags } from '../db/tags.ts';
import { strings, type Strings } from '../i18n/languages.ts';
import { splitCredit } from '../metadata/credit.ts';
import { isGenre } from '../metadata/genres.ts';
import { isAbortError } from '../metadata/http.ts';
import { MIN_ARTIST_SCORE, musicBrainzGet } from '../metadata/musicbrainz.ts';
import type { Track } from '../types.ts';
import { exclusionRows } from './feedback.ts';
import { relatedArtists, searchArtists, topTracks } from './deezer.ts';
import {
  artistFacts,
  artistPopularity,
  artistRadio,
  recordingDetails,
  similarArtists,
  tagRadio,
} from './listenbrainz.ts';
import {
  DAY,
  DEFAULT_SETTINGS,
  popularityOf,
  tagMix,
  tasteProfile,
  type Listen,
  type Popularity,
  type Skip,
} from './policy.ts';
import {
  buildFaultOf,
  closing,
  gatherPool,
  memoryCache,
  remembering,
  type AnswerCache,
  type BuildReport,
  type Gathered,
  type Sources,
  type Step,
  type TagSearch,
} from './pool.ts';
import { ownedArtists } from './rank.ts';
import {
  ARTIST_REASON,
  byArtist,
  chooseSeeds,
  feedbackFrom,
  isEarlySkip,
  standings,
  type Feedback,
} from './taste.ts';
import { readIssued, type Issued } from './songs.ts';
import { looseSongKey } from './variants.ts';

/**
 * The pool, built from this phone's library and history and from the two
 * catalogues.
 *
 * This is the one place where the pieces meet what they are about. What
 * somebody plays and what they said about earlier suggestions are read out of
 * the database here; who to start from is `taste.ts`'s to say, what to ask
 * and what to make of the answers is `pool.ts`'s, and which of the songs go on
 * the list is `selectSongs`'s, later. Each of those is arithmetic that runs on
 * a desk. This file is the part that cannot.
 *
 * The taste is the phone's own and stays on it. What leaves is the names of
 * artists, to MusicBrainz for their ids; those ids, to ListenBrainz; and
 * artists' names and Deezer's own ids for them, to Deezer — the same as a
 * search typed into any of the three sites. `deezer.ts` says it in full, and
 * what Deezer's terms have to say about being asked.
 */

type Artist = { id: string; name: string; score?: number };

/**
 * Names the catalogue was asked about during this run of the app and had
 * nobody for.
 *
 * A miss is written to the database as well, and is deliberately not believed
 * from there: the catalogue gains artists, and a name that was not in it last
 * year must not be shut out for good. But asking again on every build cost a
 * request and a second and a half for each name that was never going to be
 * there, every time. So a miss is believed for as long as the app stays open.
 */
const missed = new Set<string>();

async function resolve(name: string, now: number, signal?: AbortSignal): Promise<string | null> {
  const cached = knownArtistId(name);
  if (cached) return cached;
  if (missed.has(name)) return null;

  const data = await musicBrainzGet<{ artists?: Artist[] }>(
    `/artist/?query=${encodeURIComponent(name)}&fmt=json&limit=1`,
    signal
  );
  const first = data.artists?.[0];
  const id = first && (first.score ?? 0) >= MIN_ARTIST_SCORE ? first.id : null;
  rememberArtistId(name, id, now);
  if (!id) missed.add(name);
  return id;
}

/** What the catalogues answered lately, for as long as the app stays open. */
const answers = memoryCache();

/** Whether ListenBrainz's radio has refused for want of a login, which it then goes on doing. */
const radioDoor = { closed: false };

/**
 * What each of these recordings was issued on.
 *
 * One search for many ids, which is the one way MusicBrainz answers about
 * several recordings in a request: each comes back with its releases, and
 * each release with its status and what kind of record it is. Through the
 * same paced door as everything else asked of MusicBrainz.
 */
async function issuedOn(mbids: string[], signal?: AbortSignal): Promise<Map<string, Issued>> {
  if (!mbids.length) return new Map();
  const query = encodeURIComponent(`rid:(${mbids.join(' OR ')})`);
  return readIssued(await musicBrainzGet<unknown>(`/recording/?query=${query}&limit=100&fmt=json`, signal));
}

export type BuildOptions = {
  /** Which end of each artist's range to draw from. Left out, the stored setting. */
  popularity?: Popularity;
  /**
   * What this build's chance is drawn from. Left out, the time of the build,
   * so that each build is its own edition. Handing in a list's own refresh
   * time instead makes a rebuild of that list gather the same songs.
   */
  edition?: string | number;
  /** How many artists to start from. Left out, six, or eight for a list longer than twenty. */
  seeds?: number;
  /** Somewhere that outlasts the app to keep the catalogues' answers; see `remembering`. */
  cache?: AnswerCache;
  /** How far along: so many of the artists started from have answered. */
  onStep?: (step: Step) => void;
  /** What became of the requests, said once at the end, whether or not there is a pool. */
  onReport?: (report: BuildReport) => void;
  /** The five questions, for a test that is not to ask anybody anything. */
  sources?: Sources;
};

/**
 * The songs to choose a Discover list from.
 *
 * Fails with a sentence in the language asked for and, where the failure is
 * one of the three a caller might treat differently — no network, told to
 * slow down, nothing found — with that said beside it: `buildFaultOf(error)`
 * reads it. One artist or one request failing fails nothing; it is a smaller
 * pool and a number in the report.
 */
export async function buildPool(
  library: Track[],
  now: number,
  onProgress: (text: string) => void,
  signal?: AbortSignal,
  t: Strings = strings(),
  options: BuildOptions = {}
): Promise<Gathered[]> {
  const said = t.discover.gathering;
  const stored = storedSettings();
  const popularity = options.popularity ?? popularityOf(stored);
  const count = typeof stored.count === 'number' ? stored.count : DEFAULT_SETTINGS.count;
  const limit = options.seeds ?? (count > 20 ? 8 : 6);
  const edition = options.edition ?? now;

  const tags = new Map(
    [...allTags()].map(([id, values]) => [id, values.map((value) => value.tag).filter(isGenre)])
  );
  const plays = db().getAllSync<Listen>(
    `SELECT track_id, artist, started_at, seconds_played, completed
       FROM plays WHERE started_at >= ? AND started_at <= ?`,
    now - 30 * DAY,
    now
  );
  const skips = db().getAllSync<Skip>(
    `SELECT artist, started_at, seconds_played, duration_sec
       FROM skips WHERE started_at >= ? AND started_at <= ?`,
    now - 30 * DAY,
    now
  );
  // One sitting capped at ten minutes here too, for the reason the profile caps it.
  const ever = db().getAllSync<{ artist: string | null; seconds: number }>(
    `SELECT artist, SUM(MIN(seconds_played, 600)) AS seconds
       FROM plays WHERE artist IS NOT NULL AND started_at <= ? GROUP BY artist`,
    now
  );
  const rows = exclusionRows();

  const profile = tasteProfile(plays, skips, tags, now);
  // Nothing played lately, and the tags are the library's own instead.
  const mix = profile.tags.length
    ? profile
    : tagMix(library.map((track) => [tags.get(track.id) ?? [], 1]));

  /*
    What was said, from three places: the table of songs kept and sent away,
    the skips, and the plays heard to the end. The last two are every artist's
    and not only the library's — a Discover song played from the list is in
    the history like any other, under an artist the library does not have, and
    that is exactly the listening this is for.
  */
  const feedback: Feedback[] = [
    ...feedbackFrom(rows),
    ...skips
      .filter(isEarlySkip)
      .map((skip) => ({ kind: 'skipped' as const, artist: skip.artist ?? '', at: skip.started_at })),
    ...plays
      .filter((play) => play.completed)
      .map((play) => ({ kind: 'finished' as const, artist: play.artist ?? '', at: play.started_at })),
  ];
  const standing = standings(feedback, now);

  const seeds = chooseSeeds({
    recent: profile.artists,
    kept: feedbackFrom(rows).filter((event) => event.kind === 'kept').map((event) => event.artist),
    allTime: byArtist(ever, (row) => row.artist, (row) => row.seconds ?? 0, splitCredit).map((row) => ({
      name: row.name,
      seconds: row.amount,
    })),
    library: byArtist(library, (track) => track.artist, () => 1, splitCredit).map((row) => ({
      name: row.name,
      tracks: row.amount,
    })),
    standings: standing,
    limit,
    edition,
  });

  /*
    Two tags at a time, the pairs that turn up together on what was played.
    One tag at a time is asking a catalogue for "rock", and what comes back
    for that is the same for everybody. Both at once is the songs that sit
    where this listener's tastes meet. A single tag is only fallen back on
    where there are not pairs enough to ask about — and with nobody to start
    from, the tags are all there is, so a third question is asked.
  */
  const searches: TagSearch[] = mix.pairs.map((pair) => ({
    label: pair.join(' + '),
    tags: [...pair],
    operator: 'and' as const,
  }));
  const most = seeds.length ? 2 : 3;
  for (const tag of mix.tags) {
    if (searches.length < most) searches.push({ label: tag, tags: [tag], operator: 'or' });
  }
  searches.length = Math.min(searches.length, most);

  // Nobody to start from and no tags either: a library with nothing in it that
  // can be gone on. Said in the sentence the engine already knows this by.
  if (!seeds.length && !searches.length) {
    throw Object.assign(new Error(t.discover.engine.needsTaste), { discover: 'taste' });
  }

  const blockedIds = new Set(
    rows
      .filter((row) => row.reason === ARTIST_REASON && row.song_key.startsWith('artist-mbid:'))
      .map((row) => row.song_key.slice('artist-mbid:'.length))
  );

  const asked: Sources = options.sources ??
    remembering(
      closing(
        {
          resolve: (name, stop) => resolve(name, now, stop),
          similar: similarArtists,
          popularity: artistPopularity,
          facts: artistFacts,
          find: searchArtists,
          related: relatedArtists,
          top: topTracks,
          radio: artistRadio,
          details: recordingDetails,
          issued: issuedOn,
          tagged: tagRadio,
        },
        radioDoor
      ),
      options.cache ?? answers,
      () => Date.now()
    );

  try {
    return await gatherPool(
      {
        seeds,
        searches,
        weights: mix.weights,
        owned: ownedArtists([...library, ...plays]),
        ownedSongs: new Set(library.map((track) => looseSongKey(track))),
        standings: standing,
        blockedIds,
        popularity,
        edition,
        count,
      },
      asked,
      {
        signal,
        onStep: (step) => {
          // Whose neighbours are being found is worth saying. Whose songs are being asked for is forty names a second.
          if (step.phase !== 'songs') onProgress(said.around(step.artist, step.done, step.total));
          options.onStep?.(step);
        },
        onNaming: () => onProgress(said.naming),
        onReport: options.onReport,
      }
    );
  } catch (error) {
    if (isAbortError(error)) throw error;
    const fault = buildFaultOf(error);
    if (!fault) throw error;
    // The same mark, on an error that can be shown as it is.
    throw Object.assign(new Error(fault === 'unreachable' ? t.discover.engine.nothingFetched : said[fault]), { discover: fault });
  }
}

/** The settings as they were stored, unjudged: only two things are read from them here. */
function storedSettings(): { count?: unknown; popularity?: unknown } {
  try {
    const value: unknown = JSON.parse(readSetting('discover:settings') ?? '{}');
    return value && typeof value === 'object' ? (value as { count?: unknown; popularity?: unknown }) : {};
  } catch {
    return {};
  }
}
