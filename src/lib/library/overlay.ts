/**
 * Noticing that what the app knows about the tracks has been written to.
 *
 * A track on screen is the file as the media store describes it with the
 * app's own knowledge laid over it: a looked-up record and year, a typed
 * correction, a cover, its place on the record, its tags. All of that is three
 * tables, and they are written from a great many places — a lookup, an edit, a
 * download being filed, a record being put in order, a backup coming in, a
 * song's history moving to a new file — some of them long after the screen
 * that began them has gone.
 *
 * Asking each of those places to say so would work until the day one was
 * added and did not. So the database is asked instead: a trigger on each table
 * counts the writes, whoever makes them, and "has anything changed since the
 * library was last put together?" is one number read back.
 *
 * Temporary, both the count and the triggers. They belong to this connection
 * and are gone with it, which is right: the count means nothing to the next
 * start of the app, which puts the library together afresh regardless, and
 * nothing is added to the database that a backup, a migration or the car's
 * reader would have to know about.
 */

/** As much of a database as this needs, so a real SQLite can stand in for the app's in the tests. */
export type OverlayDb = {
  execSync(sql: string): void;
  getFirstSync<T>(sql: string): T | null;
};

/** The tables a track's shown details are read from: see `media/merge.ts`. */
const WATCHED = ['track_metadata', 'track_tags', 'shared_covers'] as const;
const WRITES = ['INSERT', 'UPDATE', 'DELETE'] as const;

const COUNT = 'library_overlay_writes';

/**
 * Starts counting on [database], and answers with how to read the count.
 *
 * Safe to call again on a connection already being counted. Throws if the
 * database will not have it, and then nothing is known about whether the
 * tables have changed — which whoever asks must take to mean that they have.
 */
export function watchOverlay(database: OverlayDb): () => number {
  const statements = [
    `CREATE TEMP TABLE IF NOT EXISTS ${COUNT} (n INTEGER NOT NULL)`,
    `INSERT INTO ${COUNT} (n) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM ${COUNT})`,
  ];
  for (const table of WATCHED) {
    for (const write of WRITES) {
      // One row written is one counted, which for a whole library being
      // filed at once is thousands of ones added to a number in memory. The
      // count is never read as a quantity, only for having moved.
      statements.push(
        `CREATE TEMP TRIGGER IF NOT EXISTS ${COUNT}_${table}_${write.toLowerCase()}
           AFTER ${write} ON main.${table}
           BEGIN UPDATE ${COUNT} SET n = n + 1; END`
      );
    }
  }
  database.execSync(statements.join(';\n'));

  return () => {
    const row = database.getFirstSync<{ n: number }>(`SELECT n FROM ${COUNT}`);
    if (!row) throw new Error('The count of writes has gone.');
    return Number(row.n);
  };
}
