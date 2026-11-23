import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { db } from '../db/index.ts';
import { dropFromEveryList } from '../db/playlists.ts';
import { forgetErased } from '../identity/index.ts';
import { libraryFilesChanged } from '../library/index.ts';
import { marksChanged } from '../tapes/marks.ts';

/**
 * Erases tracks from the device.
 *
 * The system asks the user before anything goes, and answers with what they
 * said. Nothing here happens until it comes back true — a refusal has to leave
 * the library exactly as it was, not half tidied up.
 *
 * [beforeForgetting] is for what has to happen once the files are known to
 * be gone and before what was known about them is let go of: a copy's
 * history moved to the copy kept, which a refusal must not have done.
 *
 * Returns whether the files were deleted.
 */
export async function deleteTracks(trackIds: string[], beforeForgetting?: () => void): Promise<boolean> {
  if (trackIds.length === 0) return false;

  const deleted = await JukeboxAudio.deleteTracksAsync(trackIds);
  if (!deleted) return false;

  try {
    beforeForgetting?.();
  } catch (error) {
    console.warn('Could not finish what goes with deleting', error);
  }
  forgetTracks(trackIds);
  // Said here, so that no way of erasing a file can leave it standing in a
  // list: the library every screen shows is read again from the device.
  libraryFilesChanged();
  return true;
}

/**
 * Clears what was learned about tracks that no longer exist.
 *
 * Listening history is deliberately left alone. It is kept denormalized
 * precisely so that it outlives the file it came from: what you listened to
 * last year happened, whether or not the file is still on the phone.
 */
export function forgetTracks(trackIds: readonly string[]): void {
  if (trackIds.length === 0) return;
  // The ids as one value rather than one each: past some thirty thousand, a whole library let go of at once, SQLite would take no more.
  const ids = JSON.stringify(trackIds.map(String));
  const database = db();

  // One change, not several. Interrupted half way — a throw, the process killed —
  // the rows left behind belong to a track that no longer exists, and nothing
  // ever visits them again to notice.
  database.withTransactionSync(() => {
    // A tape's marks too: places in a recording that is no longer there to go back to.
    for (const table of ['track_metadata', 'track_tags', 'track_lyrics', 'lyric_translations', 'shared_covers', 'tape_marks']) {
      database.runSync(`DELETE FROM ${table} WHERE track_id IN (SELECT value FROM json_each(?))`, ids);
    }
    dropFromEveryList([...trackIds]);
    // And it stops being looked for. Until now a file that had gone might
    // have been moved; this one is known to have been erased.
    forgetErased([...trackIds]);
  });
  marksChanged();
}
