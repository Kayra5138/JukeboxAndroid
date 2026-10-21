import type { AlbumRest, OwnedTrack, RestOutcome } from '../album/rest.ts';
import type { TrackMetadata } from '../db/metadata.ts';
import type { TagSource } from '../db/tags.ts';
import type { Track } from '../types.ts';
import { heldCover } from './covers.ts';
import { isAbortError } from './http.ts';
import type { EnrichProgress, EnrichResult } from './pipeline.ts';

/**
 * Looking a whole record up at once, because somebody asked for that record.
 *
 * The pass over the library asks about a track at a time: who is this, what
 * genre, which cover — for every track of a record, the same questions about
 * the same record a dozen times, each answered on its own and sometimes
 * differently. Asked about the record instead, a handful of requests settle
 * the lot:
 *
 *  1. MusicBrainz is asked for the record once (`album/rest.ts`, which also
 *     finds the rest of an album and keeps its answers for a while), and the
 *     pressing the library's tracks came off is read with its track list.
 *  2. The library's tracks are found on that list — by title, then for what
 *     is left by place and length together — and each one found is given the
 *     list's word for its title, artist, place and disc, the record's album
 *     artist and year, and the record's genres, which are one more request.
 *  3. Apple is asked once for the record's cover, and every track of the
 *     record wears it.
 *  4. Only the tracks not on the list are looked up one by one, the ordinary
 *     way.
 *
 * Somebody asked, so nothing earlier stands in the way: a track nobody could
 * find before is asked about again, and so is a record whose cover was
 * searched for and not found. What nobody may do is touch a track edited by
 * hand. Its names stay, and so does any cover it was given by hand or had
 * taken off; a hand-edited track with no cover is given the record's, as
 * any bare track of the record would be.
 *
 * Everything that reaches out is handed in, so the deciding can be tried
 * without a network or a database.
 */

/** The record, as the library has it. */
export type AlbumToLookUp = {
  name: string;
  /** Whoever it is by, as the library shows it, or null where its tracks disagree. */
  artist: string | null;
  tracks: (Track & { discNumber?: number | null })[];
};

export type AlbumLookupDeps = {
  /** The record and its track list, found by name and artist (`lookUpAlbumRest`). */
  release: (album: { name: string; artist: string | null; tracks: OwnedTrack[] }, signal?: AbortSignal) => Promise<RestOutcome>;
  /** The record's genres, best first, by its release group. */
  genres: (groupId: string, signal?: AbortSignal) => Promise<string[]>;
  /** The address of the record's cover, or null where nobody sells it. */
  cover: (album: string, artist: string | null, tracks: number, signal?: AbortSignal) => Promise<string | null>;
  /** Fetches a picture and answers where the app's own copy of it is. */
  download: (url: string) => Promise<string>;
  /** Which of these tracks' files carry a picture of their own. */
  pictures: (trackIds: string[]) => Promise<ReadonlyMap<string, boolean | null>>;
  readAllMetadata: () => Map<string, TrackMetadata>;
  saveMetadata: (entry: TrackMetadata) => void;
  saveLookupTags: (trackId: string, tags: string[], source: TagSource) => void;
  /** Puts one cover on all of [trackIds] but [keep], over what they had (`chooseCovers`). */
  chooseCovers: (trackIds: string[], uri: string, keep: ReadonlySet<string>) => string[];
  /** Forgets what was found for these tracks, but for edits, so they are asked about afresh. */
  forgetMetadata: (trackIds: string[]) => void;
  /** The ordinary lookup, a track at a time, for what the record's list did not have. */
  lookUpEach: (
    tracks: Track[],
    onProgress: (progress: EnrichProgress) => void,
    signal?: AbortSignal
  ) => Promise<EnrichResult>;
};

/** How far apart two lengths of one track may be, in seconds, for place and length to vouch for it. */
const SAME_LENGTH_SEC = 3;

/**
 * Where on the record each of the library's tracks sits, by track id.
 *
 * What the title comparison in `album/rest.ts` found first. Then, for what it
 * could not read — a title in another script, or spelled another way by the
 * file — a track whose place on the record is the list's and whose length is
 * within a few seconds of it: two things that agreeing by chance is rarer
 * than either alone.
 */
export function placedOnRelease(
  rest: Pick<AlbumRest, 'tracks'>,
  tracks: AlbumToLookUp['tracks']
): Map<string, AlbumRest['tracks'][number]> {
  const placed = new Map<string, AlbumRest['tracks'][number]>();
  const free: AlbumRest['tracks'] = [];
  for (const entry of rest.tracks) {
    if (entry.have) placed.set(entry.have, entry);
    else free.push(entry);
  }
  for (const track of tracks) {
    if (placed.has(track.id) || track.trackNumber == null) continue;
    const at = free.findIndex(
      (entry) =>
        entry.position === track.trackNumber &&
        entry.disc === (track.discNumber ?? 1) &&
        entry.lengthSec != null &&
        track.durationSec > 0 &&
        Math.abs(entry.lengthSec - track.durationSec) <= SAME_LENGTH_SEC
    );
    if (at < 0) continue;
    placed.set(track.id, free[at]!);
    free.splice(at, 1);
  }
  return placed;
}

