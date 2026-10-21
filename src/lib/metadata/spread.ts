import { albumsOf, artistKey, type Album } from '../media/albums.ts';
import type { EnrichedTrack } from '../media/enriched.ts';
import type { CoverFill } from '../db/metadata.ts';
import { isStoredCover } from './covers.ts';

/**
 * Handing a record's cover to the tracks of it that have none.
 *
 * A cover arrives a track at a time — a lookup, a picture chosen by hand, a
 * download filed under its record — and the library holds records a track at
 * a time, so the rest of the record is left bare until something happens to
 * look each of them up too. This is what gives them the cover the moment one
 * of them has it, whichever way it came, and it is the one thing that does:
 * every way a cover can arrive ends by asking for it.
 *
 * The rules, all of them on the side of leaving a track alone:
 *
 *  - The record is the one the library shows (`albumsOf`), album artist and
 *    all, so a cover goes exactly where the album screen would show it
 *    belonging.
 *  - Only a track with no cover of the app's own takes one, and never a track
 *    whose file carries a picture: that picture is its cover. A file nobody
 *    has opened yet is not guessed about; it is asked about first.
 *  - Never a track somebody took the cover off by hand.
 *  - Where a record is known only by its name, a track by somebody other than
 *    the artist most of the record is by takes nothing, unless nobody is most
 *    of it, which is a compilation.
 *  - The cover given is the one most of the record's tracks wear, and between
 *    equals the one met first in the record's own order.
 *
 * A record none of whose tracks has a cover of the app's own can still have
 * one to give: the picture inside one of its files, kept as one of the app's
 * covers so that it lasts. That is only done when somebody is looking at the
 * record (see `media/coverSpread.ts`): finding out which of a record's files
 * carry a picture means opening them, and opening every file of a library to
 * find the few records with a gap in them is not worth it.
 *
 * Everything that touches the phone or the database is handed in, so the
 * deciding can be tested on its own.
 */

/** One record with tracks to give a cover to. */
export type SpreadPlan = {
  album: Album;
  /** The cover most of its tracks wear, or null where none of them has one. */
  cover: string | null;
  /** The tracks that may be given it, if their files turn out to carry no picture. */
  wanting: EnrichedTrack[];
};

export type PlanOptions = {
  /** Track ids somebody took the cover off by hand. */
  removed: ReadonlySet<string>;
  /**
   * Only the records holding one of these tracks, where the work was set off
   * by something that happened to them; every record otherwise.
   */
  only?: ReadonlySet<string>;
  /**
   * Whether a record with no cover of the app's own is worth planning for, to
   * be given the picture inside one of its own files.
   */
  embedded?: boolean;
};

/**
 * The records that have a cover to give and a track to give it to.
 *
 * Nothing is opened and nothing is asked: this reads the tracks as the
 * library has them, so it costs one grouping of the library, which every
 * screen showing records does already. A library in which every record is
 * whole comes back as nothing at all.
 */
export function planSpread(tracks: EnrichedTrack[], options: PlanOptions): SpreadPlan[] {
  const { removed, only, embedded = false } = options;
  const plans: SpreadPlan[] = [];
  for (const album of albumsOf(tracks)) {
    if (album.tracks.length < 2) continue;
    if (only && !album.tracks.some((track) => only.has(track.id))) continue;

    const counts = new Map<string, number>();
    let cover: string | null = null;
    const bare: EnrichedTrack[] = [];
    for (const track of album.tracks) {
      const uri = track.artworkUri;
      if (isStoredCover(uri)) {
        const count = (counts.get(uri) ?? 0) + 1;
        counts.set(uri, count);
        if (cover == null || count > counts.get(cover)!) cover = uri;
      } else if (!removed.has(track.id)) {
        bare.push(track);
      }
    }
    if (bare.length === 0 || (cover == null && !embedded)) continue;

    const wanting = bare.filter((track) => fitsRecord(album, track));
    if (wanting.length > 0) plans.push({ album, cover, wanting });
  }
  return plans;
}

/**
 * Whether a track may wear its record's cover as far as who it is by goes.
 *
 * A record with an album artist is that artist's, whoever sings on each
 * song. A record of its name alone is the artist's most of it is by, and a
 * track by somebody else is as likely to be on another record of that name
 * which the library cannot tell apart — unless nobody is most of it, which is
 * a compilation.
 */
function fitsRecord(album: Album, track: EnrichedTrack): boolean {
  if (album.albumArtist != null || album.compilation || album.artist == null) return true;
  return artistKey(track.artist) === artistKey(album.artist);
}

export type SpreadDeps = {
  /**
   * Which of these tracks' files carry a picture: true, false, or null where
   * that is not known without opening the file and [open] says not to.
   */
  pictures: (trackIds: string[], open: boolean) => Promise<ReadonlyMap<string, boolean | null>>;
  /**
   * The picture inside one track's file, kept as one of the app's covers: the
   * kept copy's address, or null where there is none to keep.
   */
  keepPicture: (trackId: string) => Promise<string | null>;
  /** Puts covers on tracks that have none, and answers which took one (`fillCovers`). */
  fill: (fills: CoverFill[]) => string[];
  /** True once whoever asked has lost interest, and the rest is to be left. */
  stopped?: () => boolean;
};

/**
 * How many files are opened at a time to learn whether they carry a picture.
 *
 * Opened one after another on the phone's side, and asked for in handfuls so
 * that a newer pass, or the screen going away, is noticed between them.
 */
const OPENED_AT_ONCE = 40;

/**
 * Gives each planned record's cover to those of its tracks whose files turn
 * out to carry no picture, and answers the tracks that took one.
 *
 * What is already known about the files is asked first, all at once and
 * without opening any. Only the files nobody has looked into are opened, a
 * handful at a time, and only those of tracks something could be given to.
 */
export async function runSpread(plans: SpreadPlan[], deps: SpreadDeps): Promise<string[]> {
  if (plans.length === 0) return [];
  const ids = [...new Set(plans.flatMap((plan) => [
    ...plan.wanting.map((track) => track.id),
    // A record with nothing to give yet may give a picture from a file of its
    // own, and which of its files has one is asked about with the rest.
    ...(plan.cover == null ? plan.album.tracks.map((track) => track.id) : []),
  ]))];

  const known = new Map<string, boolean | null>(await deps.pictures(ids, false));
  const unknown = ids.filter((id) => known.get(id) == null);
  for (let at = 0; at < unknown.length; at += OPENED_AT_ONCE) {
    if (deps.stopped?.()) return [];
    const opened = await deps.pictures(unknown.slice(at, at + OPENED_AT_ONCE), true);
    for (const [id, has] of opened) known.set(id, has);
  }

  const filled: string[] = [];
  for (const plan of plans) {
    if (deps.stopped?.()) break;
    const takers = plan.wanting.filter((track) => known.get(track.id) === false);
    if (takers.length === 0) continue;

    let uri = plan.cover;
    if (uri == null) {
      const source = plan.album.tracks.find((track) => known.get(track.id) === true);
      if (!source) continue;
      uri = await deps.keepPicture(source.id).catch(() => null);
      if (uri == null || deps.stopped?.()) continue;
    }
    filled.push(...deps.fill([{ trackIds: takers.map((track) => track.id), uri, album: null }]));
  }
  return filled;
}
