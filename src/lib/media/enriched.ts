import type { TrackMetadata } from '../db/metadata.ts';
import type { Tag } from '../db/tags.ts';
import type { Track } from '../types.ts';
import { identify } from '../metadata/identify.ts';
import { bareTitle, foldForMatch } from '../metadata/text.ts';

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
  /**
   * The covers tracks with no row of their own were given by their record
   * (`fillCovers`), by track. Left out, there are none.
   */
  readSharedCovers?: () => Map<string, string>;
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
  // A typed empty string is somebody saying the track is on no record, as
  // for the album artist below; a null is nobody having said, and the file's
  // word stands.
  if (found.status === 'manual') return found.album != null ? found.album.trim() || null : track.album;
  return track.album ?? found.album;
}

/**
 * Whoever the record a track is shown on is by, or null.
 *
 * The file's word first, as for the record itself, unless somebody typed
 * another — and a typed empty string is somebody saying the record names
 * nobody, which is how a wrong album artist splitting a record in two is put
 * right without retagging the file.
 *
 * A lookup's album artist only fills a gap, and only when the record it is
 * the artist of is the record shown. A catalogue answers with whichever
 * release it sells the song on, and the album artist of the artist's own
 * album, laid over a track the library shows on a compilation, would take it
 * off the compilation and put it on a record of one song.
 */
export function albumArtistShown(
  track: Pick<Track, 'album' | 'albumArtist'>,
  found: Pick<TrackMetadata, 'status' | 'album' | 'albumArtist'> | null | undefined
): string | null {
  const own = track.albumArtist?.trim() || null;
  if (!found || found.status === 'not_found') return own;
  if (found.status === 'manual') {
    return found.albumArtist != null ? found.albumArtist.trim() || null : own;
  }
  if (own) return own;
  const said = found.albumArtist?.trim();
  if (!said) return null;
  const shown = albumShown(track, found);
  return track.album == null || sameRecord(shown, found.album) ? said : null;
}

/**
 * Whoever a track is shown as being by, or null.
 *
 * The file's word first, and a lookup's only where the file names nobody: a
 * lookup can find a different recording of the song — a cover, when the
 * original is in no catalogue — and the singer is exactly what that gets
 * wrong. Somebody's typed word replaces the file's, as it does everywhere.
 *
 * One rule for the library and for the details screen's boxes, which used to
 * disagree: the boxes took the lookup first, so they read right while every
 * list went on showing what the file said.
 */
export function artistShown(
  track: Pick<Track, 'artist'>,
  found: Pick<TrackMetadata, 'status' | 'artist'> | null | undefined
): string | null {
  if (!found || found.status === 'not_found') return track.artist;
  if (found.status === 'manual') return found.artist ?? track.artist;
  return track.artist ?? found.artist;
}


/**
 * What a track is shown as being called.
 *
 * The file's, unless somebody typed another — or a lookup found the song and
 * its name is the file's own with the wrapping taken off. A file named the way
 * a download is, `Feint - Snake Eyes (Official Video)`, carries its artist and
 * its upload in the title, and a lookup that found Feint's "Snake Eyes" has
 * found that name, cleaner. A cover is called what the song is called, so
 * this, unlike the artist, is safe to take from a lookup that matched.
 *
 * Where the lookup's name is some other, the file's stands, with the artist
 * taken off the front of it where that is the artist shown beside it: the
 * name and the credit saying the same person twice is nothing but noise.
 */
export function titleShown(
  track: Pick<Track, 'title' | 'artist'>,
  found: Pick<TrackMetadata, 'status' | 'title' | 'artist'> | null | undefined
): string {
  if (!found || found.status === 'not_found') return track.title;
  if (found.status === 'manual') return found.title ?? track.title;
  const lookedUp = found.title?.trim();
  if (lookedUp) {
    const own = identify({ title: track.title, artist: track.artist } as Track).title;
    // Word for word, brackets and all: `Akuma no Ko (Cover)` is not the file's `Akuma no Ko` made cleaner.
    if (foldForMatch(own) !== '' && foldForMatch(own) === foldForMatch(lookedUp)) return lookedUp;
  }
  return bareTitle(track.title, artistShown(track, found));
}

/** Whether two names are one record, as `albumKey` compares them. */
function sameRecord(left: string | null | undefined, right: string | null | undefined): boolean {
  return left != null && right != null && left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** A cover the app holds a copy of, as against an address on the internet. */
const stored = (url: string | null | undefined): url is string => url != null && url.startsWith('file://');

/**
 * Online data fills gaps rather than overwriting the file.
 *
 * A lookup can legitimately return a *different* recording — a cover, when the
 * original is not in any catalogue — so its artist is only trusted where the
 * file offers nothing, and its title only where it is the file's own, cleaner
 * (`titleShown`). Genre and year have no counterpart in the file at all, so
 * they are always taken.
 */
export function mergeMetadata(tracks: Track[], store: MetadataStore): EnrichedTrack[] {
  const known = store.readAllMetadata();
  const tagsByTrack = store.allTags();
  const shared = store.readSharedCovers?.() ?? new Map<string, string>();

  return tracks.map((track) => {
    const tags = (tagsByTrack.get(track.id) ?? []).map((entry) => entry.tag);
    const found = known.get(track.id);
    // Given by the rest of the record, for a track with no cover of its own;
    // it never stands in front of one (see `fillCovers`).
    const given = shared.get(track.id) ?? null;
    if (!found || found.status === 'not_found') {
      return {
        ...track,
        albumArtist: track.albumArtist ?? null,
        artworkUri: given ?? track.artworkUri,
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
        title: titleShown(track, found),
        artist: artistShown(track, found),
        album: albumShown(track, found),
        albumArtist: albumArtistShown(track, found),
        // A cover somebody took off stays off, whatever the record gave the
        // track before or since — a backup brought in, say.
        artworkUri: stored(found.artworkUrl)
          ? found.artworkUrl
          : ((found.coverRemovedAt == null ? given : null) ?? found.artworkUrl ?? track.artworkUri),
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
      title: titleShown(track, found),
      artist: artistShown(track, found),
      album: albumShown(track, found),
      albumArtist: albumArtistShown(track, found),
      // Unconditional, unlike the two above: the media store's own album-art
      // provider stopped resolving years ago and the field arrives null from
      // it every time, so a looked-up cover is competing with nothing — but
      // for one the record gave, which a mere address does not outrank.
      artworkUri: stored(found.artworkUrl) ? found.artworkUrl : (given ?? found.artworkUrl),
      genre: found.genre,
      year: found.year,
      trackNumber: found.trackNumber ?? track.trackNumber,
      discNumber: found.discNumber,
      tags,
      enriched: true,
    };
  });
}
