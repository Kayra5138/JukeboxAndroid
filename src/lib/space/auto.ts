import JukeboxAudio from '../../../modules/jukebox-audio/index.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { refreshLibrary } from '../library/index.ts';
import { scanLibrary } from '../media/library.ts';
import { forgetTracks } from '../media/remove.ts';
import { isTape } from '../tapes/tape.ts';
import { wholeIn } from '../ui/range.ts';
import { AUTO_MONTHS_RANGE, dueForDeletion, dueToLook, LONG_AGO_MONTHS, type AutoSettings } from './candidates.ts';
import { membershipOf, readListening, readLists, readOwnTracks } from './read.ts';

/**
 * Songs the app downloaded itself deleted once nobody has listened to them
 * for some months, for somebody who turns it on: off unless they do. Only
 * those, and without asking, as the phone lets an app take away what it made;
 * a file put there any other way is left. Never the one playing, never a tape,
 * and never one in Favorites or a list unless that is turned on too. It looks
 * once a day at the most. Which songs are due is in `candidates.ts`.
 */

/** Whether it is on, and how it is set. */
export type AutoDelete = AutoSettings & { on: boolean };

export function autoDelete(): AutoDelete {
  return {
    on: readSetting(SETTINGS.spaceAutoDelete) === 'true',
    months: wholeIn(readSetting(SETTINGS.spaceAutoMonths), AUTO_MONTHS_RANGE) ?? LONG_AGO_MONTHS,
    favorites: readSetting(SETTINGS.spaceAutoFavorites) === 'true',
    lists: readSetting(SETTINGS.spaceAutoLists) === 'true',
  };
}

export function setAutoDelete(change: Partial<AutoDelete>): void {
  if (change.on != null) writeSetting(SETTINGS.spaceAutoDelete, change.on ? 'true' : 'false');
  if (change.months != null) writeSetting(SETTINGS.spaceAutoMonths, String(change.months));
  if (change.favorites != null) writeSetting(SETTINGS.spaceAutoFavorites, change.favorites ? 'true' : 'false');
  if (change.lists != null) writeSetting(SETTINGS.spaceAutoLists, change.lists ? 'true' : 'false');
}

/**
 * The songs due to go, gone, where it is on. Answers with how many. Never throws.
 *
 * Any of what it reads failing is nothing deleted: a history that could not
 * be read would make every song look unheard.
 */
export async function deleteUnheard(now = Date.now()): Promise<number> {
  try {
    const settings = autoDelete();
    if (!settings.on || !JukeboxAudio.deleteOwnTracksAsync) return 0;
    const own = await readOwnTracks();
    if (own.size === 0) return 0;
    const songs = (await scanLibrary()).filter((track) => !isTape(track));
    const playing = (await JukeboxAudio.getStatusAsync().catch(() => null))?.trackId ?? null;
    const due = dueForDeletion(songs, readListening(), own, membershipOf(readLists()), settings, playing, now);
    if (due.length === 0) return 0;
    const erased = await JukeboxAudio.deleteOwnTracksAsync(due.map((track) => track.id));
    if (erased.length > 0) {
      // What was known of them goes with them, as it does for a file deleted by hand.
      forgetTracks(erased);
      void refreshLibrary();
    }
    return erased.length;
  } catch (error) {
    console.warn('Could not delete songs nobody has listened to', error);
    return 0;
  }
}

/** The look, where a day has gone by since the last one; the day is counted from a look made, not from one that found nothing. */
async function lookIfDue(): Promise<void> {
  try {
    if (readSetting(SETTINGS.spaceAutoDelete) !== 'true') return;
    const now = Date.now();
    const saved = readSetting(SETTINGS.spaceAutoLooked);
    if (!dueToLook(saved == null ? null : Number(saved), now)) return;
    writeSetting(SETTINGS.spaceAutoLooked, String(now));
    await deleteUnheard(now);
  } catch (error) {
    console.warn('Could not look for songs nobody has listened to', error);
  }
}

/**
 * Looks a little after the app starts, out of the way of the first screen,
 * and then every hour while it is open, which does nothing until a day has
 * gone by. With the switch off each look reads one setting and stops.
 */
export function keepSpaceFreed(): () => void {
  const look = () => void lookIfDue();
  const first = setTimeout(look, 45_000);
  const every = setInterval(look, 60 * 60 * 1000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
