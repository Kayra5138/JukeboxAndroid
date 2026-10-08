import { albumKey } from '../media/albums.ts';
import { isStoredCover } from '../metadata/covers.ts';
import { isActive, type DownloadJob } from '../youtube/types.ts';
import type { TrackMetadata } from '../db/metadata.ts';

/**
 * Where a download belongs: the record it was fetched to complete, and its
 * place on it.
 *
 * A file downloaded on its own knows none of this. Its album is whatever the
 * video's uploader typed, and looking it up afterwards finds *a* release the
 * recording was on — the single, as often as not — under that catalogue's
 * spelling of the name. Either would open a second album of one track beside
 * the album it was fetched for.
 *
 * So what was already known when the download was asked for travels with it.
 * It is put on the video the job is made from, and the phone keeps a job's
 * video exactly as it was given, across the app being closed; when the file
 * arrives the place is read back off the job and written as the track's row.
 * Nothing has to be remembered on this side in between, and nothing has to be
 * found out twice.
 */
export type Placement = {
  /** The record's name exactly as the library shows it, since that is what groups tracks. */
  album: string;
  title: string;
  artist: string | null;
  track: number;
  /** Null on a record of one disc, as it is for the tracks already there. */
  disc: number | null;
  year: number | null;
  genre: string | null;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
const whole = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

/**
 * The place a job's video carries, or null where it carries none.
 *
 * Read with suspicion. It has been through the phone's own storage and back,
 * every job there has ever been comes through here, and what this answers is
 * written into the library.
 */
export function placementOf(video: unknown): Placement | null {
  const said = (video as { placement?: unknown } | null | undefined)?.placement;
  if (said == null || typeof said !== 'object') return null;
  const from = said as Record<string, unknown>;
  const album = text(from.album);
  const title = text(from.title);
  const track = whole(from.track);
  if (!album || !title || track == null) return null;
  return {
    album,
    title,
    artist: text(from.artist),
    track,
    disc: whole(from.disc),
    year: whole(from.year),
    genre: text(from.genre),
  };
}

/** One place on a record, as a word: what a row and its download are matched by. */
export function slotOf(place: { disc: number | null; track: number }): string {
  return `${place.disc ?? 1}:${place.track}`;
}

/**
 * The downloads that were asked for to complete one record, by the place each
 * is for.
 *
 * Found by the place a job carries and not by a note of which video was
 * chosen, so a screen opened again a day later — or after the app was closed
 * in the middle — reads the same thing off the same jobs. One that finished
 * or is under way comes before another try at the same place that failed, as
 * it does for a video.
 */
export function jobsBySlot(jobs: DownloadJob[], album: string): Map<string, DownloadJob> {
  const found = new Map<string, DownloadJob>();
  const settled = (job: DownloadJob) => job.status === 'done' || isActive(job);
  for (const job of jobs) {
    const place = placementOf(job.video);
    if (!place || albumKey(place.album) !== album) continue;
    const slot = slotOf(place);
    const held = found.get(slot);
    if (!held || (!settled(held) && settled(job))) found.set(slot, job);
  }
  return found;
}

/**
 * The genre most of a record's tracks are counted under, or null.
 *
 * For a track that is being filed without a lookup of its own. It is on the
 * record its neighbours are on, and the statistics would otherwise count an
 * hour of the album under its genre and the one new track under none.
 */
export function sharedGenre(tracks: { genre: string | null }[]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  for (const { genre } of tracks) {
    if (!genre) continue;
    const count = (counts.get(genre) ?? 0) + 1;
    counts.set(genre, count);
    // More than, so between equals the one met first stays.
    if (best == null || count > (counts.get(best) ?? 0)) best = genre;
  }
  return best;
}

/**
 * The row that files a downloaded track under its record, or null where the
 * track is not this's to file.
 *
 * Written as an edit and not as a lookup, for the two things only an edit
 * does. Its album is shown in place of the file's, where a lookup's only
 * fills a gap — and the file does name an album, the wrong one. And a pass
 * over the library leaves it alone, so the next lookup cannot move the track
 * back out onto a single. It is still given the cover its neighbours have,
 * which is a thing done for any track that names a record and has none.
 *
 * Never over an edit that is already there. That is either this, written
 * before the app was closed and now being asked for again, or something the
 * user has typed since, and neither is to be written over.
 */
export function placedRow(
  trackId: string,
  place: Placement,
  existing: TrackMetadata | null
): TrackMetadata | null {
  if (existing?.status === 'manual') return null;
  return {
    trackId,
    status: 'manual',
    source: 'manual',
    title: place.title,
    artist: place.artist,
    album: place.album,
    genre: place.genre ?? existing?.genre ?? null,
    year: place.year ?? existing?.year ?? null,
    // A cover the app already holds for it stays; an address on the internet
    // was a lookup's guess at a release this track is not being filed under.
    artworkUrl: isStoredCover(existing?.artworkUrl) ? existing.artworkUrl : null,
    trackNumber: place.track,
    discNumber: place.disc,
  };
}
