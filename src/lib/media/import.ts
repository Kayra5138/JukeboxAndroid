import { findTrack } from './library.ts';
import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { isManual, writeLyrics } from '../db/lyrics.ts';
import { fetchLyrics } from '../lyrics/lrclib.ts';
import { enrichLibrary } from '../metadata/enrich.ts';

/**
 * Everything that happens to a file once it is in the library: find out what it
 * is, and find its words.
 *
 * Both are best-effort, and both are abortable. A single throttled lookup can
 * wait out a minute-long backoff, and a minute is far too long for a button to
 * spin with no way out — the file is already in the library and playable by
 * then, which is the part that matters.
 *
 * None of it is allowed to reject, which is why the whole of it is wrapped
 * rather than each call being guarded in turn. It runs after the bytes have
 * landed, so a throw reaching the caller reads as an import that failed — and
 * the answer to a failed import is to try it again, which copies the same song
 * in a second time under a suffixed name. A missing artist is worth none of
 * that: it is looked for again on the next pass over the library.
 */
export async function describeTrack(trackId: string, signal?: AbortSignal): Promise<void> {
  try {
    const track = await findTrack(trackId);
    if (!track || signal?.aborted) return;

    await enrichLibrary([track], () => {}, signal);
    if (signal?.aborted) return;

    // Words somebody chose are not a guess waiting to be improved on, and this
    // runs from "look up details" as well as from an import.
    if (isManual(trackId)) return;

    const lyrics = await fetchLyrics(
      {
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSec: track.durationSec,
      },
      signal
    );
    writeLyrics(trackId, lyrics, Date.now());
  } catch {
    return;
  }
}
