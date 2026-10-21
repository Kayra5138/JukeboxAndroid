import { useEffect, useState, useSyncExternalStore } from 'react';
import { readArtwork } from '../db/metadata';
import { artworkRevision, subscribeArtwork } from './artworkEvents';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { isEmbeddedPicture, isStoredCover } from '../metadata/covers';
import type { Track } from '../types.ts';

/**
 * Covers that have been found, so a list can scroll back over a row without
 * asking again.
 *
 * Only hits are kept. A miss used to be cached here too, which made a negative
 * answer permanent for the whole process — nothing ever cleared it — and it
 * bought nothing: the native side now remembers which files carry no picture,
 * and a miss looks exactly like the blank that was already on screen, so there
 * is no flicker to prevent either.
 */
const found = new Map<string, string>();

/**
 * Forgets the picture found inside a track's file, because the file has just
 * been written to and may carry another. What was remembered is the address
 * of a copy made from the file as it was, which the native side clears away
 * the next time it is asked about the track.
 */
export function forgetEmbedded(trackId: string): void {
  found.delete(trackId);
  asked.delete(trackId);
  // Any record whose sleeve was worked out with this track among it.
  for (const key of sleeves.keys()) {
    if (key.startsWith(`${trackId}\u001f`) || key.includes(`\u001e${trackId}\u001f`)) sleeves.delete(key);
  }
}

/**
 * The tracks {@link warmArtwork} has already asked about, picture or none.
 *
 * Not the cache of misses that was taken out of the map above. Nothing drawn
 * reads this: a row still asks for itself each time it comes on screen, so a
 * cover that turns up later is still found. It only stops the same run of
 * questions being put again each time a list is rebuilt.
 */
const asked = new Set<string>();

/**
 * Finds the covers of [tracks] before anything is drawing them, in the order
 * given, and answers with what stops it.
 *
 * For a view that can be thrown across the whole library faster than its
 * covers can be asked for one by one. A row that asks for itself is drawn
 * empty first and again when the answer comes, and that answer waits behind
 * every row the throw passed on its way; with the covers found beforehand a
 * row has its picture the first time it is drawn.
 *
 * One at a time, so that a few hundred files being opened is a queue behind
 * whatever the screen itself is asking for and not a crowd in front of it.
 * A track that already carries a picture of the app's own is not asked about:
 * that is the one the hook shows, and it is there without asking.
 */
export function warmArtwork(tracks: readonly (Track | null | undefined)[]): () => void {
  let stopped = false;
  const run = async () => {
    for (const track of tracks) {
      if (stopped) return;
      if (!track || found.has(track.id) || asked.has(track.id)) continue;
      if (track.artworkUri?.startsWith('file://')) continue;
      asked.add(track.id);
      await artworkFor(track.id);
    }
  };
  // A cover not found beforehand is asked for by its row, as it always was.
  run().catch(() => undefined);
  return () => {
    stopped = true;
  };
}

/**
 * The cover for a track: the picture inside the file, or whatever a lookup
 * turned up for it.
 *
 * The media store's own album art is not an option — it is per album, so a
 * folder of untagged files is filed as one album and shows a single cover for
 * the lot, and its provider stopped resolving around Android 10 regardless.
 * Reading the picture out of the file means opening it, so this only happens
 * for tracks actually on screen. `artworkUri` is null on a track straight from
 * the library and carries a looked-up cover once `withMetadata` has been over
 * it, which is the remaining reason to consult it.
 */
/**
 * The cover for a track id, asked for outside a component.
 *
 * The same order the hook uses, and the same cache, so a cover already on
 * screen costs nothing here. For the recap, which needs a handful of covers at
 * once and has nowhere to put a hook per row.
 */
export async function artworkFor(trackId: string): Promise<string | null> {
  const catalogue = readArtwork(trackId);
  if (catalogue?.startsWith('file://')) return catalogue;

  const known = found.get(trackId);
  if (known !== undefined) return known;

  const embedded = await JukeboxAudio.getEmbeddedArtworkAsync(trackId).catch(() => null);
  if (embedded) found.set(trackId, embedded);
  return embedded ?? catalogue ?? null;
}

export function useTrackArtwork(track: Track | null): string | null {
  const revision = useSyncExternalStore(subscribeArtwork, artworkRevision);
  const [uri, setUri] = useState<string | null>(() =>
    track ? (found.get(track.id) ?? track.artworkUri) : null
  );

  useEffect(() => {
    if (!track) {
      setUri(null);
      return;
    }
    // Known covers are shown straight away, which is what keeps a recycled row
    // from blinking. Anything else drops back to what this track itself offers
    // before asking: a row reused from another track would otherwise go on
    // showing that track's cover until the answer arrived, and the wrong
    // picture is worse than a blank one.
    // A later Tags lookup can upgrade a downloaded YouTube thumbnail.
    const catalogue = readArtwork(track.id);
    if (catalogue?.startsWith('file://')) {
      setUri(catalogue);
      return;
    }
    const known = found.get(track.id);
    if (known !== undefined) {
      setUri(known);
      return;
    }
    const fallback = catalogue ?? track.artworkUri;
    setUri(fallback);

    let cancelled = false;
    void JukeboxAudio.getEmbeddedArtworkAsync(track.id).then((embedded) => {
      if (embedded) found.set(track.id, embedded);
      if (!cancelled) setUri(embedded ?? fallback);
    }).catch(() => { if (!cancelled) setUri(fallback); });
    return () => {
      cancelled = true;
    };
  }, [track, revision]);

  return uri;
}

