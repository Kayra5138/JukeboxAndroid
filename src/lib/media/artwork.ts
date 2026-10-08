import { useEffect, useState, useSyncExternalStore } from 'react';
import { readArtwork } from '../db/metadata';
import { artworkRevision, subscribeArtwork } from './artworkEvents';

import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
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
