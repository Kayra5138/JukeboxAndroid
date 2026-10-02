import type { EnrichedTrack } from './enriched.ts';

/**
 * Records, assembled from what the tracks say about themselves.
 *
 * Derived rather than stored, for the same reason the listening lists are:
 * there is nothing to keep in step and no way for an album to disagree with
 * the tracks it is made of. Look a track up, correct it by hand, delete it —
 * the albums follow without anything having to notice.
 */

export type Album = {
  /** Unique within a library, and what a screen is opened with. */
  key: string;
  name: string;
  /** Whoever the record is by, or null where its tracks disagree. */
  artist: string | null;
  year: number | null;
  tracks: EnrichedTrack[];
};

/**
 * Two spellings of one record.
 *
 * Case and surrounding space vary between whichever catalogue answered, and a
 * library where "Ghost Stories" and "ghost stories " are two records is worse
 * than one where a genuine difference in capitalisation is lost.
 *
 * Exported because it is what a screen is opened with: anything holding a
 * track's album name can reach that album without first grouping the library.
 */
export function albumKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Groups [tracks] into the records they belong to.
 *
 * Only tracks that name an album take part. The rest are not an album called
 * nothing — they are tracks whose record is unknown, and collecting them under
 * one heading would invent a release that does not exist.
 *
 * Grouped by album alone rather than by album and artist. A compilation names
 * a different artist on every track, and requiring them to agree would break
 * one record into twelve; the cost is that two unrelated records sharing a
 * name are merged, which is the rarer and less annoying mistake.
 */
export function albumsOf(tracks: EnrichedTrack[]): Album[] {
  const groups = new Map<string, EnrichedTrack[]>();

  for (const track of tracks) {
    const name = track.album?.trim();
    if (!name) continue;
    const id = albumKey(name);
    const held = groups.get(id);
    if (held) held.push(track);
    else groups.set(id, [track]);
  }

  const albums: Album[] = [];
  for (const [id, members] of groups) {
    const ordered = orderWithin(members);
    albums.push({
      key: id,
      // The spelling the first track uses, since one of them has to be chosen
      // and they are the same record whichever it is.
      name: ordered[0].album?.trim() ?? id,
      artist: commonArtist(ordered),
      year: ordered.find((track) => track.year != null)?.year ?? null,
      tracks: ordered,
    });
  }

  return albums.sort(
    (left, right) =>
      (left.artist ?? '').localeCompare(right.artist ?? '') ||
      left.name.localeCompare(right.name)
  );
}

/**
 * The tracks of one record, in the order it plays.
 *
 * Numbered tracks first and in their own order; everything else after them, by
 * filename. A track whose position nobody knows is not track zero, and slipping
 * it in among the ones that are known would be claiming to know. Putting them
 * below keeps the part of the order that is real intact and says plainly that
 * the rest is not.
 */
export function orderWithin(tracks: EnrichedTrack[]): EnrichedTrack[] {
  const numbered: EnrichedTrack[] = [];
  const rest: EnrichedTrack[] = [];
  for (const track of tracks) {
    (positionOf(track) == null ? rest : numbered).push(track);
  }

  numbered.sort((left, right) => {
    const leftPosition = positionOf(left)!;
    const rightPosition = positionOf(right)!;
    return (
      (leftPosition.disc ?? 1) - (rightPosition.disc ?? 1) ||
      leftPosition.track - rightPosition.track ||
      left.title.localeCompare(right.title)
    );
  });

  rest.sort((left, right) =>
    (left.filename ?? left.title).localeCompare(right.filename ?? right.title)
  );

  return [...numbered, ...rest];
}

/**
 * Where a track sits, from the catalogue or from the file.
 *
 * The catalogue is asked first. A file downloaded one at a time carries
 * whatever number the downloader felt like, while the catalogue knows the
 * record — and where neither says anything, nothing is claimed.
 */
function positionOf(track: EnrichedTrack): { disc: number | null; track: number } | null {
  const number = track.trackNumber;
  if (number == null || number <= 0) return null;
  return { disc: track.discNumber ?? null, track: number };
}

/** The artist of the record, or null where its tracks do not agree. */
function commonArtist(tracks: EnrichedTrack[]): string | null {
  const counts = new Map<string, { name: string; count: number }>();
  for (const track of tracks) {
    const name = track.artist?.trim();
    if (!name) continue;
    const id = name.toLowerCase();
    const held = counts.get(id);
    if (held) held.count += 1;
    else counts.set(id, { name, count: 1 });
  }
  if (counts.size === 0) return null;

  const [best] = [...counts.values()].sort((left, right) => right.count - left.count);
  // A record where no one artist appears on half the tracks is a compilation,
  // and naming the most frequent of twelve would be picking one at random.
  return best.count * 2 >= tracks.length ? best.name : null;
}
