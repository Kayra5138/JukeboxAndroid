import JukeboxAudio from '../../../modules/jukebox-audio';
import { db } from '../db/index.ts';
import { strings } from '../i18n/languages.ts';
import { scanEverything } from '../media/library.ts';
import { withMetadata } from '../media/merge.ts';
import { isTape } from '../tapes/tape.ts';
import { planImport, readHistory, type ForeignListen, type HeldListen, type ImportPlan, type LibrarySong } from './import.ts';

export type { ImportPlan } from './import.ts';

/**
 * Bringing in a listening history from another app: the errands, as
 * `backup/index.ts` has them. What the files say and which songs they are
 * of is decided in `import.ts`, beside this.
 *
 * Nothing here goes anywhere. The files are read off the phone, matched
 * against the library on it and written into its history; and a listen
 * brought in this way is never offered to ListenBrainz (see
 * `scrobble/store.ts`), not even when the whole history is sent.
 */

/** A failure in words meant for the person who chose the files. */
export class HistoryError extends Error {}

/**
 * Lets the user choose the files and says what bringing them in would do.
 *
 * Nothing is changed. Null if they backed out of choosing. Throws a
 * {@link HistoryError} when none of the files chosen is a history this can
 * read, saying why.
 */
export async function openHistory(): Promise<ImportPlan | null> {
  const native = JukeboxAudio;
  if (!native.pickHistoryFilesAsync || !native.historyPartsAsync || !native.readHistoryPartAsync) {
    throw new HistoryError(strings().backup.needsBuildToImport);
  }
  const said = strings().backup.history;

  const picked = await native.pickHistoryFilesAsync();
  if (picked.length === 0) return null;

  const listens: ForeignListen[] = [];
  let read = 0;
  let tooBig = false;
  let unreadable = false;
  for (const file of picked) {
    let parts: string[];
    try {
      parts = await native.historyPartsAsync(file.uri);
    } catch {
      unreadable = true;
      continue;
    }
    // A part at a time, and let go of once it is read: see `HistoryFiles.kt`.
    for (const part of parts) {
      let contents: string | null;
      try {
        contents = await native.readHistoryPartAsync(file.uri, part);
      } catch {
        unreadable = true;
        continue;
      }
      if (contents == null) {
        tooBig = true;
        continue;
      }
      const found = readHistory(contents);
      if (!found) continue;
      read++;
      // One at a time rather than spread into the call: a year of Spotify is
      // more arguments than a call may be given.
      for (const each of found) listens.push(each);
    }
  }
  if (read === 0) {
    throw new HistoryError(tooBig ? said.tooBig : unreadable ? strings().common.fileUnreadable : said.notHistory);
  }

  return planImport(listens, await librarySongs(), heldBetween(listens));
}

/**
 * Every song of the library, under the names its files give it and under
 * the names the library shows, which are the ones corrected by a lookup or
 * by hand: a scrobble names a song the way the service did, and either may
 * be the one that agrees. Not the tapes, which are not songs and have no
 * history of plays.
 */
async function librarySongs(): Promise<LibrarySong[]> {
  const files = (await scanEverything()).filter((track) => !isTape(track));
  const describe = (track: (typeof files)[number]): LibrarySong => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    durationSec: track.durationSec,
    filename: track.filename,
  });
  return [...files.map(describe), ...withMetadata(files).map(describe)];
}

/** The history's listens from the first of [listens] to the last, which are all a new one could be the same as. */
function heldBetween(listens: readonly ForeignListen[]): HeldListen[] {
  if (listens.length === 0) return [];
  let first = Infinity;
  let last = -Infinity;
  for (const listen of listens) {
    if (listen.startedAt < first) first = listen.startedAt;
    if (listen.startedAt > last) last = listen.startedAt;
  }
  return db().getAllSync<HeldListen>(
    `SELECT started_at AS startedAt, title, artist FROM plays WHERE started_at >= ? AND started_at <= ?`,
    Math.floor(first) - 1000,
    Math.ceil(last) + 1000
  );
}

/**
 * Writes what was planned into the history, all of it or none, and answers
 * with how many listens went in.
 *
 * After a frame has gone by. The write itself holds the thread, and years
 * of listening take it a moment; waiting first lets the sheet say that it is
 * importing before it goes still to do it.
 */
export async function applyHistory(plan: ImportPlan): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 32));
  const database = db();
  database.withTransactionSync(() => {
    const insert = database.prepareSync(
      `INSERT INTO plays (track_id, title, artist, filename, started_at, seconds_played, completed, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      for (const row of plan.rows) {
        insert.executeSync(
          row.track_id,
          row.title,
          row.artist,
          row.filename,
          row.started_at,
          row.seconds_played,
          row.completed,
          row.source
        );
      }
    } finally {
      insert.finalizeSync();
    }
  });
  return plan.rows.length;
}
