import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';

/**
 * Every song waiting in the queue: the player's own, and the one kept for it
 * to put back when it is woken, which is all there is with no player running
 * (a task in the background). For what deletes files, which leaves these
 * alone: the player stopped at a file gone.
 *
 * Null where either could not be read, which is to be taken as "delete
 * nothing": an empty answer for a queue that could not be read took the
 * guard away without a word.
 */
export async function queuedIds(): Promise<Set<string> | null> {
  try {
    const live = await JukeboxAudio.getQueueAsync();
    const kept = JukeboxAudio.getSavedQueueIdsAsync ? await JukeboxAudio.getSavedQueueIdsAsync() : [];
    return new Set([...live.map((entry) => entry.id), ...kept]);
  } catch {
    return null;
  }
}
