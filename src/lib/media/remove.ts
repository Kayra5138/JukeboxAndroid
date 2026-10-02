import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { db } from '../db/index.ts';

/**
 * Erases tracks from the device.
 *
 * The system asks the user before anything goes, and answers with what they
 * said. Nothing here happens until it comes back true — a refusal has to leave
 * the library exactly as it was, not half tidied up.
 *
 * Returns whether the files were deleted.
 */
export async function deleteTracks(trackIds: string[]): Promise<boolean> {
  if (trackIds.length === 0) return false;

  const deleted = await JukeboxAudio.deleteTracksAsync(trackIds);
  if (!deleted) return false;

  forgetEverythingAbout(trackIds);
  return true;
}

/**
 * Clears what was learned about tracks that no longer exist.
 *
 * Listening history is deliberately left alone. It is kept denormalized
 * precisely so that it outlives the file it came from: what you listened to
 * last year happened, whether or not the file is still on the phone.
 */
function forgetEverythingAbout(trackIds: string[]): void {
  const placeholders = trackIds.map(() => '?').join(',');
  const database = db();

  // One change, not four. Interrupted half way — a throw, the process killed —
  // the rows left behind belong to a track that no longer exists, and nothing
  // ever visits them again to notice.
  database.withTransactionSync(() => {
    for (const table of ['track_metadata', 'track_tags', 'track_lyrics', 'lyric_translations']) {
      database.runSync(
        `DELETE FROM ${table} WHERE track_id IN (${placeholders})`,
        ...trackIds
      );
    }
  });
}