/**
 * How many of a record's tracks are opened, at most, looking for a picture in
 * a file. A record is a dozen tracks or two; a folder or an artist handed to
 * this can be hundreds, and the first picture is nearly always among the
 * first few, so the rest are not worth a file each.
 */
const SEARCHED = 30;

/**
 * The covers of records already worked out, by the tracks they were worked
 * out from. Only hits, for the reason {@link found} keeps only hits.
 */
const sleeves = new Map<string, string>();

/** What a record's cover depends on: which tracks, in which order, wearing what. */
function sleeveKey(tracks: readonly Track[]): string {
  let key = '';
  for (const track of tracks) key += `${track.id}\u001f${track.artworkUri ?? ''}\u001e`;
  return key;
}

/**
 * The cover the app holds that most of [tracks] wear, the first met between
 * equals, or null where none of them wears one.
 */
function storedSleeve(tracks: readonly Track[]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  for (const track of tracks) {
    const uri = track.artworkUri;
    if (!isStoredCover(uri)) continue;
    const count = (counts.get(uri) ?? 0) + 1;
    counts.set(uri, count);
    if (best == null || count > counts.get(best)!) best = uri;
  }
  return best;
}

/**
 * The cover of a record, asked for outside a component: see
 * {@link useAlbumArtwork}, which is this and a hook. [spread] is told when
 * the picture was found in a file after one or more that had none, which is
 * a record with a gap in it, and is handed those tracks and the one with the
 * picture.
 */
export async function albumArtworkFor(
  tracks: readonly Track[],
  spread?: (tracks: readonly Track[]) => void
): Promise<string | null> {
  if (tracks.length === 0) return null;
  const stored = storedSleeve(tracks);
  if (stored) return stored;

  const key = sleeveKey(tracks);
  const known = sleeves.get(key);
  if (known !== undefined) return known;

  // In the record's own order, and stopping at the first: each is a file
  // opened, unless the phone has looked into it before.
  let thumbnail: string | null = null;
  for (let at = 0; at < Math.min(tracks.length, SEARCHED); at += 1) {
    const track = tracks[at]!;
    const uri = found.get(track.id) ?? (await JukeboxAudio.getEmbeddedArtworkAsync(track.id).catch(() => null));
    if (!uri) continue;
    if (isEmbeddedPicture(uri)) {
      found.set(track.id, uri);
      sleeves.set(key, uri);
      // The ones asked before it and found bare, and the one that answered:
      // only their records, not every record a folder of hundreds touches.
      if (at > 0) spread?.(tracks.slice(0, at + 1));
      return uri;
    }
    // A download's thumbnail: a frame of a video, kept for last.
    thumbnail ??= uri;
  }
  const last = thumbnail ?? tracks.find((track) => track.artworkUri)?.artworkUri ?? null;
  if (last) sleeves.set(key, last);
  return last;
}

/**
 * Finds the covers of [records] before anything is drawing them, one at a
 * time and in the order given, and answers with what stops it: the record
 * {@link warmArtwork} is for a single track. For the rack, which can be
 * thrown across the library faster than its sleeves can be asked for.
 */
export function warmAlbumArtwork(records: readonly (readonly Track[] | null | undefined)[]): () => void {
  let stopped = false;
  const run = async () => {
    for (const tracks of records) {
      if (stopped) return;
      if (!tracks || tracks.length === 0 || storedSleeve(tracks) || sleeves.has(sleeveKey(tracks))) continue;
      await albumArtworkFor(tracks);
    }
  };
  run().catch(() => undefined);
  return () => {
    stopped = true;
  };
}

/**
 * The cover of a record, an artist or a folder: of anything standing for
 * several tracks with one picture.
 *
 *  1. The cover the app holds that most of the tracks wear: looked up,
 *     chosen, or given by the rest of the record.
 *  2. Otherwise the picture inside the first file, in the tracks' own order,
 *     that carries one. A record whose first track has none is not a record
 *     with no cover — the first track is as often as not an intro somebody
 *     downloaded on its own — so the others are asked in turn, and asking
 *     stops at the first that answers. The ones before it are given that
 *     picture to keep, so they wear it everywhere else as well
 *     ([onGap], `media/coverSpread.ts`).
 *  3. Otherwise a download's thumbnail, and failing that an address a lookup
 *     gave, which are the least of covers and come last.
 *
 * The answer for a set of tracks is kept, so a list scrolling back over a
 * row does not ask again.
 */
export function useAlbumArtwork(
  tracks: readonly Track[] | null,
  onGap?: (tracks: readonly Track[]) => void
): string | null {
  const revision = useSyncExternalStore(subscribeArtwork, artworkRevision);
  const [uri, setUri] = useState<string | null>(() =>
    tracks ? (storedSleeve(tracks) ?? sleeves.get(sleeveKey(tracks)) ?? null) : null
  );

  useEffect(() => {
    if (!tracks || tracks.length === 0) {
      setUri(null);
      return;
    }
    const stored = storedSleeve(tracks);
    if (stored) {
      setUri(stored);
      return;
    }
    const known = sleeves.get(sleeveKey(tracks));
    // What is known is shown at once; otherwise a blank rather than another
    // record's sleeve left over in a recycled row.
    setUri(known ?? null);
    if (known !== undefined) return;

    let cancelled = false;
    void albumArtworkFor(tracks, onGap).then((answer) => {
      if (!cancelled) setUri(answer);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // The callback is not a reason to look again: it is only who to tell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, revision]);

  return uri;
}
