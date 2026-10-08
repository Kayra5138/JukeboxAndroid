import {
  TABLES,
  TABLE_NAMES,
  carried,
  staysThroughReplace,
  emptyTables,
  type Cell,
  type Row,
  type TableName,
  type Tables,
} from './format.ts';

/**
 * Reading the tables out of the database and putting a set of them back.
 *
 * Written against the three things it needs from a database rather than against
 * the one the app uses, so the same code runs on a real SQLite in the tests.
 * What is being checked there is that rows survive the round trip, and only a
 * database can say whether they did.
 */
export type BackupDb = {
  all<T>(sql: string, ...params: Cell[]): T[];
  run(sql: string, ...params: Cell[]): void;
  /** Everything in [work] or none of it. */
  transaction(work: () => void): void;
};

/**
 * The order rows are read in, which is also the order they are written back.
 *
 * It matters for the two tables that number their own rows: a listen put back
 * in the order it happened gets a row number that still says when it happened
 * relative to the others, which is what a tie on the clock is broken by.
 */
const ORDER: Record<TableName, string> = {
  discover_exclusions: 'id',
  plays: 'started_at, id',
  skips: 'started_at, id',
  track_metadata: 'track_id',
  track_tags: 'track_id, position',
  track_lyrics: 'track_id',
  lyric_translations: 'track_id, target',
  playlists: 'id',
  playlist_tracks: 'playlist_id, position',
};

const columns = (name: TableName) => Object.keys(TABLES[name]);

export function readTables(database: BackupDb): Tables {
  const tables = emptyTables();
  for (const name of TABLE_NAMES) {
    tables[name] = database.all<Row>(
      `SELECT ${columns(name).join(', ')} FROM ${name} ORDER BY ${ORDER[name]}`
    );
  }
  return tables;
}

/** The settings that travel. See [carried] for the ones that do not. */
export function readSettings(database: BackupDb): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const row of database.all<{ key: string; value: string }>('SELECT key, value FROM settings')) {
    if (carried(row.key)) settings[row.key] = row.value;
  }
  return settings;
}

/**
 * Whether there is anything here that an import could overwrite.
 *
 * Asked so that a phone with nothing on it is not made to choose between
 * merging with nothing and replacing nothing.
 */
export function holdsAnything(database: BackupDb): boolean {
  return (['plays', 'skips', 'playlists', 'track_metadata', 'track_tags', 'track_lyrics'] as const).some(
    (name) => database.all<{ found: number }>(`SELECT 1 AS found FROM ${name} LIMIT 1`).length > 0
  );
}

/**
 * Makes the database hold exactly [tables], and brings the settings in.
 *
 * One transaction around the lot. An import that stopped half way would leave
 * lists pointing at songs whose details had not arrived and a history with a
 * hole in it, and nothing afterwards could tell which half had been done -- so
 * either all of it lands or the database is as it was.
 *
 * Merging is done before this is called and arrives here as the finished
 * tables; this only ever writes. The one thing [mode] decides is the settings.
 * Replacing takes the backup's, and clears the record of which downloaded
 * playlists feed which lists, because the lists it pointed at by number are
 * gone and the numbers now mean other lists. The library folder and the
 * connection to ListenBrainz are this phone's and are left as they were. Merging keeps what the phone has
 * and only adds settings it had no value for.
 */
export function restore(
  database: BackupDb,
  tables: Tables,
  settings: Record<string, string>,
  mode: 'merge' | 'replace'
): void {
  database.transaction(() => {
    for (const name of TABLE_NAMES) {
      database.run(`DELETE FROM ${name}`);
      const names = columns(name);
      const sql = `INSERT INTO ${name} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`;
      for (const row of tables[name]) {
        database.run(sql, ...names.map((column) => row[column] ?? null));
      }
    }

    /*
      Which listens ListenBrainz has had is kept by the row number of the
      listen, and every listen has just been written again under a new one.
      Left alone the record would say that other listens had been sent; empty,
      it says none has, which costs a second sending of what the service will
      recognise and drop.
    */
    database.run('DELETE FROM listenbrainz_listens');

    if (mode === 'replace') {
      // Everything the backup did not carry was this phone's version of
      // something it replaces -- apart from the few things that are about this
      // phone and not about what is on it.
      for (const { key } of database.all<{ key: string }>('SELECT key FROM settings')) {
        if (!staysThroughReplace(key)) database.run('DELETE FROM settings WHERE key = ?', key);
      }
    }
    for (const [key, value] of Object.entries(settings)) {
      if (!carried(key)) continue;
      database.run(
        mode === 'replace'
          ? 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
          : 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        key,
        value
      );
    }
  });
}
