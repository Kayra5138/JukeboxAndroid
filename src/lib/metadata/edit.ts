import type { TrackMetadata } from '../db/metadata.ts';
import { albumArtistShown } from '../media/enriched.ts';
import type { Track } from '../types.ts';
import { typedPlace, typedYear } from './single.ts';

/**
 * A track's details as somebody corrects them: one track on the details
 * screen, or many at once from a selection. Both write the same row the same
 * way, which is why it is here and not in either.
 */

/** The fields of a track that can be typed over, as they stand in their boxes. */
export type Fields = {
  title: string;
  artist: string;
  albumArtist: string;
  album: string;
  year: string;
  trackNumber: string;
  discNumber: string;
};

/** What is known of the track, with the file's own word where nothing better is. */
export function fieldsOf(track: Track, stored: TrackMetadata | null): Fields {
  const known = stored && stored.status !== 'not_found' ? stored : null;
  const place = known?.trackNumber ?? track.trackNumber;
  return {
    title: known?.title ?? track.title,
    artist: known?.artist ?? track.artist ?? '',
    // As the library shows it, which takes a lookup's word only for the
    // record the track is shown on: see `albumArtistShown`.
    albumArtist: albumArtistShown(track, stored) ?? '',
    album: known?.album ?? track.album ?? '',
    year: known?.year ? String(known.year) : '',
    trackNumber: place != null ? String(place) : '',
    discNumber: known?.discNumber != null ? String(known.discNumber) : '',
  };
}

/**
 * The row an edit is saved as: somebody's, so that no lookup writes over it.
 *
 * [track] is the track as the file has it, [kept] the row there was, and
 * [genre] the track's first tag, which is its genre and is edited with the
 * tags rather than here. The cover is the one the row had, and whatever was
 * said about it — taken off by hand — still stands; the details screen,
 * where a cover can be chosen or taken off, says otherwise where it has to.
 */
export function manualEntry(
  track: Track,
  kept: TrackMetadata | null,
  fields: Fields,
  genre: string | null
): TrackMetadata {
  const album = fields.album.trim();
  const albumArtist = fields.albumArtist.trim();
  return {
    trackId: track.id,
    status: 'manual',
    source: 'manual',
    title: fields.title.trim() || track.title,
    artist: fields.artist.trim() || null,
    // An emptied box over a file that names a record is somebody saying the
    // track is on none, kept as an empty string to say so (see `albumShown`).
    // Were it saved as nothing, the file's record would come back the moment
    // it was saved, and a record cleared from many tracks at once would come
    // back on the next save of any of them from the details screen, which
    // shows the box empty and saves what it shows.
    album: album || (track.album?.trim() ? '' : null),
    // The same for the album artist — the way a wrong one that splits a
    // record in two is put right.
    albumArtist: albumArtist || (track.albumArtist?.trim() ? '' : null),
    genre: genre ?? kept?.genre ?? null,
    year: typedYear(fields.year),
    trackNumber: typedPlace(fields.trackNumber),
    discNumber: typedPlace(fields.discNumber),
    artworkUrl: kept?.artworkUrl ?? null,
    coverRemovedAt: kept?.coverRemovedAt ?? null,
  };
}

/** The fields that can be set on many tracks at once. */
export const SHARED_FIELDS = ['artist', 'albumArtist', 'album', 'year'] as const;

export type SharedField = (typeof SHARED_FIELDS)[number];

/**
 * What was typed for a run of tracks. A field left empty is not "make this
 * empty" but "leave each track's own": a run of tracks seldom shares
 * anything but the field being put right, and a form that emptied the rest
 * would throw away exactly what was right about them.
 *
 * Emptying a field on all of them is said apart, in [cleared], so that it is
 * never what an untouched box means. A field cleared is cleared whatever was
 * typed in it. What clearing comes to is each field's own (see `CLEARS`).
 *
 * Title, place on the record and disc are not offered. They are each track's
 * own, and the same one typed over a run would be wrong for all but one.
 */
export type SharedEdit = Partial<Record<SharedField, string>> & {
  cleared?: readonly SharedField[];
};

/**
 * What each field says on every track of a run, by `fieldsOf`: the one thing
 * they all say; an empty string where it is empty on all of them, which with
 * a single track chosen is simply that track's empty field; or null where
 * they do not all say the same thing.
 */
export function sharedFields(
  tracks: readonly Track[],
  rows: ReadonlyMap<string, TrackMetadata>
): Record<SharedField, string | null> {
  const shared = { artist: null, albumArtist: null, album: null, year: null } as Record<SharedField, string | null>;
  for (const field of SHARED_FIELDS) {
    // Read as a box would be saved, trimmed: a field of spaces is as empty as one with nothing in it.
    const values = new Set(tracks.map((track) => fieldsOf(track, rows.get(track.id) ?? null)[field].trim()));
    if (values.size === 1) shared[field] = [...values][0];
  }
  return shared;
}

/**
 * The faint words in a field's box on the shared edit, from what
 * `sharedFields` found: what every track says, "empty" where none says
 * anything, and "each keeps its own" only where they disagree. Said of one
 * track, or of tracks that all have nothing, "each keeps its own" read as if
 * there were something different on each to keep.
 */
export function sharedPlaceholder(said: string | null, words: { keepEach: string; empty: string }): string {
  if (said == null) return words.keepEach;
  return said === '' ? words.empty : said;
}

/**
 * What clearing a field on a run of tracks does to each of them.
 *
 * The album artist and the album are taken away: the track is shown on no
 * record, or on one by nobody, whatever its file says. The year has nothing
 * in the file to fall back to, and is simply gone.
 *
 * The artist cannot be taken away like that, and is not offered as if it
 * could. A song is always by somebody, the library has no use for one by
 * nobody — it would only file it under the unknown artist — and a correction
 * that names nobody already means "the file's word" (see `mergeMetadata`).
 * So clearing the artist gives each track back the artist its own file names,
 * which is what is wanted after a lookup or an edit put the wrong one over a
 * run of tracks with the right one in their files.
 */
export const CLEARS: Record<SharedField, 'remove' | 'own'> = {
  artist: 'own',
  albumArtist: 'remove',
  album: 'remove',
  year: 'remove',
};

/** Whether [edit] clears [field] on every track. */
function clears(edit: SharedEdit, field: SharedField): boolean {
  return edit.cleared?.includes(field) ?? false;
}

/** The fields [edit] would set or clear, in the order the form shows them. */
export function fieldsSet(edit: SharedEdit): SharedField[] {
  return SHARED_FIELDS.filter((field) => clears(edit, field) || (edit[field] ?? '').trim() !== '');
}

/**
 * The row one track of a run is saved as, or null where nothing was typed.
 *
 * Every field typed goes onto the track, and every other field is what the
 * track already showed, so that saving makes the track the user's without
 * moving anything they did not touch: a looked-up title stays the title,
 * now as theirs. That is what the details screen's Save does with the boxes
 * it did not change, and it is the same row.
 */
export function sharedEditEntry(
  track: Track,
  kept: TrackMetadata | null,
  edit: SharedEdit,
  genre: string | null
): TrackMetadata | null {
  const set = fieldsSet(edit);
  if (set.length === 0) return null;
  const fields = fieldsOf(track, kept);
  // A cleared field goes in as an emptied box, which `manualEntry` already
  // reads as each field has to be read: no record, no album artist, no year,
  // and for the artist, nobody said, so the file's.
  for (const field of set) fields[field] = clears(edit, field) ? '' : edit[field]!.trim();
  return manualEntry(track, kept, fields, genre);
}
