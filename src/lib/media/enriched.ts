import type { TrackMetadata } from '../db/metadata.ts';
import type { Tag } from '../db/tags.ts';
import type { Track } from '../types.ts';

/** A library track with whatever an online lookup managed to add. */
export type EnrichedTrack = Track & {
  genre: string | null;
  year: number | null;
  /**
   * Where it sits on its record.
   *
   * The catalogue's answer where there is one, the file's otherwise. A file
   * downloaded on its own carries whatever number the downloader felt like —
   * usually none — while the catalogue knows the release, so it is asked first.
   * Null when neither says.
   */
  discNumber: number | null;
  /** Ranked, most descriptive first. Empty until a lookup or an edit fills it. */
  tags: string[];
  /** True when any field on this track came from a lookup rather than the file. */
  enriched: boolean;
};

/**
 * What this reads out of the database. Passed in rather than imported so the
 * precedence rules below can be exercised without SQLite behind them;
 * `merge.ts` wires up the real tables and is what the rest of the app calls.
 */
export type MetadataStore = {
  readAllMetadata: () => Map<string, TrackMetadata>;
  allTags: () => Map<string, Tag[]>;
};

/**
 * The record a track is shown as being on, or null.
 *
 * On its own because more than the merge needs it: whatever asks which tracks
 * are one album has to ask about the album the library shows, or two parts of
 * the app would disagree about which tracks sit together.
 */
export function albumShown(
  track: Pick<Track, 'album'>,
  found: Pick<TrackMetadata, 'status' | 'album'> | null | undefined
): string | null {
  if (!found || found.status === 'not_found') return track.album;
  return found.status === 'manual' ? (found.album ?? track.album) : (track.album ?? found.album);
}

/**
 * Online data fills gaps rather than overwriting the file.
 *
 * A lookup can legitimately return a *different* recording — a cover, when the
 * original is not in any catalogue — so its title and artist are only trusted
 * where the file offers nothing. Genre and year have no counterpart in the file
 * at all, so they are always taken.
 */
export function mergeMetadata(tracks: Track[], store: MetadataStore): EnrichedTrack[] {
  const known = store.readAllMetadata();
  const tagsByTrack = store.allTags();

  return tracks.map((track) => {
    const tags = (tagsByTrack.get(track.id) ?? []).map((entry) => entry.tag);
    const found = known.get(track.id);
    if (!found || found.status === 'not_found') {
      return {
        ...track,
        genre: null,
        year: null,
        discNumber: null,
        tags,
        enriched: false,
      };
    }

    // A typed correction is authoritative — it exists precisely because the
    // file was wrong — so unlike a lookup it replaces rather than fills in.
    if (found.status === 'manual') {
      return {
        ...track,
        title: found.title ?? track.title,
        artist: found.artist ?? track.artist,
        album: albumShown(track, found),
        artworkUri: found.artworkUrl ?? track.artworkUri,
        genre: found.genre,
        year: found.year,
        trackNumber: found.trackNumber ?? track.trackNumber,
        discNumber: found.discNumber,
        tags,
        enriched: true,
      };
    }

    return {
      ...track,
      artist: track.artist ?? found.artist,
      album: albumShown(track, found),
      // Unconditional, unlike the two above: the media store's own album-art
      // provider stopped resolving years ago and the field arrives null from
      // it every time, so a looked-up cover is competing with nothing.
      artworkUri: found.artworkUrl,
      genre: found.genre,
      year: found.year,
      trackNumber: found.trackNumber ?? track.trackNumber,
      discNumber: found.discNumber,
      tags,
      enriched: true,
    };
  });
}
