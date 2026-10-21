import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { db } from '../db/index.ts';
import type { EnrichedTrack } from '../media/enriched.ts';
import {
  ensureAudioPermission,
  libraryHiding,
  libraryRoot,
  libraryStamp,
  scanUnder,
} from '../media/library.ts';
import { withMetadata } from '../media/merge.ts';
import { knowNamesFrom } from '../support/errorLogStore.ts';
import { welcomePassed } from '../ui/welcomeStore.ts';
import { watchOverlay } from './overlay.ts';
import { createLibraryStore, type LibraryState } from './store.ts';

export type { LibraryState } from './store.ts';

/**
 * The one library every screen shows, with the real device behind it.
 *
 * What it does and when it reads is in `store.ts`; this is only the errands
 * it is sent on. A screen draws from `useLibrary.ts`, and asks for another
 * look with {@link refreshLibrary} as freely as it used to scan.
 */

/**
 * Where the library is written down between one start of the app and the
 * next.
 *
 * A database of its own, beside the app's and no part of it. What is kept is
 * megabytes of something the device will say again for the asking, written
 * over whole each time a file comes or goes: in with the listening history it
 * would swell that database's log with every download, and be one more thing
 * a backup and a migration had to step around. Here it can be thrown away —
 * and is, the moment it will not open — without anything of the user's being
 * near it.
 */
const KEPT_IN = 'library-cache.db';

let keptDb: SQLiteDatabase | null = null;
/** Set once it has refused to open twice over. Nothing is kept for the rest of this run. */
let keptBroken = false;

function openKept(): SQLiteDatabase {
  const opened = openDatabaseSync(KEPT_IN);
  try {
    opened.execSync(
      'CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY CHECK (id = 1), words TEXT NOT NULL)'
    );
  } catch (error) {
    try {
      opened.closeSync();
    } catch {
      // The failure worth knowing about is the one above.
    }
    throw error;
  }
  return opened;
}

function kept(): SQLiteDatabase {
  if (keptDb) return keptDb;
  if (keptBroken) throw new Error('The library is not being kept.');
  try {
    keptDb = openKept();
  } catch {
    // A file that will not open is not worth a second thought: it held
    // nothing that cannot be read again. Removed and begun afresh, once.
    try {
      deleteDatabaseSync(KEPT_IN);
      keptDb = openKept();
    } catch (error) {
      keptBroken = true;
      throw error;
    }
  }
  return keptDb;
}

/** How long writing the library down waits, so as to come after the list it describes is on screen. */
const KEEP_AFTER_MS = 1500;

let countWrites: (() => number) | null = null;

const store = createLibraryStore({
  /*
    Not until the first start's setup is put away: the dialog asking for
    the music would come up over it, in whatever language the phone speaks,
    before anybody had said which one the app is to. Somebody updating, who
    is shown the newer screens of it, gave the permission long ago.
  */
  permitted: async () => {
    await welcomePassed();
    return ensureAudioPermission();
  },
  root: libraryRoot,
  scan: scanUnder,
  stamp: libraryStamp,
  hiding: libraryHiding,
  merge: withMetadata,
  // A throw from here is caught by the store, and read as "cannot say".
  overlay: () => (countWrites ??= watchOverlay(db()))(),
  kept: {
    read: () => kept().getFirstSync<{ words: string }>('SELECT words FROM library WHERE id = 1')?.words ?? null,
    write: (words) => {
      kept().runSync(
        'INSERT INTO library (id, words) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET words = excluded.words',
        words
      );
    },
    clear: () => {
      kept().runSync('DELETE FROM library');
    },
  },
  later: (work) => {
    setTimeout(work, KEEP_AFTER_MS);
  },
});

export const libraryState = (): LibraryState => store.state();

/*
  The names in the library, for the error log to take out of what it writes
  down (rule 0 of `support/scrub.ts`): a failure's message can carry a song's
  name set off by nothing, and these are the names it would be.
*/
knowNamesFrom(() => {
  const now = store.state();
  if (now.kind !== 'library') return [];
  const names: string[] = [];
  for (const track of now.tracks) {
    for (const name of [track.title, track.artist, track.album, track.albumArtist, track.filename, track.filename?.replace(/\.[^.]+$/, '')]) {
      if (name) names.push(name);
    }
  }
  return names;
});
export const subscribeLibrary = (listener: () => void): (() => void) => store.subscribe(listener);

/**
 * Looks at the device again, and reads the library if it has changed.
 *
 * Cheap enough to ask on every visit to a screen, which is when it is asked:
 * a look that finds everything as it was reads nothing and wakes nobody.
 * [force] reads the whole library whether or not it seems to have changed,
 * for the times somebody has asked in so many words, and for the times the
 * app itself has just changed a file and should not wait to be told.
 *
 * Never rejects. What went wrong, if anything did, is in {@link libraryState}.
 */
export function refreshLibrary(force = false): Promise<void> {
  return store.refresh(force);
}

/**
 * Says the app has just changed the files themselves: erased some, written
 * into one, brought one in, or been pointed at another folder.
 *
 * The same as a forced look, under a name that says why it is being asked.
 * Nothing waits on it; whichever screens are showing the library are told
 * when the reading is in.
 */
export function libraryFilesChanged(): void {
  void store.refresh(true);
}

/**
 * Says what the library leaves out has been changed: a folder switched off or
 * back on, or the shortest a file may be.
 *
 * A look, not a forced one. The device need not be read again for it, since
 * the library keeps the whole folder and leaves out as it shows; the look
 * finds the rule changed, and the screens are told.
 */
export function libraryHidingChanged(): void {
  void store.refresh();
}

/**
 * The library, looked at afresh, for a caller that is not drawing it but
 * working something out from it.
 *
 * Empty where the app may not read audio, which is what a scan without leave
 * comes back as. Throws where the library could not be read and there was
 * none already held, as a scan would have; where one was held, that one is
 * the answer, and the failure is the store's to tell.
 */
export async function readLibrary(): Promise<EnrichedTrack[]> {
  await store.refresh();
  const state = store.state();
  if (state.kind === 'library') return state.tracks;
  if (state.kind === 'error') throw new Error(state.message);
  return [];
}
