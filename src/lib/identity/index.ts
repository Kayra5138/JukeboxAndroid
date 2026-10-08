import { db } from '../db/index.ts';
import type { Cell } from '../backup/format.ts';
import type { BackupDb } from '../backup/store.ts';
import { takeIn, type Memory } from './pass.ts';
import { describe, type Scanned } from './plan.ts';
import {
  dropPairs,
  forgetFiles,
  notePairs,
  readdress,
  suggestions,
  writeFiles,
  type Suggestion,
} from './store.ts';

export type { Side, Suggestion } from './store.ts';

/**
 * Keeping a song's history with the song when its file is given a new id.
 *
 * This file is only the errands, as the backup's is: it holds the database
 * and what is remembered between one scan and the next. What counts as the
 * same file, and what may be done about it without asking, is decided beside
 * it, where it can be tested.
 */

function open(): BackupDb {
  const database = db();
  return {
    all: <T,>(sql: string, ...params: Cell[]) => database.getAllSync<T>(sql, params),
    run: (sql: string, ...params: Cell[]) => {
      database.runSync(sql, params);
    },
    transaction: (work: () => void) => database.withTransactionSync(work),
  };
}

/** What is carried from one scan to the next. Let go of whenever the tables are written. */
const memory: Memory = { files: null, pairs: null, weighed: false };

/** What the last scan returned, for telling a file that is here from one that is not. */
let last: Scanned[] | null = null;

/** Takes in what a scan returned. See [takeIn] for what that comes to. */
export function recognise(tracks: Scanned[]): void {
  if (tracks.length === 0) return;
  last = tracks;
  takeIn(open(), tracks, memory, Date.now());
}

/**
 * The same, later and without fail.
 *
 * Every screen that reads the library ends up here, and none of them should
 * wait for it or be brought down by it: the list of songs is already on its
 * way to the screen, and a history that is not rejoined this time is rejoined
 * the next.
 */
export function recogniseLater(tracks: Scanned[]): void {
  setTimeout(() => {
    try {
      recognise(tracks);
    } catch (error) {
      console.warn('The library could not be compared with what was known of it.', error);
    }
  }, 0);
}

/** The pairs of files that might be one song, for the user to decide. */
export function sameSongs(): Suggestion[] {
  return suggestions(open());
}

/**
 * Joins the two: everything filed under the first is filed under the second.
 *
 * All of it or none. The first file's description is kept only while the file
 * itself is still in the library, where it is a file like any other.
 */
export function mergeSongs(from: string, to: string): void {
  const database = open();
  // Before any scan has been taken in there is no saying whether the file is
  // here, and keeping a description that is not needed costs nothing.
  const stays = (id: string) => last?.some((track) => track.id === id) ?? true;
  database.transaction(() => {
    dropPairs(database, [{ from, to }]);
    readdress(database, [{ from, to }], stays);
  });
  memory.files = null;
  memory.pairs = null;
}

/** Remembers that the two are different songs, so that nobody is asked again. */
export function keepApart(from: string, to: string): void {
  const database = open();
  database.transaction(() => notePairs(database, [{ from, to }], 'apart', Date.now()));
  memory.pairs = null;
}

/**
 * Stops looking for files the app has just erased.
 *
 * The one way a description goes without its history having been moved. A
 * file the user erased here is not coming back under another number, and one
 * that turned up later looking like it would be a different copy.
 *
 * Runs inside the caller's transaction.
 */
export function forgetErased(trackIds: string[]): void {
  forgetFiles(open(), trackIds);
  memory.files = null;
  memory.pairs = null;
}

/**
 * Writes down a file again after the app itself has changed it.
 *
 * Writing a track's details into its file makes the file a different size and
 * gives the media store a different title and artist to report, and all three
 * are in the description. The id and the name have not changed, so the next
 * scan would have taken it for the same file retagged and corrected the
 * description itself; this only means there is never a scan at which what is
 * written down is wrong.
 */
export function rewritten(track: Scanned): void {
  writeFiles(open(), [describe(track)], Date.now());
  memory.files = null;
}
