import { db, readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { mergeSongs } from '../identity/index.ts';
import { libraryFilesChanged } from '../library/index.ts';
import { libraryRoot } from '../media/library.ts';
import { forgetTracks } from '../media/remove.ts';
import { subscribeLists } from '../playlists/listEvents.ts';
import { createStore } from '../ui/store.ts';
import { carried } from '../youtube/carried.ts';
import { downloads } from '../youtube/native.ts';
import type { DownloadJob, YouTubeVideo } from '../youtube/types.ts';
import { noteKept } from './kept.ts';
import { previewWhileWaiting } from './preview.ts';
import { listenDue, LISTEN_PREFIX, listenJobOf } from './rules.ts';

export { isListened, LISTEN_PREFIX } from './rules.ts';

/**
 * Listening without keeping: a video found on the Search tab played at once,
 * without its becoming a song of the library. It is fetched first of
 * everything waiting, into the app's own files as a song of Discover's is,
 * and plays the moment it is in. Kept — hearted, put in a list, or kept by
 * hand from its menu — it is copied into the library and its history goes
 * with it; not kept, it is let go some days after it was fetched (a week
 * unless set otherwise), unless it is in the player's queue.
 *
 * The playing itself is `Listening.tsx`, which has the player to hand; this
 * is the asking, the keeping and the letting go.
 */

/**
 * The video being waited for to play, by its job: one at a time, the latest
 * asked for. [cover] is the video's own picture, for the player to show
 * until the phone has it as a file; [previewing] is that a preview of it
 * plays meanwhile.
 */
export const listening = createStore<{ jobId: string; videoId: string; cover: string; previewing?: boolean } | null>(null);

/** [video] listened to: fetched first, to be played the moment it is in, a preview of it meanwhile where one is found. Answers with its job. */
export async function listenTo(video: YouTubeVideo): Promise<string> {
  if (!downloads?.listenAsync) throw new Error('unavailable');
  const jobId = await downloads.listenAsync(carried(video), 'original', libraryRoot());
  listening.set({ jobId, videoId: video.id, cover: coverOf(video) });
  void previewWhileWaiting(
    video,
    () => listening.get()?.jobId === jobId,
    () => {
      const waiting = listening.get();
      if (waiting?.jobId === jobId) listening.set({ ...waiting, previewing: true });
    }
  );
  return jobId;
}

/** The picture the phone keeps for a song listened to, as an address: the one the video was found with, or else YouTube's own. */
function coverOf(video: YouTubeVideo): string {
  return video.thumbnail?.startsWith('https://') ? video.thumbnail : `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}

/** Waiting for nothing to play any more: another thing was started meanwhile, or it has been played. */
export function stopWaiting(): void {
  listening.set(null);
}

/** How many days a song listened to and not kept stays. */
export const LISTEN_DAYS_RANGE = { min: 1, max: 60 } as const;
const DEFAULT_LISTEN_DAYS = 7;

export function listenDays(): number {
  const saved = Number(readSetting(SETTINGS.listenDays));
  return Number.isInteger(saved) && saved >= LISTEN_DAYS_RANGE.min && saved <= LISTEN_DAYS_RANGE.max ? saved : DEFAULT_LISTEN_DAYS;
}

export function setListenDays(days: number): void {
  writeSetting(SETTINGS.listenDays, String(days));
}

/** The keepings under way, so that a song hearted twice in a moment is copied once. */
const keeping = new Map<string, Promise<string | null>>();

/**
 * [trackId], a song listened to, kept: copied into the library, its history,
 * lists and details moved over to the song it now is. Answers with that
 * song's id, or null where it could not be kept. Never throws.
 */
export function keepListened(trackId: string): Promise<string | null> {
  const already = keeping.get(trackId);
  if (already) return already;
  const work = (async () => {
    const jobId = listenJobOf(trackId);
    if (!jobId || !downloads?.keepDiscoverAsync) return null;
    try {
      const kept = await downloads.keepDiscoverAsync(jobId, libraryRoot());
      mergeSongs(trackId, kept);
      noteKept(trackId, kept);
      libraryFilesChanged();
      // The private copy goes once nothing is playing from it; the queue keeps it while it is there.
      void downloads.cleanDiscoverAsync?.([jobId], []).catch(() => []);
      return kept;
    } catch (error) {
      console.warn('A song listened to could not be kept', error);
      return null;
    } finally {
      keeping.delete(trackId);
    }
  })();
  keeping.set(trackId, work);
  return work;
}

/**
 * [trackId], a song listened to, not wanted: its file let go now rather
 * than in its days, and what was learned of it with it; what was heard of it
 * stays, as it does for any song. Asked once it has left the queue, which
 * otherwise keeps the file for as long as it is there. Never throws.
 */
export async function dropListened(trackId: string): Promise<void> {
  const jobId = listenJobOf(trackId);
  if (!jobId || !downloads?.cleanDiscoverAsync) return;
  try {
    // The player writes its queue down in a moment: asked a little later, the file is no longer kept for it.
    await new Promise((done) => setTimeout(done, 1500));
    const gone = await downloads.cleanDiscoverAsync([jobId], []);
    if (gone.length > 0) forgetTracks([trackId]);
  } catch (error) {
    console.warn('A song listened to could not be let go of', error);
  }
}

/** The songs listened to that are in a list, Favorites among them: kept, each, as being in a list is keeping. Never throws. */
export async function keepListed(): Promise<void> {
  try {
    const listed = db().getAllSync<{ track_id: string }>(
      `SELECT DISTINCT track_id FROM playlist_tracks WHERE track_id LIKE ?`,
      `${LISTEN_PREFIX}%`
    );
    for (const { track_id } of listed) await keepListened(track_id);
  } catch (error) {
    console.warn('The songs listened to in lists could not be kept', error);
  }
}

/** Listened to a song and put it in a list: kept, from now on, whichever way it was put there. Answers with how to stop. */
export function keepWhatIsListed(): () => void {
  void keepListed();
  return subscribeLists(() => void keepListed());
}

/** The songs listened to and not kept, fetched longer ago than they stay: let go, those not in the queue. Never throws. */
export async function letGoOfListened(now = Date.now()): Promise<void> {
  try {
    if (!downloads?.cleanDiscoverAsync) return;
    const jobs = (await downloads.getJobsAsync(false)) as DownloadJob[];
    const due = listenDue(jobs, listenDays(), now);
    if (due.length === 0) return;
    const gone = await downloads.cleanDiscoverAsync(due, []);
    // What was learned of them goes too, their lyrics and details; what was heard of them stays, as it does for any song.
    if (gone.length > 0) forgetTracks(gone.map((id) => `${LISTEN_PREFIX}${id}`));
  } catch (error) {
    console.warn('The songs listened to could not be let go of', error);
  }
}
