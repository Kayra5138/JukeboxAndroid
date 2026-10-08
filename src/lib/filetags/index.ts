import { readArtwork } from '../db/metadata.ts';
import { rewritten } from '../identity/index.ts';
import { forgetEmbedded } from '../media/artwork.ts';
import { artworkChanged } from '../media/artworkEvents.ts';
import type { EnrichedTrack } from '../media/enriched.ts';
import { findTrack } from '../media/library.ts';
import { tags } from './native.ts';
import { decline, detailsFor, fromNative, type FileWrite, type Outcome } from './plan.ts';

export { forecast, lineFor, summarise, tally, writable } from './plan.ts';
export type { FileWrite, Outcome } from './plan.ts';

/**
 * Writing what the app shows for a track into the track's own file.
 *
 * Everything else the app knows it keeps to itself, in its database, and a
 * file is never altered. This is the exception, and it only ever happens
 * because somebody pressed a button that says so: not on Save, not after a
 * lookup, not in the background.
 *
 * This file is only the errands. What is written is decided in `plan.ts`, and
 * how it is done without harming the file is the native side's business.
 */

/**
 * Whether this phone and this build can do it at all. False on Android 10 and
 * on a native build from before the module, and then the action is not shown.
 */
export function canWriteFiles(): boolean {
  return tags?.supported === true;
}

export type Run = {
  /** The track now playing, which is left alone. */
  playingId: string | null;
  /** Told as each file is finished: how many are done, of how many. */
  onProgress?: (done: number, total: number) => void;
  /** Asked between files. A file being written is always finished first. */
  stopped?: () => boolean;
};

/**
 * Writes [tracks], as they are shown, into their files.
 *
 * The system asks the user once for the whole run, and nothing is written
 * unless they agree: the answer is then null, which is "nothing happened" and
 * not a list of failures. Otherwise there is one outcome for every track
 * given, in the order given, including the ones that were never attempted.
 */
export async function writeToFiles(tracks: EnrichedTrack[], run: Run): Promise<Outcome[] | null> {
  const module = tags;
  if (!module || !canWriteFiles()) return null;

  const declined = new Map<string, FileWrite>();
  for (const track of tracks) {
    const why = decline(track, run.playingId);
    if (why) declined.set(track.id, why);
  }
  const attempted = tracks.filter((track) => !declined.has(track.id));

  // With nothing to attempt there is nothing to ask permission for.
  if (attempted.length > 0) {
    const agreed = await module.requestWriteAsync(attempted.map((track) => track.id));
    if (!agreed) return null;
  }

  const results = new Map<string, FileWrite>(declined);
  let done = 0;
  let anyWritten = false;
  for (const track of attempted) {
    if (run.stopped?.()) break;
    let result: FileWrite;
    try {
      result = fromNative(await module.writeAsync(track.id, detailsFor(track, readArtwork(track.id))));
    } catch (error) {
      result = {
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
        kept: null,
      };
    }
    results.set(track.id, result);
    if (result.status === 'written') {
      anyWritten = true;
      await afterWriting(track.id);
    }
    run.onProgress?.(++done, attempted.length);
  }

  // The file's own picture may be a different one now.
  if (anyWritten) artworkChanged();

  return tracks
    .filter((track) => results.has(track.id))
    .map((track) => ({ id: track.id, title: track.title, result: results.get(track.id)! }));
}

/**
 * Catches the app's own records up with a file it has just changed.
 *
 * The file is a different size now and the media store reads a different
 * title and artist out of it, and those are part of how a file is known again
 * if it is ever given a new id. Its description is rewritten here, from the
 * store's row as it stands after the rescan the native side waited for, so
 * that the next scan finds the file as it expects to.
 *
 * The loudness measured for the file is filed under its size and date, so it
 * no longer applies and the track is measured again the next time it plays.
 * That is a second or two of work, once, and is left to happen.
 *
 * Never fails the write. The file is right whether or not this is.
 */
async function afterWriting(trackId: string): Promise<void> {
  try {
    forgetEmbedded(trackId);
    const fresh = await findTrack(trackId);
    if (fresh) rewritten(fresh);
  } catch (error) {
    console.warn('A file was written, but its description here was not brought up to date.', error);
  }
}
