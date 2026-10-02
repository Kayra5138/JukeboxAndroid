import {
  knownArtistId,
  rememberArtistId,
  saveDiscoveries,
  type Discovery,
} from '../db/discover.ts';
import { topArtists } from '../db/history.ts';
import { isAbortError } from '../metadata/http.ts';
import { musicBrainzGet } from '../metadata/musicbrainz.ts';
import { rangeOf } from '../stats/period.ts';
import { coverUrl, similarArtists, topRecordings } from './listenbrainz.ts';
import { ownedArtists, rankSuggestions, weighSeeds, type Suggested } from './rank.ts';

/**
 * A run: from what has been listened to, to music that is not in the library.
 *
 * The shape is three steps and each one narrows. A handful of artists listened
 * to most become catalogue ids; each id becomes a list of artists whose
 * listeners overlap; those are merged, weighed, and stripped of everything
 * already owned. Only then — for the few that survive — is a song asked for,
 * because a name is not somewhere to start and fetching songs for a hundred
 * artists to show eight would be ninety-two requests spent on nothing.
 *
 * Deliberately not live. The whole thing is twenty-odd requests over half a
 * minute, so it writes its findings down and the screen reads those.
 */

/** Artists to ask about. More than this and the run stops being worth waiting. */
const SEEDS = 6;

/** How many suggestions to end up with. A screenful, not a catalogue. */
const KEEP = 24;

/** Asked for per artist, so a suggestion arrives with somewhere to begin. */
const SONGS_PER_ARTIST = 1;

/**
 * How recent the listening that seeds a run should be.
 *
 * A year rather than everything: recommendations should follow what is being
 * listened to now, and an artist played solidly three years ago and not since
 * is a different person's taste.
 */
const SEED_PERIOD = 'year' as const;

export type Progress = { done: number; total: number };

/**
 * Work out what to recommend and write it down.
 *
 * Returns how many suggestions were found. Throws what the request layer
 * throws, so the caller can tell "nobody answered" from "there is nothing to
 * suggest" — the first is worth a retry and the second is not.
 */
export async function runDiscovery(
  library: { artist?: string | null }[],
  now: number,
  onProgress?: (progress: Progress) => void,
  signal?: AbortSignal
): Promise<number> {
  const seeds = weighSeeds(topArtists(SEEDS, rangeOf(SEED_PERIOD, now))).filter(
    (seed) => seed.label.trim()
  );
  if (seeds.length === 0) {
    saveDiscoveries([], now);
    return 0;
  }

  const owned = ownedArtists(library);
  const suggested: Suggested[] = [];
  let done = 0;
  // Resolving the seeds, asking about each, then a song apiece for what we
  // keep. The last is a guess until the middle step has run, which is why the
  // bar is allowed to be approximate rather than wrong.
  const total = seeds.length * 2 + KEEP;
  const step = () => onProgress?.({ done: (done += 1), total });

  for (const seed of seeds) {
    const mbid = await artistIdFor(seed.label, now, signal);
    step();
    if (!mbid) {
      step();
      continue;
    }
    /*
      A seed the recommender has never heard of is not a failure of the run.
      Most of a personal library is below the threshold its indexes are built
      at, and one unknown artist must not take the other five down with it.
    */
    try {
      suggested.push({
        seed: seed.label,
        weight: seed.weight,
        candidates: await similarArtists(mbid, signal),
      });
    } catch (failure) {
      if (isAbortError(failure)) throw failure;
      console.warn(`No neighbours for ${seed.label}`, failure);
    }
    step();
  }

  const ranked = rankSuggestions(suggested, owned, KEEP);

  const found: Discovery[] = [];
  for (const suggestion of ranked) {
    let songs: Awaited<ReturnType<typeof topRecordings>> = [];
    try {
      songs = await topRecordings(suggestion.mbid, SONGS_PER_ARTIST, signal);
    } catch (failure) {
      if (isAbortError(failure)) throw failure;
      console.warn(`No songs for ${suggestion.name}`, failure);
    }
    step();

    /*
      An artist with no song to point at is still a recommendation, so one is
      made out of the artist alone rather than dropping them. The id is the
      artist's own, prefixed so it cannot collide with a recording's.
    */
    if (songs.length === 0) {
      found.push({
        recordingMbid: `artist:${suggestion.mbid}`,
        title: suggestion.name,
        artist: suggestion.name,
        artistMbid: suggestion.mbid,
        release: null,
        coverUrl: null,
        because: suggestion.because.join(' · '),
      });
      continue;
    }

    for (const song of songs) {
      found.push({
        recordingMbid: song.mbid,
        title: song.title,
        // What the recommender calls them, falling back to the name the
        // similarity index used when the popularity one credits nobody.
        artist: song.artist || suggestion.name,
        artistMbid: suggestion.mbid,
        release: song.release,
        coverUrl: coverUrl(song),
        because: suggestion.because.join(' · '),
      });
    }
  }

  saveDiscoveries(found, now);
  return found.length;
}

type ArtistSearch = { artists?: { id: string; name: string; score: number }[] };

/**
 * The catalogue's id for a name, remembered either way.
 *
 * Unfielded, because a fielded query is an exact-match question and these
 * names come from file tags: `Şebnem Ferah` asked as `artist:"…"` finds
 * nothing while the same words loose score a hundred. The same reasoning as
 * the photograph lookup, which searches the same index.
 */
async function artistIdFor(
  name: string,
  now: number,
  signal?: AbortSignal
): Promise<string | null> {
  const wanted = name.trim();
  if (!wanted) return null;

  const remembered = knownArtistId(wanted);
  if (remembered !== undefined) return remembered;

  try {
    const search = await musicBrainzGet<ArtistSearch>(
      `/artist/?query=${encodeURIComponent(wanted)}&fmt=json&limit=1`,
      signal
    );
    const best = search.artists?.[0] ?? null;
    const mbid = best && best.score >= MIN_SCORE ? best.id : null;
    rememberArtistId(wanted, mbid, now);
    return mbid;
  } catch (failure) {
    if (isAbortError(failure)) throw failure;
    /*
      Not written down. "Could not reach the catalogue" is not "this artist
      does not exist", and storing it as the second would cost the artist a
      place in every future run made on an aeroplane.
    */
    console.warn(`Could not resolve ${wanted}`, failure);
    return null;
  }
}

/**
 * MusicBrainz normalises `score` against its own best hit, so the leader is
 * always 100 and this is a tie-breaker rather than a confidence. Matching the
 * bar the rest of the app uses for the same question on the same index.
 */
const MIN_SCORE = 90;
