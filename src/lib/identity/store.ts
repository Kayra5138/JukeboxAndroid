import { joinSongs } from '../backup/apply.ts';
import { emptyTables, type Cell, type Row } from '../backup/format.ts';
import type { BackupDb } from '../backup/store.ts';
import type { FileRow, Noted, Pair } from './plan.ts';

/**
 * Where the descriptions of files are kept, and the moving of everything from
 * one id to another.
 *
 * Written against the same three things the backup asks of a database, and
 * for the same reason: whether a history survives being moved is something
 * only a database can say, so the tests give this a real one.
 */

/** How many values go into one statement. Well under what SQLite will take. */
const AT_ONCE = 400;

function* batches<T>(items: T[], size = AT_ONCE): Generator<T[]> {
  for (let start = 0; start < items.length; start += size) yield items.slice(start, start + size);
}

const marks = (count: number) => Array.from({ length: count }, () => '?').join(', ');

const FILE_COLUMNS = `track_id AS id, filename, folder, title, artist, duration_sec AS durationSec, size`;

export function readFiles(database: BackupDb): Map<string, FileRow> {
  const files = new Map<string, FileRow>();
  for (const row of database.all<FileRow>(`SELECT ${FILE_COLUMNS} FROM track_files`)) {
    files.set(row.id, row);
  }
  return files;
}

/**
 * Writes descriptions down, over whatever was there for the same ids.
 *
 * Several rows to a statement. The first scan after this arrives writes the
 * whole library, and a statement a track is thousands of trips for something
 * that is one piece of work.
 */
