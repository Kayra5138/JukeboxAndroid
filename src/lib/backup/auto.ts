import { AppState } from 'react-native';

import JukeboxAudio from '../../../modules/jukebox-audio';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { everyOf, isDue, keepOf, lastOf, type Every } from './due.ts';
import { writeBackupToFolder } from './index.ts';

/**
 * Automatic backup: everything "Export everything" saves, saved by itself
 * now and then into a folder the user chose once, with the oldest beyond a
 * number deleted.
 *
 * Made when one is due as the app is opened or comes back to the front, and
 * with the app closed by the task in `background.ts`. When it is due is
 * decided in `due.ts`. Nothing here throws: a backup that could not be made
 * is written down, for Your data to say so, and tried again at the next
 * chance.
 */

/** Why the last try came to nothing: the folder could not be reached, or the backup could not be made. */
export type BackupTrouble = 'folder' | 'failed';

export type AutoBackup = {
  on: boolean;
  /** The address of the folder this phone was given; null before one is chosen. */
  folder: string | null;
  every: Every;
  keep: number;
  last: number | null;
  trouble: BackupTrouble | null;
};

const read = (key: string): string | null => {
  try {
    return readSetting(key);
  } catch {
    return null;
  }
};

/** How automatic backup is set, as far as the settings can say. */
export function autoBackup(): AutoBackup {
  const trouble = read(SETTINGS.backupTrouble);
  return {
    on: read(SETTINGS.backupAuto) === 'true',
    folder: read(SETTINGS.backupFolder) || null,
    every: everyOf(read(SETTINGS.backupEvery)),
    keep: keepOf(read(SETTINGS.backupKeep)),
    last: lastOf(read(SETTINGS.backupLast)),
    trouble: trouble === 'folder' || trouble === 'failed' ? trouble : null,
  };
}

/** Turns it on or off. A folder newly chosen comes with turning it on, and is kept for the next time. */
export function setAutoBackupOn(on: boolean, folder?: string): void {
  if (folder) {
    writeSetting(SETTINGS.backupFolder, folder);
    // A folder chosen again is a fresh start: what went wrong with the last one is not this one's.
    writeSetting(SETTINGS.backupTrouble, '');
  }
  writeSetting(SETTINGS.backupAuto, on ? 'true' : 'false');
  changed();
}

export function setBackupEvery(every: Every): void {
  writeSetting(SETTINGS.backupEvery, every);
  changed();
}

export function setBackupKeep(keep: number): void {
  writeSetting(SETTINGS.backupKeep, String(keep));
  changed();
}

/*
  Whoever is showing how it stands, told when that changes: a backup made
  behind the screen while Your data is open, say, has its time shown at once.
*/
const listeners = new Set<() => void>();

/** Calls [listener] whenever how automatic backup stands changes; answers the way to stop. */
export function watchAutoBackup(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function changed(): void {
  for (const listener of listeners) listener();
}

/** The one being made, so that a second asked for meanwhile is the same one and not another beside it. */
let making: Promise<boolean> | null = null;

/**
 * One made now, due or not, into the folder chosen: for Back up now, and for
 * the checks below once one is due. Answers whether it was made. Never throws.
 */
export function backUpNow(): Promise<boolean> {
  making ??= make().then((made) => {
    making = null;
    return made;
  });
  return making;
}

async function make(): Promise<boolean> {
  try {
    const { folder, keep } = autoBackup();
    if (!folder || !JukeboxAudio.writeBackupToFolderAsync) return false;
    // Asked first, and cheaply: a folder gone or no longer granted is said as such, and nothing is gathered for it.
    if ((await JukeboxAudio.backupFolderNameAsync?.(folder)) == null) {
      writeSetting(SETTINGS.backupTrouble, 'folder');
      return false;
    }
    await writeBackupToFolder(folder, keep);
    writeSetting(SETTINGS.backupLast, String(Date.now()));
    writeSetting(SETTINGS.backupTrouble, '');
    return true;
  } catch (failure) {
    console.warn('An automatic backup could not be made', failure);
    writeSetting(SETTINGS.backupTrouble, 'failed');
    return false;
  } finally {
    changed();
  }
}

/**
 * One made if it is on and one is due. Answers whether one was made, or null
 * where none was due. Never throws.
 */
export async function backUpIfDue(now = Date.now()): Promise<boolean | null> {
  const settings = autoBackup();
  if (!settings.on || !settings.folder || !isDue(settings.last, settings.every, now)) return null;
  return backUpNow();
}

/** After the app has opened, so the backup is not one more thing done while the first screen is drawn. */
const AFTER_OPENING_MS = 15_000;

/**
 * The check now, or shortly, and again whenever the app comes back to the
 * front. Begun once from the root layout; answers the way to stop. With it
 * off, each check reads a setting and stops.
 */
export function keepBackingUp(): () => void {
  const opening = setTimeout(() => void backUpIfDue(), AFTER_OPENING_MS);
  const returning = AppState.addEventListener('change', (state) => {
    if (state === 'active') void backUpIfDue();
  });
  return () => {
    clearTimeout(opening);
    returning.remove();
  };
}
