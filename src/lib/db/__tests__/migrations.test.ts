import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { migrate, MIGRATIONS, type MigrationTarget } from '../migrations.ts';

/**
 * The migrations are plain SQL, so they can be run against a real SQLite rather
 * than a stand-in — which is the point, since what is being checked is that two
 * databases with different histories end up with the same schema, and only
 * SQLite can say whether they did.
 */
function open(): DatabaseSync & MigrationTarget {
  const database = new DatabaseSync(':memory:');
  return Object.assign(database, {
    execSync: (sql: string) => database.exec(sql),
    getFirstSync: <T,>(sql: string) => (database.prepare(sql).get() as T) ?? null,
  });
}

function versionOf(database: DatabaseSync): number {
  return (database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
}

/**
 * Every table, index and column, as SQLite itself describes them.
 *
 * The `sql` text is whitespace-normalized and read alongside the pragmas rather
 * than on its own, because sqlite_master keeps the statement exactly as it was
 * typed by whichever release created the object. Two databases can be the same
 * shape and still differ in that text by an indent, and comparing it raw makes
 * a fixture that copies the current DDL pass while a real old install fails.
 */
function schemaOf(database: DatabaseSync): unknown[] {
  const objects = database
    .prepare(
      `SELECT type, name, tbl_name, sql FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`
    )
    .all() as { type: string; name: string; tbl_name: string; sql: string }[];

  return objects.map(({ type, name, tbl_name, sql }) => ({
    type,
    name,
    tbl_name,
    sql: sql.replace(/\s+/g, ' ').trim(),
    parts:
      type === 'table'
        ? rows(database, `PRAGMA table_info(${name})`)
        : rows(database, `PRAGMA index_info(${name})`),
  }));
}

/** Spread away the null prototype node:sqlite hands rows back with. */
function rows(database: DatabaseSync, sql: string): Record<string, unknown>[] {
  return database.prepare(sql).all().map((row) => ({ ...(row as object) }));
}

/**
 * The schema as it actually stood at each release, transcribed from the commits
 * that wrote it, because the databases this has to cope with were written by
 * those releases and not by anything in this file.
 *
 * Deriving the fixtures from the migrations instead is what let a bug through
 * once already: it can only ever produce the newest pre-versioning shape, and
 * the newest shape is the one shape that was never in danger. Each entry holds
 * only what its commit added, since every one of them only ever appended.
 */
const ERAS: [commit: string, added: string][] = [
  [
    '7908aa9 settings only',
    `CREATE TABLE IF NOT EXISTS settings (
       key   TEXT PRIMARY KEY NOT NULL,
       value TEXT NOT NULL
     );`,
  ],
  [
    '33b5871 listening history',
    `CREATE TABLE IF NOT EXISTS plays (
       id             INTEGER PRIMARY KEY AUTOINCREMENT,
       track_id       TEXT    NOT NULL,
       title          TEXT    NOT NULL,
       artist         TEXT,
       filename       TEXT    NOT NULL,
       started_at     INTEGER NOT NULL,
       seconds_played REAL    NOT NULL,
       completed      INTEGER NOT NULL
     );
     CREATE INDEX IF NOT EXISTS plays_started_at ON plays (started_at);
     CREATE INDEX IF NOT EXISTS plays_track_id   ON plays (track_id);`,
  ],
  [
    'be39a8e metadata',
    `CREATE TABLE IF NOT EXISTS track_metadata (
       track_id    TEXT PRIMARY KEY NOT NULL,
       status      TEXT NOT NULL,
       source      TEXT,
       title       TEXT,
       artist      TEXT,
       album       TEXT,
       genre       TEXT,
       year        INTEGER,
       artwork_url TEXT,
       fetched_at  INTEGER NOT NULL
     );`,
  ],
  [
    '15ade54 tags',
    `CREATE TABLE IF NOT EXISTS track_tags (
       track_id TEXT    NOT NULL,
       tag      TEXT    NOT NULL,
       position INTEGER NOT NULL,
       source   TEXT    NOT NULL,
       PRIMARY KEY (track_id, tag)
     );
     CREATE INDEX IF NOT EXISTS track_tags_tag ON track_tags (tag);`,
  ],
  [
    '5faec45 lyrics',
    `CREATE TABLE IF NOT EXISTS track_lyrics (
       track_id   TEXT PRIMARY KEY NOT NULL,
       plain      TEXT,
       synced     TEXT,
       fetched_at INTEGER NOT NULL
     );`,
  ],
];

/** A database as one of those releases left it: schema, no `user_version`. */
function era(name: string): DatabaseSync & MigrationTarget {
  const upto = ERAS.findIndex(([commit]) => commit === name);
  assert.notEqual(upto, -1, `no such era: ${name}`);
  const database = open();
  for (const [, added] of ERAS.slice(0, upto + 1)) database.exec(added);
  return database;
}

/** The last shape before versioning, which is what most installs will carry. */
function legacy(): DatabaseSync & MigrationTarget {
  return era('5faec45 lyrics');
}

describe('migrate', () => {
  it('brings an empty database up to the current version', () => {
    const database = open();
    assert.equal(migrate(database), MIGRATIONS.length);
    assert.equal(versionOf(database), MIGRATIONS.length);
  });

  it('lands an old database and a fresh one on the same schema', () => {
    const fresh = open();
    migrate(fresh);

    const old = legacy();
    migrate(old);

    assert.equal(versionOf(old), versionOf(fresh));
    assert.deepEqual(schemaOf(old), schemaOf(fresh));
  });

  it('does nothing at all the second time', () => {
    const database = open();
    migrate(database);
    const before = schemaOf(database);

    database
      .prepare(`INSERT INTO settings (key, value) VALUES ('library:root', 'Music/Albums')`)
      .run();
    migrate(database);

    assert.deepEqual(schemaOf(database), before);
    assert.equal(versionOf(database), MIGRATIONS.length);
    assert.equal(
      (database.prepare(`SELECT value FROM settings WHERE key = 'library:root'`).get() as
        | { value: string }
        | undefined)?.value,
      'Music/Albums'
    );
  });

  it('does not run the genre backfill again over a database that has had it', () => {
    // The backfill used to run on every open, so an install that already had
    // the tags table has already had it — and re-running it would put back the
    // tags the user has since deleted by hand.
    for (const name of ['15ade54 tags', '5faec45 lyrics']) {
      const database = era(name);
      database
        .prepare(
          `INSERT INTO track_metadata (track_id, status, source, genre, fetched_at)
           VALUES ('7', 'matched', 'itunes', 'Metal', 0)`
        )
        .run();

      migrate(database);

      assert.deepEqual(database.prepare('SELECT * FROM track_tags').all(), [], name);
    }
  });

  it('carries a fresh database through the backfill, so nothing is skipped', () => {
    // The other half of the same worry: the baseline check must not mistake an
    // empty database for one that has already been migrated.
    const database = open();
    migrate(database);

    const tables = database
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .all()
      .map((row) => (row as { name: string }).name);

    for (const name of ['settings', 'plays', 'track_metadata', 'track_tags', 'track_lyrics']) {
      assert.ok(tables.includes(name), `${name} is missing`);
    }
  });

  it('backfills genres for an install from before tags existed', () => {
    // This one collected genres and was upgraded past the release that would
    // have turned them into tags, so the backfill is still owed to it.
    const database = era('be39a8e metadata');
    database
      .prepare(
        `INSERT INTO track_metadata (track_id, status, source, genre, fetched_at)
         VALUES ('7', 'matched', 'itunes', 'Metal', 0)`
      )
      .run();

    migrate(database);

    assert.deepEqual(rows(database, 'SELECT * FROM track_tags'), [
      { track_id: '7', tag: 'metal', position: 0, source: 'itunes' },
    ]);
  });

  it('keeps the rows already in plays when the table is rebuilt', () => {
    const database = legacy();
    database
      .prepare(
        `INSERT INTO plays (track_id, title, artist, filename, started_at, seconds_played, completed)
         VALUES ('3', 'Akuma no Ko', 'Ai Higuchi', 'akuma.mp3', 1700, 210.5, 1)`
      )
      .run();

    migrate(database);

    assert.deepEqual(rows(database, 'SELECT * FROM plays'), [
      {
        id: 1,
        track_id: '3',
        title: 'Akuma no Ko',
        artist: 'Ai Higuchi',
        filename: 'akuma.mp3',
        started_at: 1700,
        seconds_played: 210.5,
        completed: 1,
      },
    ]);
  });

  it('strips the old content uri prefix off history written before the move', () => {
    const database = open();
    migrate(database);
    database
      .prepare(
        `INSERT INTO plays (track_id, title, filename, started_at, seconds_played, completed)
         VALUES ('content://media/external/audio/media/42', 'Kaikai Kitan', NULL, 1, 60, 1)`
      )
      .run();

    // The fixup belongs to a version already applied, so a row written after it
    // is left alone: it is the native module's bare id that is expected now.
    const legacyDatabase = legacy();
    legacyDatabase
      .prepare(
        `INSERT INTO plays (track_id, title, filename, started_at, seconds_played, completed)
         VALUES ('content://media/external/audio/media/42', 'Kaikai Kitan', '', 1, 60, 1)`
      )
      .run();
    legacyDatabase.exec(
      `UPDATE plays SET track_id = replace(track_id, 'content://media/external/audio/media/', '')
       WHERE track_id LIKE 'content://media/external/audio/media/%'`
    );
    migrate(legacyDatabase);

    assert.equal(
      (legacyDatabase.prepare('SELECT track_id FROM plays').get() as { track_id: string }).track_id,
      '42'
    );
  });

  it('strips the prefix off an install that predates the fixup entirely', () => {
    // This shape shipped before the content uri move, so unlike the newer ones
    // it has never had the rewrite and its history would otherwise stop
    // matching anything in the library.
    const database = era('33b5871 listening history');
    database
      .prepare(
        `INSERT INTO plays (track_id, title, filename, started_at, seconds_played, completed)
         VALUES ('content://media/external/audio/media/42', 'Kaikai Kitan', 'k.mp3', 1, 60, 1)`
      )
      .run();

    migrate(database);

    assert.equal(
      (database.prepare('SELECT track_id FROM plays').get() as { track_id: string }).track_id,
      '42'
    );
  });
});

describe('every shape that has ever shipped', () => {
  const fresh = open();
  migrate(fresh);
  const current = schemaOf(fresh);

  for (const [name] of ERAS) {
    it(`converges on the current schema from ${name}`, () => {
      const database = era(name);
      const tables = new Set(
        database
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
          .all()
          .map((row) => (row as { name: string }).name)
      );

      database
        .prepare(`INSERT INTO settings (key, value) VALUES ('library:root', 'Music/Albums')`)
        .run();
      if (tables.has('plays')) {
        database
          .prepare(
            `INSERT INTO plays (track_id, title, artist, filename, started_at, seconds_played, completed)
             VALUES ('3', 'Akuma no Ko', 'Ai Higuchi', 'akuma.mp3', 1700, 210.5, 1)`
          )
          .run();
      }
      if (tables.has('track_metadata')) {
        database
          .prepare(
            `INSERT INTO track_metadata (track_id, status, source, genre, year, fetched_at)
             VALUES ('3', 'matched', 'itunes', 'Rock', 2021, 55)`
          )
          .run();
      }
      if (tables.has('track_tags')) {
        database
          .prepare(
            `INSERT INTO track_tags (track_id, tag, position, source)
             VALUES ('3', 'gothic', 0, 'musicbrainz')`
          )
          .run();
      }
      if (tables.has('track_lyrics')) {
        database
          .prepare(
            `INSERT INTO track_lyrics (track_id, plain, synced, fetched_at)
             VALUES ('3', 'la la la', NULL, 99)`
          )
          .run();
      }

      assert.equal(migrate(database), MIGRATIONS.length);
      assert.equal(versionOf(database), MIGRATIONS.length);
      assert.deepEqual(schemaOf(database), current);

      // Nothing the install was carrying may be dropped on the way through.
      assert.equal(
        (database.prepare(`SELECT value FROM settings WHERE key = 'library:root'`).get() as {
          value: string;
        }).value,
        'Music/Albums'
      );
      if (tables.has('plays')) {
        assert.deepEqual(rows(database, 'SELECT * FROM plays'), [
          {
            id: 1,
            track_id: '3',
            title: 'Akuma no Ko',
            artist: 'Ai Higuchi',
            filename: 'akuma.mp3',
            started_at: 1700,
            seconds_played: 210.5,
            completed: 1,
          },
        ]);
      }
      if (tables.has('track_metadata')) {
        // Stored as `Rock` by a release that kept whatever case it was given.
        // Tags are now held in one spelling, so the upgrade folds it.
        assert.deepEqual(rows(database, 'SELECT track_id, genre, year FROM track_metadata'), [
          { track_id: '3', genre: 'rock', year: 2021 },
        ]);
      }
      if (tables.has('track_tags')) {
        assert.deepEqual(rows(database, 'SELECT * FROM track_tags'), [
          { track_id: '3', tag: 'gothic', position: 0, source: 'musicbrainz' },
        ]);
      }
      if (tables.has('track_lyrics')) {
        assert.deepEqual(
          rows(database, 'SELECT track_id, plain, synced, fetched_at FROM track_lyrics'),
          [{ track_id: '3', plain: 'la la la', synced: null, fetched_at: 99 }]
        );
      }
    });
  }
});

describe('a migration that fails', () => {
  /** Runs `body` with one extra, deliberately broken migration on the end. */
  function withBrokenMigration(sql: string, body: () => void): void {
    MIGRATIONS.push(sql);
    try {
      body();
    } finally {
      MIGRATIONS.pop();
    }
  }

  const BROKEN = `
    INSERT INTO settings (key, value) VALUES ('half', 'written');
    UPDATE settings SET value = nope;
  `;

  it('leaves no transaction open behind it', () => {
    const database = open();
    withBrokenMigration(BROKEN, () => {
      assert.throws(() => migrate(database), /no such column: nope/);

      // Without the rollback this is true, and from here the connection is
      // finished: every later BEGIN fails, and every read that gets through is
      // reading uncommitted rows.
      assert.equal(database.isTransaction, false);
    });
  });

  it('undoes the part of itself that had already run', () => {
    const database = open();
    withBrokenMigration(BROKEN, () => {
      assert.throws(() => migrate(database));
    });

    assert.deepEqual(rows(database, `SELECT * FROM settings WHERE key = 'half'`), []);
  });

  it('is not recorded as done, so it runs again next time', () => {
    const database = open();
    withBrokenMigration(BROKEN, () => {
      assert.throws(() => migrate(database));
      assert.equal(versionOf(database), MIGRATIONS.length - 1);

      // The second attempt has to reach the same real failure rather than
      // "cannot start a transaction within a transaction".
      assert.throws(() => migrate(database), /no such column: nope/);
    });
  });

  it('leaves a database the next attempt can finish migrating', () => {
    const database = open();
    withBrokenMigration(BROKEN, () => {
      assert.throws(() => migrate(database));
    });

    const fresh = open();
    migrate(fresh);

    assert.equal(migrate(database), MIGRATIONS.length);
    assert.deepEqual(schemaOf(database), schemaOf(fresh));
  });
});

describe('the plays table', () => {
  it('accepts a track the media store gave no filename for', () => {
    // `filename` really does come back null, and a NOT NULL column turned that
    // into a constraint violation thrown from inside a playback event listener,
    // which stopped the interface following the player for the rest of the run.
    for (const database of [open(), legacy()]) {
      migrate(database);
      database
        .prepare(
          `INSERT INTO plays (track_id, title, artist, filename, started_at, seconds_played, completed)
           VALUES ('9', 'Unnamed', NULL, NULL, 5, 45, 0)`
        )
        .run();

      assert.equal(
        (database.prepare(`SELECT COUNT(*) AS n FROM plays`).get() as { n: number }).n,
        1
      );
    }
  });
});

describe('the track_lyrics table', () => {
  it('can tell an unanswered lookup from an answered one', () => {
    for (const database of [open(), legacy()]) {
      migrate(database);
      database
        .prepare(
          `INSERT INTO track_lyrics (track_id, plain, synced, fetched_at, unreachable_at)
           VALUES ('4', NULL, NULL, 0, 900)`
        )
        .run();

      assert.equal(
        (database.prepare(`SELECT unreachable_at AS at FROM track_lyrics`).get() as { at: number })
          .at,
        900
      );
    }
  });
});

describe('one spelling per tag', () => {
  /**
   * A database as it stood before tags were held in one spelling: the bulk
   * "add a tag" prompt wrote whatever case it was handed, while the edit
   * screen lower-cased, so the same tag could be in the column twice.
   */
  function withMixedCase(rowsIn: [string, string, number][]): DatabaseSync & MigrationTarget {
    const database = open();
    migrate(database);
    database.exec('DELETE FROM track_tags');
    for (const [trackId, tag, position] of rowsIn) {
      database
        .prepare(
          `INSERT INTO track_tags (track_id, tag, position, source)
           VALUES (?, ?, ?, 'manual')`
        )
        .run(trackId, tag, position);
    }
    // Back to before the fold, so migrating again runs it over this data.
    // Found by what the migration does rather than counted back from the end:
    // it was the last one when it was written, and the next thing appended to
    // the history would quietly have this rewind to a different migration.
    const fold = MIGRATIONS.findIndex((sql) => sql.includes('UPDATE OR IGNORE track_tags'));
    assert.notEqual(fold, -1, 'the tag fold is no longer in the history');
    database.exec(`PRAGMA user_version = ${fold}`);
    // Everything after the fold runs a second time over this database, and a
    // column cannot be added twice. The one added since is taken off again,
    // which is how a database from before it would have looked.
    database.exec('ALTER TABLE track_metadata DROP COLUMN cover_searched_at');
    return database;
  }

  it('folds a tag somebody typed with a capital', () => {
    const database = withMixedCase([['1', 'Rock', 0], ['2', 'ROCK', 0]]);
    migrate(database);

    assert.deepEqual(rows(database, 'SELECT track_id, tag FROM track_tags ORDER BY track_id'), [
      { track_id: '1', tag: 'rock' },
      { track_id: '2', tag: 'rock' },
    ]);
  });

  it('leaves one of them when a track carries both spellings', () => {
    // Folding the second onto the first collides with the primary key. The
    // right outcome is one row, not a failed migration.
    const database = withMixedCase([['1', 'rock', 0], ['1', 'Rock', 1]]);
    migrate(database);

    assert.deepEqual(rows(database, 'SELECT track_id, tag FROM track_tags'), [
      { track_id: '1', tag: 'rock' },
    ]);
  });

  it('lower-cases the letters SQLite will not', () => {
    // `LOWER()` is ASCII only, which on a Turkish library is most of the
    // words that have a case at all.
    const database = withMixedCase([
      ['1', 'ÖZGÜN MÜZİK', 0],
      ['2', 'Şarkı', 0],
      ['3', 'ÇOCUK', 0],
      ['4', 'Ğ', 0],
    ]);
    migrate(database);

    assert.deepEqual(
      rows(database, 'SELECT tag FROM track_tags ORDER BY track_id'),
      [{ tag: 'özgün müzik' }, { tag: 'şarkı' }, { tag: 'çocuk' }, { tag: 'ğ' }]
    );
  });

  it('leaves a tag that was already in one spelling exactly as it was', () => {
    const database = withMixedCase([['1', 'post-rock', 0], ['2', 'j-pop', 1]]);
    migrate(database);

    assert.deepEqual(rows(database, 'SELECT tag FROM track_tags ORDER BY track_id'), [
      { tag: 'post-rock' },
      { tag: 'j-pop' },
    ]);
  });

  it('counts a tag once however it was typed', () => {
    const database = withMixedCase([['1', 'Rock', 0], ['2', 'rock', 0], ['3', 'ROCK', 0]]);
    migrate(database);

    assert.deepEqual(
      rows(database, 'SELECT tag, COUNT(*) AS n FROM track_tags GROUP BY tag'),
      [{ tag: 'rock', n: 3 }]
    );
  });
});