export function writeFiles(database: BackupDb, rows: FileRow[], at: number): void {
  for (const batch of batches(rows, 100)) {
    database.run(
      `INSERT OR REPLACE INTO track_files
         (track_id, filename, folder, title, artist, duration_sec, size, seen_at)
       VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      ...batch.flatMap((row) => [
        row.id,
        row.filename,
        row.folder,
        row.title,
        row.artist,
        row.durationSec,
        row.size,
        Math.round(at),
      ])
    );
  }
}

/**
 * Descriptions of the songs that were already lost when the descriptions
 * began to be kept.
 *
 * A listen carries the title, the artist and the file name it was made under,
 * so a song whose number has stopped turning up is not entirely unknown: it is
 * known as it was the last time it was played, and by how long it ran if it
 * was ever skipped. That is less than a scan would have written -- no folder
 * and no size -- so nothing found by it is ever sure enough to act on. It is
 * enough to ask.
 *
 * Only ids the library does not hold, and only ones with a listen. A tag or a
 * place in a list says nothing about the file it was put on.
 */
export function describeLost(database: BackupDb, here: (id: string) => boolean): FileRow[] {
  // The bare columns beside MAX() are read from the row the maximum is in,
  // which is the last listen. SQLite promises that, and nothing else does.
  const heard = database.all<{ id: string; title: string; artist: string | null; filename: string | null }>(
    `SELECT track_id AS id, title, artist, filename, MAX(plays.id) AS latest FROM plays GROUP BY track_id`
  );
  const lengths = new Map(
    database
      .all<{ id: string; length: number }>(
        `SELECT track_id AS id, duration_sec AS length, MAX(skips.id) AS latest FROM skips
         WHERE duration_sec > 0 GROUP BY track_id`
      )
      .map((row) => [row.id, row.length])
  );
  return heard
    .filter((row) => !here(row.id))
    .map((row) => ({
      id: row.id,
      filename: row.filename,
      folder: null,
      title: row.title,
      artist: row.artist,
      durationSec: lengths.get(row.id) ?? 0,
      size: null,
    }));
}

export function readPairs(database: BackupDb): Noted[] {
  return database.all<Noted>(`SELECT old_id AS "from", new_id AS "to", state FROM track_pairs`);
}

export function notePairs(
  database: BackupDb,
  pairs: Pair[],
  state: Noted['state'],
  at: number
): void {
  for (const pair of pairs) {
    // Either way round is the same two files, and they are written down once.
    database.run(
      `DELETE FROM track_pairs WHERE old_id = ? AND new_id = ?`,
      pair.to,
      pair.from
    );
    database.run(
      `INSERT OR REPLACE INTO track_pairs (old_id, new_id, state, noted_at) VALUES (?, ?, ?, ?)`,
      pair.from,
      pair.to,
      state,
      Math.round(at)
    );
  }
}

export function dropPairs(database: BackupDb, pairs: Pair[]): void {
  for (const pair of pairs) {
    database.run(`DELETE FROM track_pairs WHERE old_id = ? AND new_id = ?`, pair.from, pair.to);
  }
}

/**
 * Where something of the user's own may be filed under a song's id.
 *
 * Their own, as against what a lookup put there. A listen, a skip, a place in
 * a list and a cover chosen for one, and whatever was typed in by hand. What a
 * catalogue said about a file is not on this list: it will say it again about
 * the same file under another number, so it is nothing that could be lost and
 * no reason to stop and ask.
 */
const OWN: string[] = [
  `SELECT DISTINCT track_id AS id FROM plays WHERE track_id IN`,
  `SELECT DISTINCT track_id AS id FROM skips WHERE track_id IN`,
  `SELECT DISTINCT track_id AS id FROM playlist_tracks WHERE track_id IN`,
  `SELECT DISTINCT cover_track_id AS id FROM playlists WHERE cover_track_id IN`,
  `SELECT track_id AS id FROM track_metadata WHERE status = 'manual' AND track_id IN`,
  `SELECT DISTINCT track_id AS id FROM track_tags WHERE source = 'manual' AND track_id IN`,
  `SELECT track_id AS id FROM track_lyrics WHERE source = 'manual' AND track_id IN`,
];

/** Which of [ids] have something of the user's own filed under them. */
export function owners(database: BackupDb, ids: string[]): Set<string> {
  const found = new Set<string>();
  for (const batch of batches([...new Set(ids)])) {
    for (const select of OWN) {
      for (const row of database.all<{ id: string }>(`${select} (${marks(batch.length)})`, ...batch)) {
        found.add(row.id);
      }
    }
  }
  return found;
}

/** The tables with one row, or one set of rows, to a song. */
const PER_SONG = ['track_metadata', 'track_tags', 'track_lyrics', 'lyric_translations'] as const;

/** A name no file has, for a song's things while they are between two ids. */
const between = (id: string) => `moving:${id}`;

/** Which of [ids] the column holds, so that nothing is written for the ones it does not. */
function held(database: BackupDb, table: string, column: string, ids: string[]): string[] {
  const found: string[] = [];
  for (const batch of batches(ids)) {
    for (const row of database.all<{ id: string }>(
      `SELECT DISTINCT ${column} AS id FROM ${table} WHERE ${column} IN (${marks(batch.length)})`,
      ...batch
    )) {
      found.push(row.id);
    }
  }
  return found;
}

/**
 * Moves everything filed under each `from` to its `to`.
 *
 * All the moves are made as if at one moment. After a media database has been
 * rebuilt the numbers have changed hands -- what was 7 is now 12, and what was
 * 3 is now 7 -- and moving them one after another would pour the first song's
 * history into the second's on the way past. So nothing is ever written
 * straight onto an id that something else is still leaving.
 *
 * Where the song at the new id already has a row of its own, which of the two
 * is kept is the backup's rule and not a second one: corrected by hand beats
 * looked up, and then the newer. Listens cannot clash and are simply filed
 * under the new id. A list that held both keeps the entry it had for the new
 * one, and a list that held only the old one keeps that entry's place.
 *
 * The description of a `from` is dropped unless [stays] says the file is still
 * in the library: once its things have moved there is nothing left to look for
 * it with, or for.
 *
 * Runs inside the caller's transaction, because it is never the only thing
 * that has to land together.
 */
export function readdress(database: BackupDb, moves: Pair[], stays: (id: string) => boolean): void {
  const to = new Map<string, string>();
  for (const move of moves) if (move.from !== move.to) to.set(move.from, move.to);
  if (to.size === 0) return;
  const froms = [...to.keys()];
  const touched = [...new Set([...froms, ...to.values()])];

  const here = emptyTables();
  const there = emptyTables();
  for (const name of PER_SONG) {
    const rows: Row[] = [];
    for (const batch of batches(touched)) {
      rows.push(
        ...database.all<Row>(
          `SELECT * FROM ${name} WHERE track_id IN (${marks(batch.length)})`,
          ...batch
        )
      );
    }
    if (!rows.some((row) => to.has(row.track_id as string))) continue;

    for (const row of rows) {
      const next = to.get(row.track_id as string);
      if (next) there[name].push({ ...row, track_id: next });
      else here[name].push({ ...row });
    }
    for (const batch of batches(touched)) {
      database.run(`DELETE FROM ${name} WHERE track_id IN (${marks(batch.length)})`, ...batch);
    }
  }
  const joined = joinSongs(here, there);
  for (const name of PER_SONG) {
    for (const row of joined[name]) {
      // Every column the row came with, not only the ones a backup carries: a
      // column added to the table later is still this song's.
      const columns = Object.keys(row);
      database.run(
        `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${marks(columns.length)})`,
        ...columns.map((column): Cell => row[column] ?? null)
      );
    }
  }

  // Listens, lists and covers are moved where they lie, in two steps: first
  // out to a name nothing else has, and only then in.
  const lists = new Set<number>();
  for (const [table, column] of [
    ['plays', 'track_id'],
    ['skips', 'track_id'],
    ['playlist_tracks', 'track_id'],
    ['playlists', 'cover_track_id'],
  ] as const) {
    const moving = held(database, table, column, froms);
    if (moving.length === 0) continue;

    for (const batch of batches(moving)) {
      database.run(
        `UPDATE ${table} SET ${column} = 'moving:' || ${column} WHERE ${column} IN (${marks(batch.length)})`,
        ...batch
      );
    }
    for (const from of moving) {
      if (table !== 'playlist_tracks') {
        database.run(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, to.get(from)!, between(from));
        continue;
      }
      for (const row of database.all<{ id: number }>(
        `SELECT playlist_id AS id FROM playlist_tracks WHERE track_id = ?`,
        between(from)
      )) {
        lists.add(row.id);
      }
      database.run(
        `UPDATE OR IGNORE playlist_tracks SET track_id = ? WHERE track_id = ?`,
        to.get(from)!,
        between(from)
      );
      database.run(`DELETE FROM playlist_tracks WHERE track_id = ?`, between(from));
    }
  }
  // An entry dropped from a list that had both leaves a gap, and the lists are
  // kept numbered from nought without one.
  for (const list of lists) {
    const members = database.all<{ id: string }>(
      `SELECT track_id AS id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position`,
      list
    );
    members.forEach((member, position) => {
      database.run(
        `UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?`,
        position,
        list,
        member.id
      );
    });
  }

  for (const from of froms) {
    if (!stays(from)) database.run(`DELETE FROM track_files WHERE track_id = ?`, from);
    // Whatever else was being wondered about this id was wondered about what
    // it held, which is no longer there. What the user said is two songs stays.
    database.run(
      `DELETE FROM track_pairs WHERE state != 'apart' AND (old_id = ? OR new_id = ?)`,
      from,
      from
    );
  }
}

/** Stops looking for files the app has itself erased. Inside the caller's transaction. */
export function forgetFiles(database: BackupDb, ids: string[]): void {
  for (const batch of batches(ids)) {
    const list = marks(batch.length);
    database.run(`DELETE FROM track_files WHERE track_id IN (${list})`, ...batch);
    database.run(
      `DELETE FROM track_pairs WHERE old_id IN (${list}) OR new_id IN (${list})`,
      ...batch,
      ...batch
    );
  }
}

/** One side of a pair the user is asked about: which file, and what it has to its name. */
export type Side = {
  id: string;
  title: string | null;
  artist: string | null;
  folder: string | null;
  filename: string | null;
  listens: number;
  tags: number;
  lyrics: boolean;
  lists: number;
};

export type Suggestion = { from: Side; to: Side };

function side(database: BackupDb, id: string): Side {
  const file = database.all<FileRow>(`SELECT ${FILE_COLUMNS} FROM track_files WHERE track_id = ?`, id)[0];
  const count = (sql: string) => database.all<{ n: number }>(sql, id)[0]?.n ?? 0;
  return {
    id,
    title: file?.title ?? null,
    artist: file?.artist ?? null,
    folder: file?.folder ?? null,
    filename: file?.filename ?? null,
    listens: count(`SELECT COUNT(*) AS n FROM plays WHERE track_id = ?`),
    tags: count(`SELECT COUNT(*) AS n FROM track_tags WHERE track_id = ?`),
    lyrics:
      count(
        `SELECT COUNT(*) AS n FROM track_lyrics
         WHERE track_id = ? AND (COALESCE(plain, '') != '' OR COALESCE(synced, '') != '')`
      ) > 0,
    lists: count(`SELECT COUNT(*) AS n FROM playlist_tracks WHERE track_id = ?`),
  };
}

/**
 * The pairs waiting on an answer, oldest question first.
 *
 * A question whose first file no longer has anything of the user's is not
 * put: there is nothing left to join. It is taken off the list here rather
 * than when that came about, because many things can empty a file's history
 * -- an import that replaced everything, the file found again some other way
 * -- and this is the one place that has to be right about it.
 */
export function suggestions(database: BackupDb): Suggestion[] {
  const asked = database.all<Pair>(
    `SELECT old_id AS "from", new_id AS "to" FROM track_pairs
     WHERE state = 'asked' ORDER BY noted_at, old_id, new_id`
  );
  if (asked.length === 0) return [];
  const own = owners(database, asked.map((pair) => pair.from));
  const stale = asked.filter((pair) => !own.has(pair.from));
  if (stale.length > 0) database.transaction(() => dropPairs(database, stale));
  return asked
    .filter((pair) => own.has(pair.from))
    .map((pair) => ({ from: side(database, pair.from), to: side(database, pair.to) }));
}