/**
 * Looks [album] up as one record. Never rejects for anything a service does;
 * a stop comes back as a cancelled result, with everything done before it
 * written.
 */
export async function lookUpAlbum(
  album: AlbumToLookUp,
  onProgress: (progress: EnrichProgress) => void,
  signal: AbortSignal | undefined,
  deps: AlbumLookupDeps
): Promise<EnrichResult> {
  const total = album.tracks.length;
  let done = 0;
  let matched = 0;
  let covers = 0;
  const emit = () => onProgress({ done, total, matched, covers, throttled: false });
  const cancelled = (): EnrichResult => ({ matched, missed: 0, coversSaved: covers, cancelled: true });
  emit();

  const rows = deps.readAllMetadata();
  const edited = new Set(album.tracks.filter((track) => rows.get(track.id)?.status === 'manual').map((track) => track.id));
  let reached = false;

  // ---- the record, from MusicBrainz ----

  let placed = new Map<string, AlbumRest['tracks'][number]>();
  let rest: AlbumRest | null = null;
  try {
    const outcome = await deps.release(
      {
        name: album.name,
        artist: album.artist,
        tracks: album.tracks.map((track) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          trackNumber: track.trackNumber,
          discNumber: track.discNumber ?? null,
        })),
      },
      signal
    );
    if (outcome.ok) {
      rest = outcome.rest;
      placed = placedOnRelease(rest, album.tracks);
      reached = true;
    } else if (outcome.why === 'notFound') {
      reached = true;
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) return cancelled();
  }
  if (signal?.aborted) return cancelled();

  if (rest) {
    let genres: string[] = [];
    try {
      genres = await deps.genres(rest.groupId, signal);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) return cancelled();
      // A record without its genres is still worth its names.
    }
    if (signal?.aborted) return cancelled();
    const albumArtist = rest.release.artist.trim() || null;
    for (const track of album.tracks) {
      const entry = placed.get(track.id);
      if (!entry || edited.has(track.id)) continue;
      const before = rows.get(track.id);
      const known = before && before.status !== 'not_found' ? before : null;
      const year =
        known?.year != null && rest.release.year != null
          ? Math.min(known.year, rest.release.year)
          : (rest.release.year ?? known?.year ?? null);
      deps.saveMetadata({
        trackId: track.id,
        status: 'matched',
        source: 'musicbrainz',
        title: entry.title,
        artist: entry.artist ?? albumArtist,
        // The library's own name for the record and not the catalogue's
        // spelling of it: this is the record the library shows, and a track
        // filed under another spelling of it would leave it.
        album: album.name,
        albumArtist,
        genre: genres[0] ?? known?.genre ?? null,
        year,
        // A cover the track already had stays until the record's arrives.
        artworkUrl: heldCover(before, null),
        trackNumber: entry.position,
        // The disc only on a record of several, as everywhere else.
        discNumber: rest.discs > 1 ? entry.disc : null,
      });
      if (genres.length > 0) deps.saveLookupTags(track.id, genres, 'musicbrainz');
      matched += 1;
      done += 1;
    }
    emit();
  }

  // ---- the cover, from Apple ----

  // Not for a record nobody can say whose it is: asked by its name alone, a
  // shop answers with whichever record of that name it sells most of.
  const by = rest?.release.artist || album.artist;
  try {
    const url = by ? await deps.cover(album.name, by, total, signal) : null;
    if (signal?.aborted) return cancelled();
    if (url) {
      reached = true;
      const uri = await deps.download(url);
      if (signal?.aborted) return cancelled();
      const fresh = deps.readAllMetadata();
      const own = await deps.pictures(album.tracks.map((track) => track.id));
      // A picture of somebody's own choosing stays, and so does a gap they
      // made; and a file with a picture of its own is wearing it.
      const keep = new Set(
        album.tracks
          .filter((track) => {
            const row = fresh.get(track.id);
            if (own.get(track.id) === true) return true;
            return row?.status === 'manual' && (heldCover(row, null) != null || row.coverRemovedAt != null);
          })
          .map((track) => track.id)
      );
      covers += deps.chooseCovers(album.tracks.map((track) => track.id), uri, keep).length;
      emit();
    }
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) return cancelled();
    // No cover this time. The tracks keep whatever they had.
  }

  // ---- the rest, one at a time ----

  const left = album.tracks.filter((track) => !placed.has(track.id) && !edited.has(track.id));
  done += edited.size;
  emit();
  if (left.length === 0) {
    return { matched, missed: 0, coversSaved: covers, cancelled: false, ...(reached ? {} : { stopped: 'offline' as const }) };
  }

  // Asked again whatever was said of them before.
  deps.forgetMetadata(left.map((track) => track.id));
  const base = { done, matched, covers };
  const each = await deps.lookUpEach(
    left,
    (progress) => {
      onProgress({
        done: base.done + progress.done,
        total,
        matched: base.matched + progress.matched,
        covers: base.covers + progress.covers,
        throttled: progress.throttled,
        ...(progress.offline ? { offline: true } : {}),
      });
    },
    signal
  );
  return {
    ...each,
    matched: matched + each.matched,
    coversSaved: covers + each.coversSaved,
  };
}
