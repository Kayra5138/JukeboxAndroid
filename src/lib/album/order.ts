import { placementOf, slotOf } from './placement.ts';
import { albumKey } from '../media/albums.ts';
import type { TrackMetadata } from '../db/metadata.ts';
import type { DownloadJob } from '../youtube/types.ts';

/**
 * Putting the tracks the library already has at their places on the record.
 *
 * A record's track list is looked up to say what is missing from it, and in
 * passing it says where each track that is here belongs. The library often
 * does not know: a file with no tags has no number at all, and one downloaded
 * on its own was numbered by the single it was looked up as. Such an album
 * plays its numbered tracks first and the rest by filename. So whatever the
 * comparison recognised is given the list's number for it.
 *
 * Only what it recognised. A library track the list has no line for is left
 * exactly where it was; nothing here guesses.
 */

/** A track list, as far as this needs to know one: whose it is, and who is where on it. */
export type Listing = {
  source: 'musicbrainz' | 'youtube';
  /** What vouches for a playlist being the record; see `youtube.ts`. Null for the catalogue's. */
  by: 'tracks' | 'album' | null;
  /** How many of the library's tracks were found on it. */
  covered: number;
  discs: number;
  tracks: { disc: number; position: number; have: string | null }[];
};

/** One track going to its place, with the row as it stood, for putting it back. */
export type Move = {
  trackId: string;
  trackNumber: number;
  discNumber: number | null;
  was: {
    /** Null where the track had no row at all. */
    status: TrackMetadata['status'] | null;
    trackNumber: number | null;
    discNumber: number | null;
  };
};

/**
 * Whether a list may be believed about where the library's tracks sit.
 *
 * Only one the library's own tracks were found on. With none of them there,
 * nothing says it is the same record. And a playlist taken on trust — the one
 * album YouTube lists under the name, for a record too little of which is
 * here to check — is good enough to offer for downloading, with a warning,
 * but not to renumber what is here by without being asked.
 */
export function vouchedFor(list: Pick<Listing, 'source' | 'by' | 'covered'>): boolean {
  return list.covered > 0 && (list.source === 'musicbrainz' || list.by === 'tracks');
}

/** A track at a place, as a word: what "the app put it there" is remembered by. */
export function placedKey(trackId: string, place: { disc: number | null; track: number }): string {
  return `${trackId}@${slotOf(place)}`;
}

/**
 * The tracks of a record the app itself numbered, each with the number it
 * gave: the downloads it filed (see `placedRow`).
 *
 * Read off the jobs, since the row says nothing of who wrote it: a download
 * filed by the app and a track corrected by hand are both an edit with a
 * number in it. The job still carries the place it was fetched for, and a row
 * that still has that number has the app's.
 */
export function placedByApp(jobs: DownloadJob[], album: string): Set<string> {
  const placed = new Set<string>();
  for (const job of jobs) {
    if (job.status !== 'done' || !job.trackId) continue;
    const place = placementOf(job.video);
    if (place && albumKey(place.album) === album) placed.add(placedKey(job.trackId, place));
  }
  return placed;
}

/**
 * The library's tracks that are not shown where [list] has them, and the
 * number each is to be given.
 *
 * A number somebody typed stays. That is an edit with a track number in it,
 * unless the number is one the app is known to have put there ([own]): then
 * the app chose it, off whichever list was showing, and may choose again when
 * the other list is.
 *
 * The disc is only written from a list that has more than one. On a record of
 * one disc the library's own word is kept, null or 1 — they sort alike, and
 * the tracks already there mostly say null. Any other disc is taken away,
 * since a track left on disc 2 of a record that has one plays after
 * everything else whatever its number.
 */
export function outOfPlace(
  list: Listing,
  owned: { id: string; trackNumber: number | null; discNumber?: number | null }[],
  rowOf: (trackId: string) => TrackMetadata | null,
  own: ReadonlySet<string>
): Move[] {
  if (!vouchedFor(list)) return [];
  const several = list.discs > 1;
  const byId = new Map(owned.map((track) => [track.id, track]));

  const moves: Move[] = [];
  for (const entry of list.tracks) {
    const track = entry.have ? byId.get(entry.have) : undefined;
    if (!track) continue;
    const disc = track.discNumber ?? null;
    const discFits = (disc ?? 1) === (several ? entry.disc : 1);
    if (track.trackNumber === entry.position && discFits) continue;

    const row = rowOf(track.id);
    if (
      row?.status === 'manual' &&
      row.trackNumber != null &&
      !own.has(placedKey(track.id, { track: row.trackNumber, disc: row.discNumber }))
    ) {
      continue;
    }
    moves.push({
      trackId: track.id,
      trackNumber: entry.position,
      discNumber: several ? entry.disc : discFits ? disc : null,
      was: {
        status: row?.status ?? null,
        trackNumber: row?.trackNumber ?? null,
        discNumber: row?.discNumber ?? null,
      },
    });
  }
  return moves;
}
