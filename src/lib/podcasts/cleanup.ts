import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { db, readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { refreshLibrary } from '../library/index.ts';
import { scanLibrary } from '../media/library.ts';
import { forgetTracks } from '../media/remove.ts';
import { queuedIds } from '../player/queuedIds.ts';
import { refreshTapePlaces, type TapePlace } from '../tapes/places.ts';
import { isTape } from '../tapes/tape.ts';
import { deleteDaysFrom, playedLongAgo } from './played.ts';
import { seriesFolderOf } from './series.ts';
import { subscriptions } from './store.ts';

/**
 * Episodes of the followed podcasts deleted some days after they were heard
 * to the end, for somebody who sets it: off unless they do. Only files the app
 * fetched itself go, without asking, as the phone lets an app take away what it
 * made; one put there by hand is left. The one in the player is left too.
 */

/** After how many days a heard episode goes; null for never. */
export function deletePlayedDays(): number | null {
  return deleteDaysFrom(readSetting(SETTINGS.podcastsDeletePlayedDays));
}

export function setDeletePlayedDays(days: number | null): void {
  writeSetting(SETTINGS.podcastsDeletePlayedDays, days == null ? '0' : String(days));
}

/** The episodes due to go, gone. Answers with how many. Never throws. */
export async function cleanUpPlayed(now = Date.now()): Promise<number> {
  try {
    const days = deletePlayedDays();
    if (days == null || !JukeboxAudio.deleteOwnTracksAsync) return 0;
    const shows = subscriptions();
    if (shows.length === 0) return 0;
    const folders = new Set(shows.map((show) => seriesFolderOf(show)));
    const read = (await JukeboxAudio.getTapePlacesAsync()) as Record<string, TapePlace> | null;
    const places = new Map(Object.entries(read ?? {}));
    const tapes = (await scanLibrary()).filter((track) => isTape(track));
    const playing = (await JukeboxAudio.getStatusAsync().catch(() => null))?.trackId ?? null;
    // One with marks in it is kept: somebody noted something there to come back to, and it goes only by hand.
    const marked = new Set(db().getAllSync<{ track_id: string }>('SELECT DISTINCT track_id FROM tape_marks').map((row) => row.track_id));
    const heard = playedLongAgo(tapes, places, folders, days, now).filter((tape) => tape.id !== playing && !marked.has(tape.id));
    if (heard.length === 0) return 0;
    /*
      Nor one waiting in the queue: a show played from its page has its later
      episodes there, and the player stopped at a file gone. The kept queue
      too, which is the only one there is when this runs in the background
      with no player; and nothing at all where the queue could not be read.
    */
    const queued = await queuedIds();
    if (!queued) return 0;
    const due = heard.filter((tape) => !queued.has(tape.id));
    if (due.length === 0) return 0;
    const erased = await JukeboxAudio.deleteOwnTracksAsync(due.map((tape) => tape.id));
    if (erased.length > 0) {
      // What was known of them goes with them, as it does for a file deleted by hand: their marks above all.
      forgetTracks(erased);
      void refreshLibrary();
      refreshTapePlaces();
    }
    return erased.length;
  } catch (error) {
    console.warn('Could not delete heard episodes', error);
    return 0;
  }
}
