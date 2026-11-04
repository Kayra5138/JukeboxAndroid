import { useEffect, useSyncExternalStore } from 'react';

import { useOpenPlayer } from '../player/NowPlayingSheet';
import { usePlayerActions } from '../player/PlayerProvider';
import type { Track } from '../types.ts';
import { useDownloads } from '../youtube/DownloadsProvider';
import { downloads } from '../youtube/native.ts';
import { keepWhatIsListed, letGoOfListened, listening, stopWaiting } from './index.ts';
import { stopPreview } from './preview.ts';

/**
 * Plays a song listened to from the Search tab the moment it is in, and opens
 * the player on it; and, for as long as the app runs, keeps what is put in a
 * list and lets go of what has stayed long enough (see `index.ts`).
 *
 * The moment it is in is the queue saying its job is done: read here from the
 * downloads already being followed, so nothing more is asked of the phone
 * while it is fetched.
 */
export function Listening() {
  const { playQueue } = usePlayerActions();
  const openPlayer = useOpenPlayer();
  const { jobs } = useDownloads();
  const waiting = useSyncExternalStore(listening.subscribe, listening.get);
  const job = waiting ? jobs.find((one) => one.id === waiting.jobId) : undefined;
  const done = job?.status === 'done';
  const failed = job != null && (job.status === 'failed' || job.status === 'cancelled' || job.status === 'missing');

  useEffect(() => {
    if (!waiting || (!done && !failed)) return;
    // No longer waited for, which draws this again: what follows is not tied to this drawing, and is not undone by it.
    stopWaiting();
    // The preview, if one played meanwhile, gives way: to the song itself, or to nothing where it could not be had.
    if (waiting.previewing) void stopPreview();
    if (failed) return;
    void trackOf(waiting.jobId).then(async (track) => {
      // Something else asked to be listened to meanwhile: that one plays when it is in, not this.
      if (!track || listening.get() != null) return;
      // Its picture is fetched beside it and is not always a file yet: the video's own, by its address, until it is.
      await playQueue([track.artworkUri ? track : { ...track, artworkUri: waiting.cover }], 0);
      openPlayer();
    });
  }, [waiting, done, failed, playQueue, openPlayer]);

  useEffect(() => {
    void letGoOfListened();
    return keepWhatIsListed();
  }, []);

  return null;
}

/** The song job [jobId] brought, or null where its file is gone. Never throws. */
async function trackOf(jobId: string): Promise<Track | null> {
  try {
    return (await downloads?.discoverTrackAsync(jobId)) ?? null;
  } catch {
    return null;
  }
}
