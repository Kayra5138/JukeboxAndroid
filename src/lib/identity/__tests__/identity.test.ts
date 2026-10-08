import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import type { BackupDb } from '../../backup/store.ts';
import { migrate, type MigrationTarget } from '../../db/migrations.ts';
import { takeIn, type Memory } from '../pass.ts';
import { difference, propose, settle, type FileRow, type Noted, type Scanned } from '../plan.ts';
import { forgetFiles, notePairs, readdress, readFiles, readPairs, suggestions } from '../store.ts';

const file = (id: string, filename: string, extra: Partial<FileRow> = {}): FileRow => ({
  id,
  filename,
  folder: 'Music/',
  title: filename.replace(/\.mp3$/, ''),
  artist: 'Somebody',
  durationSec: 200.123,
  size: 4_000_000,
  ...extra,
});
const known = (...rows: FileRow[]) => new Map(rows.map((row) => [row.id, row]));
const never = () => false;
const always = () => true;

describe('what a scan found', () => {
  it('is nothing when every file is as it was', () => {
    const rows = [file('1', 'a.mp3'), file('2', 'b.mp3')];
    assert.deepEqual(difference(known(...rows), rows), { changed: [], fresh: [], gone: [] });
  });

  it('is a new file when the id was not known', () => {
    const found = difference(known(file('1', 'a.mp3')), [file('1', 'a.mp3'), file('2', 'b.mp3')]);
    assert.deepEqual(found.fresh, [file('2', 'b.mp3')]);
    assert.deepEqual(found.changed, [file('2', 'b.mp3')]);
    assert.deepEqual(found.gone, []);
  });

  it('is a file gone when the scan did not return it, described as it was', () => {
    const found = difference(known(file('1', 'a.mp3'), file('2', 'b.mp3')), [file('1', 'a.mp3')]);
    assert.deepEqual(found.gone, [file('2', 'b.mp3')]);
    assert.deepEqual(found.changed, []);
  });

  it('writes a retagged file down again without taking it for another', () => {
    const now = file('1', 'a.mp3', { title: 'Better', size: 4_000_512 });
    const found = difference(known(file('1', 'a.mp3')), [now]);
    assert.deepEqual(found, { changed: [now], fresh: [], gone: [] });
  });

  it('treats an older build that sends no size as not knowing it', () => {
    const { size: _, ...bare } = file('1', 'a.mp3');
    const scanned: Scanned[] = [bare];
    assert.equal(difference(new Map(), scanned).fresh[0]!.size, null);
    assert.deepEqual(difference(known(file('1', 'a.mp3', { size: null })), scanned).changed, []);
  });

  it('sees a number that now means a different file as one gone and one come', () => {
    // A rebuilt media database counts from one again: 1 was a.mp3 and is now b.mp3.
    const now = file('1', 'b.mp3', { size: 5_000_000 });
    const found = difference(known(file('1', 'a.mp3')), [now]);
    assert.deepEqual(found.gone, [file('1', 'a.mp3')]);
    assert.deepEqual(found.fresh, [now]);
  });

  it('does not take a file that was only renamed for another file', () => {
    const found = difference(known(file('1', 'a.mp3')), [file('1', 'renamed.mp3')]);
    assert.deepEqual(found.fresh, []);
    assert.deepEqual(found.gone, []);
  });
});

describe('what the new files might be', () => {
  it('is a move when the name, the size and the length all agree', () => {
    const fresh = [file('9', 'a.mp3', { folder: 'Card/' })];
    assert.deepEqual(propose([file('1', 'a.mp3')], fresh, fresh), {
      moves: [{ from: '1', to: '9' }],
      asks: [],
      alike: [],
    });
  });

  it('is only a question when the size differs', () => {
    const fresh = [file('9', 'a.mp3', { size: 4_100_000 })];
    assert.deepEqual(propose([file('1', 'a.mp3')], fresh, fresh).asks, [{ from: '1', to: '9' }]);
    assert.deepEqual(propose([file('1', 'a.mp3')], fresh, fresh).moves, []);
  });

  it('is only a question when the length differs by a hair', () => {
    const fresh = [file('9', 'a.mp3', { durationSec: 200.9 })];
    assert.deepEqual(propose([file('1', 'a.mp3')], fresh, fresh).asks, [{ from: '1', to: '9' }]);
  });

  it('is only a question when either size is not known', () => {
    const fresh = [file('9', 'a.mp3')];
    const proposal = propose([file('1', 'a.mp3', { size: null })], fresh, fresh);
    assert.deepEqual(proposal.asks, [{ from: '1', to: '9' }]);
    assert.deepEqual(proposal.moves, []);
  });

  it('is nothing when the size and length agree and the names do not', () => {
    // The same number of bytes is not a song. The matcher has to say so first.
    const fresh = [file('9', 'z.mp3')];
    assert.deepEqual(propose([file('1', 'a.mp3')], fresh, fresh), { moves: [], asks: [], alike: [] });
  });

  it('is nothing when the name agrees and the length is another recording', () => {
    const fresh = [file('9', 'a.mp3', { durationSec: 260 })];
    assert.deepEqual(propose([file('1', 'a.mp3')], fresh, fresh), { moves: [], asks: [], alike: [] });
  });

  it('looks only among the files that have just appeared', () => {
    // 5 has been here all along. It is not what 1 turned into.
    const scanned = [file('5', 'a.mp3'), file('9', 'other.mp3', { size: 7 })];
    const proposal = propose([file('1', 'a.mp3')], [scanned[1]!], scanned);
    assert.deepEqual(proposal.moves, []);
    assert.deepEqual(proposal.asks, []);
  });

  it('moves at most one gone file onto a new one', () => {
    const gone = [file('1', 'a.mp3'), file('2', 'a.mp3', { folder: 'Old/', size: 3 })];
    const fresh = [file('9', 'a.mp3', { folder: 'New/' })];
    const proposal = propose(gone, fresh, fresh);
    assert.deepEqual(proposal.moves, [{ from: '1', to: '9' }]);
    assert.deepEqual(proposal.asks, [{ from: '2', to: '9' }]);
  });

  it('asks about both when two gone files are the new one to the byte', () => {
    const gone = [file('1', 'a.mp3'), file('2', 'a.mp3', { folder: 'Old/' })];
    const fresh = [file('9', 'a.mp3', { folder: 'New/' })];
    const proposal = propose(gone, fresh, fresh);
    assert.deepEqual(proposal.moves, []);
    assert.equal(proposal.asks.length, 2);
  });

  it('notes a copy whose original is still here, older first', () => {
    const scanned = [file('3', 'a.mp3'), file('9', 'a.mp3', { folder: 'Copy/' })];
    assert.deepEqual(propose([], [scanned[1]!], scanned), {
      moves: [],
      asks: [],
      alike: [{ from: '3', to: '9' }],
    });
  });

  it('notes each pair once when both are new, as on the first scan', () => {
    const scanned = [file('9', 'a.mp3', { folder: 'Copy/' }), file('3', 'a.mp3')];
    assert.deepEqual(propose([], scanned, scanned).alike, [{ from: '3', to: '9' }]);
  });

  it('does not call two files twins for being the same size', () => {
    const scanned = [file('3', 'a.mp3'), file('9', 'z.mp3')];
    assert.deepEqual(propose([], [scanned[1]!], scanned).alike, []);
  });
});

describe('what is done about it', () => {
  const nothing = { moves: [], asks: [], alike: [] };
  const move = { from: '1', to: '9' };

  it('moves onto a file with nothing of its own', () => {
    const holds = (id: string) => id === '1';
    assert.deepEqual(settle({ ...nothing, moves: [move] }, [], holds, always).moves, [move]);
  });

  it('asks instead of moving onto a file with a history of its own', () => {
    const settled = settle({ ...nothing, moves: [move] }, [], always, always);
    assert.deepEqual(settled.moves, []);
    assert.deepEqual(settled.asks, [move]);
  });

  it('passes histories along a chain when the numbers have changed hands', () => {
    // 1 is now what 2 was and 2 is now what 1 was. Each lands on something,
    // and each of those somethings is leaving.
    const moves = [{ from: '1', to: '2' }, { from: '2', to: '1' }];
    assert.deepEqual(settle({ ...nothing, moves }, [], always, always).moves, moves);
  });

  it('stops the whole chain behind a link that cannot move', () => {
    // 3 holds something and is going nowhere, so 2 cannot land on it, so 2
    // still holds what it had, so 1 cannot land on 2.
    const moves = [{ from: '1', to: '2' }, { from: '2', to: '3' }];
    const settled = settle({ ...nothing, moves }, [], always, always);
    assert.deepEqual(settled.moves, []);
    assert.equal(settled.asks.length, 2);
  });

  it('does not ask about a likeness when the gone file had nothing to carry', () => {
    assert.deepEqual(settle({ ...nothing, asks: [move] }, [], never, always).asks, []);
    assert.deepEqual(settle({ ...nothing, asks: [move] }, [], always, always).asks, [move]);
  });

  it('never brings up a pair the user said was two songs', () => {
    const apart: Noted[] = [{ from: '9', to: '1', state: 'apart' }];
    for (const kind of ['moves', 'asks', 'alike'] as const) {
      const settled = settle({ ...nothing, [kind]: [move] }, apart, (id) => id === '1', always);
      assert.deepEqual(settled, { moves: [], asks: [], alike: [], retired: [] }, kind);
    }
  });

  it('does not ask twice', () => {
    const asked: Noted[] = [{ ...move, state: 'asked' }];
    assert.deepEqual(settle({ ...nothing, asks: [move] }, asked, always, always).asks, []);
  });

  it('only notes twins while one of them has no history', () => {
    const settled = settle({ ...nothing, alike: [move] }, [], (id) => id === '1', always);
    assert.deepEqual(settled.alike, [move]);
    assert.deepEqual(settled.asks, []);
  });

  it('asks about twins once both have been listened to', () => {
    const twins: Noted[] = [{ ...move, state: 'alike' }];
    const settled = settle(nothing, twins, always, always);
    assert.deepEqual(settled.asks, [move]);
    assert.deepEqual(settled.retired, [move]);
  });

  it('follows the copy when the original goes', () => {
    const twins: Noted[] = [{ ...move, state: 'alike' }];
    const settled = settle(nothing, twins, (id) => id === '1', (id) => id === '9');
    assert.deepEqual(settled.moves, [move]);
    assert.deepEqual(settled.retired, [move]);
  });

  it('follows the original when it is the copy that goes', () => {
    const twins: Noted[] = [{ ...move, state: 'alike' }];
    const settled = settle(nothing, twins, (id) => id === '9', (id) => id === '1');
    assert.deepEqual(settled.moves, [{ from: '9', to: '1' }]);
  });

  it('leaves twins alone when both are out of sight', () => {
    const twins: Noted[] = [{ ...move, state: 'alike' }];
    assert.deepEqual(settle(nothing, twins, always, never), {
      moves: [],
      asks: [],
      alike: [],
      retired: [],
    });
  });
});

/**
 * The rest is run on a real SQLite with the app's own schema, because what is
 * being checked is that rows end up under the right id, and only a database
 * can say whether they did.
 */
function open(): { raw: DatabaseSync; database: BackupDb } {
  const raw = new DatabaseSync(':memory:');
  const target: MigrationTarget = Object.assign(raw, {
    execSync: (sql: string) => raw.exec(sql),
    getFirstSync: <T,>(sql: string) => (raw.prepare(sql).get() as T) ?? null,
  });
  migrate(target);
  const database: BackupDb = {
    all: <T,>(sql: string, ...params: (string | number | null)[]) =>
      raw.prepare(sql).all(...params).map((row) => ({ ...row })) as T[],
    run: (sql, ...params) => {
      raw.prepare(sql).run(...params);
    },
    transaction: (work) => {
      raw.exec('BEGIN');
      try {
        work();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { raw, database };
}

type Seed = {
  plays?: number;
  status?: string;
  fetched?: number;
  tags?: [tag: string, source: string][];
  lyrics?: [plain: string, source: string];
  lists?: [list: number, position: number][];
};

/** Files a song's worth of things under an id. */
function fill(database: BackupDb, id: string, seed: Seed): void {
  for (let n = 0; n < (seed.plays ?? 0); n++) {
    database.run(
      `INSERT INTO plays (track_id, title, artist, filename, started_at, seconds_played, completed)
       VALUES (?, ?, 'Somebody', ?, ?, 120, 1)`,
      id,
      `song ${id}`,
      `${id}.mp3`,
      Number(id.replace(/\D/g, '') || 0) * 1000 + n
    );
  }
  if (seed.status) {
    database.run(
      `INSERT INTO track_metadata (track_id, status, title, fetched_at) VALUES (?, ?, ?, ?)`,
      id,
      seed.status,
      `${seed.status} title of ${id}`,
      seed.fetched ?? 1
    );
  }
  (seed.tags ?? []).forEach(([tag, source], position) => {
    database.run(
      `INSERT INTO track_tags (track_id, tag, position, source) VALUES (?, ?, ?, ?)`,
      id,
      tag,
      position,
      source
    );
  });
  if (seed.lyrics) {
    database.run(
      `INSERT INTO track_lyrics (track_id, plain, fetched_at, source) VALUES (?, ?, 1, ?)`,
      id,
      ...seed.lyrics
    );
  }
  for (const [list, position] of seed.lists ?? []) {
    database.run(
      `INSERT OR IGNORE INTO playlists (id, name, created_at, updated_at) VALUES (?, 'A list', 1, 1)`,
      list
    );
    database.run(
      `INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, 1)`,
      list,
      id,
      position
    );
  }
}

const idsIn = (database: BackupDb, table: string, order = 'rowid') =>
  database.all<{ track_id: string }>(`SELECT track_id FROM ${table} ORDER BY ${order}`).map((row) => row.track_id);

describe('moving a history', () => {
  it('carries everything across and leaves nothing under the old id', () => {
    const { database } = open();
    fill(database, '1', {
      plays: 2,
      status: 'manual',
      tags: [['rock', 'manual']],
      lyrics: ['la', 'manual'],
      lists: [[1, 0]],
    });
    database.run(`INSERT INTO skips (track_id, title, started_at, seconds_played, duration_sec) VALUES ('1', 's', 5, 3, 200)`);
    database.run(`INSERT INTO lyric_translations (track_id, target, lines, translated_at) VALUES ('1', 'en', '[]', 1)`);
    database.run(`UPDATE playlists SET cover_track_id = '1'`);
    database.run(`UPDATE track_lyrics SET offset_ms = 250`);

    database.transaction(() => readdress(database, [{ from: '1', to: '9' }], never));

    for (const table of ['plays', 'skips', 'track_metadata', 'track_tags', 'track_lyrics', 'lyric_translations', 'playlist_tracks']) {
      assert.deepEqual([...new Set(idsIn(database, table))], ['9'], table);
    }
    assert.equal(idsIn(database, 'plays').length, 2);
    assert.deepEqual(database.all(`SELECT cover_track_id FROM playlists`), [{ cover_track_id: '9' }]);
    // A column a backup's rules never look at is still the song's.
    assert.deepEqual(database.all(`SELECT offset_ms, source FROM track_lyrics`), [{ offset_ms: 250, source: 'manual' }]);
  });

  it('keeps what was typed by hand over what was looked up, whichever side had it', () => {
    const { database } = open();
    fill(database, '1', { status: 'manual', lyrics: ['mine', 'manual'] });
    fill(database, '9', { status: 'matched', fetched: 99, lyrics: ['found', 'lookup'] });

    database.transaction(() => readdress(database, [{ from: '1', to: '9' }], never));

    assert.deepEqual(database.all(`SELECT track_id, status FROM track_metadata`), [{ track_id: '9', status: 'manual' }]);
    assert.deepEqual(database.all(`SELECT track_id, plain FROM track_lyrics`), [{ track_id: '9', plain: 'mine' }]);
  });

  it('pools the tags, the ones already on the song first', () => {
    const { database } = open();
    fill(database, '1', { tags: [['rock', 'manual'], ['live', 'manual']] });
    fill(database, '9', { tags: [['metal', 'itunes'], ['rock', 'itunes']] });

    database.transaction(() => readdress(database, [{ from: '1', to: '9' }], never));

    assert.deepEqual(
      database.all(`SELECT track_id, tag, position FROM track_tags ORDER BY position`),
      [
        { track_id: '9', tag: 'metal', position: 0 },
        { track_id: '9', tag: 'rock', position: 1 },
        { track_id: '9', tag: 'live', position: 2 },
      ]
    );
  });

  it('takes the old place in a list, and closes the gap where the list had both', () => {
    const { database } = open();
    fill(database, '5', { lists: [[1, 0], [2, 0]] });
    fill(database, '1', { lists: [[1, 1], [2, 1]] });
    fill(database, '6', { lists: [[1, 2], [2, 2]] });
    fill(database, '9', { lists: [[2, 3]] });

    database.transaction(() => readdress(database, [{ from: '1', to: '9' }], never));

    const members = (list: number) =>
      database.all(`SELECT track_id, position FROM playlist_tracks WHERE playlist_id = ? ORDER BY position`, list);
    assert.deepEqual(members(1), [
      { track_id: '5', position: 0 },
      { track_id: '9', position: 1 },
      { track_id: '6', position: 2 },
    ]);
    assert.deepEqual(members(2), [
      { track_id: '5', position: 0 },
      { track_id: '6', position: 1 },
      { track_id: '9', position: 2 },
    ]);
  });

  it('swaps two histories without pouring one into the other', () => {
    const { database } = open();
    fill(database, '1', { plays: 1, status: 'manual', tags: [['one', 'manual']], lists: [[1, 0]] });
    fill(database, '2', { plays: 3, status: 'matched', tags: [['two', 'manual']], lists: [[1, 1]] });

    database.transaction(() =>
      readdress(database, [{ from: '1', to: '2' }, { from: '2', to: '1' }], always)
    );

    assert.deepEqual(database.all(`SELECT track_id, COUNT(*) AS n FROM plays GROUP BY track_id ORDER BY track_id`), [
      { track_id: '1', n: 3 },
      { track_id: '2', n: 1 },
    ]);
    assert.deepEqual(database.all(`SELECT track_id, status FROM track_metadata ORDER BY track_id`), [
      { track_id: '1', status: 'matched' },
      { track_id: '2', status: 'manual' },
    ]);
    assert.deepEqual(database.all(`SELECT track_id, tag FROM track_tags ORDER BY track_id`), [
      { track_id: '1', tag: 'two' },
      { track_id: '2', tag: 'one' },
    ]);
    assert.deepEqual(database.all(`SELECT track_id, position FROM playlist_tracks ORDER BY position`), [
      { track_id: '2', position: 0 },
      { track_id: '1', position: 1 },
    ]);
  });

  it('leaves every other song exactly as it was', () => {
    const { database } = open();
    fill(database, '1', { plays: 1, tags: [['a', 'manual']] });
    fill(database, '4', { plays: 2, status: 'manual', tags: [['b', 'manual'], ['c', 'itunes']], lists: [[1, 7]] });
    const before = ['plays', 'track_metadata', 'track_tags', 'playlist_tracks'].map((table) =>
      database.all(`SELECT * FROM ${table} WHERE track_id = '4'`)
    );

    database.transaction(() => readdress(database, [{ from: '1', to: '9' }], never));

    const after = ['plays', 'track_metadata', 'track_tags', 'playlist_tracks'].map((table) =>
      database.all(`SELECT * FROM ${table} WHERE track_id = '4'`)
    );
    assert.deepEqual(after, before);
  });
});

describe('taking a scan in', () => {
  const fresh = (): Memory => ({ files: null, pairs: null, weighed: false });

  it('writes the library down the first time and nothing the second', () => {
    const { raw, database } = open();
    const memory = fresh();
    const library = [file('1', 'a.mp3'), file('2', 'b.mp3')];

    takeIn(database, library, memory, 10);
    assert.deepEqual([...readFiles(database).values()], library);

    takeIn(database, library, memory, 20);
    const changes = (raw.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    takeIn(database, library, memory, 30);
    assert.equal((raw.prepare('SELECT total_changes() AS n').get() as { n: number }).n, changes);
    assert.deepEqual(database.all(`SELECT DISTINCT seen_at FROM track_files`), [{ seen_at: 10 }]);
  });

  it('moves a history to the file that was copied to a new card', () => {
    const { database } = open();
    const memory = fresh();
    takeIn(database, [file('1', 'a.mp3'), file('2', 'b.mp3')], memory, 10);
    fill(database, '1', { plays: 3, tags: [['rock', 'manual']], lists: [[1, 0]] });

    takeIn(database, [file('2', 'b.mp3'), file('9', 'a.mp3', { folder: 'Card/Music/' })], memory, 20);

    assert.deepEqual(idsIn(database, 'plays'), ['9', '9', '9']);
    assert.deepEqual(idsIn(database, 'track_tags'), ['9']);
    assert.deepEqual(idsIn(database, 'playlist_tracks'), ['9']);
    assert.deepEqual([...readFiles(database).keys()].sort(), ['2', '9']);
    assert.deepEqual(suggestions(database), []);
  });

  it('asks, and moves nothing, when the file is not the same to the byte', () => {
    const { database } = open();
    const memory = fresh();
    takeIn(database, [file('1', 'a.mp3'), file('2', 'b.mp3')], memory, 10);
    fill(database, '1', { plays: 3, tags: [['rock', 'manual']], lyrics: ['la', 'lookup'], lists: [[1, 0]] });

    takeIn(database, [file('2', 'b.mp3'), file('9', 'a.mp3', { size: 5_000_000 })], memory, 20);

    assert.deepEqual(idsIn(database, 'plays'), ['1', '1', '1']);
    const [asked] = suggestions(database);
    assert.deepEqual(asked!.from, {
      id: '1',
      title: 'a',
      artist: 'Somebody',
      folder: 'Music/',
      filename: 'a.mp3',
      listens: 3,
      tags: 1,
      lyrics: true,
      lists: 1,
    });
    assert.equal(asked!.to.id, '9');
    assert.equal(asked!.to.listens, 0);
  });

  it('keeps a file that has gone for as long as it takes to come back', () => {
    const { database } = open();
    const memory = fresh();
    const all = [file('1', 'a.mp3'), file('2', 'b.mp3')];
    takeIn(database, all, memory, 10);
    fill(database, '1', { plays: 1 });

    // The card is out, for a great many scans.
    for (let at = 20; at < 80; at += 10) takeIn(database, [all[1]!], memory, at);
    assert.deepEqual([...readFiles(database).keys()].sort(), ['1', '2']);

    // And back, under the number it always had.
    takeIn(database, all, memory, 90);
    assert.deepEqual(idsIn(database, 'plays'), ['1']);
    assert.deepEqual(readPairs(database), []);
  });

  it('learns nothing from a scan that returned nothing', () => {
    const { database } = open();
    const memory = fresh();
    const all = [file('1', 'a.mp3'), file('2', 'b.mp3')];
    takeIn(database, all, memory, 10);
    fill(database, '1', { plays: 1 });

    takeIn(database, [], memory, 20);
    takeIn(database, all, memory, 30);

    assert.deepEqual([...readFiles(database).values()], all);
    assert.deepEqual(idsIn(database, 'plays'), ['1']);
  });

  it('finds a file that went missing long ago in one that turns up now', () => {
    const { database } = open();
    const memory = fresh();
    takeIn(database, [file('1', 'a.mp3'), file('2', 'b.mp3')], memory, 10);
    fill(database, '1', { plays: 1 });
    takeIn(database, [file('2', 'b.mp3')], memory, 20);
    takeIn(database, [file('2', 'b.mp3'), file('3', 'c.mp3')], fresh(), 30);

    takeIn(database, [file('2', 'b.mp3'), file('3', 'c.mp3'), file('9', 'a.mp3')], fresh(), 40);
    assert.deepEqual(idsIn(database, 'plays'), ['9']);
  });

  it('does not move onto a file that already has listens of its own', () => {
    const { database } = open();
    const memory = fresh();
    takeIn(database, [file('1', 'a.mp3'), file('2', 'b.mp3')], memory, 10);
    fill(database, '1', { plays: 1 });
    // Played before anybody looked: the new file has a listen by the time it is seen.
    fill(database, '9', { plays: 1 });

    takeIn(database, [file('2', 'b.mp3'), file('9', 'a.mp3')], memory, 20);

    assert.deepEqual(idsIn(database, 'plays'), ['1', '9']);
    assert.equal(suggestions(database).length, 1);
  });

  it('follows a rebuilt media database, where every number means another song', () => {
    const { database } = open();
    const memory = fresh();
    takeIn(database, [file('1', 'a.mp3', { size: 11 }), file('2', 'b.mp3', { size: 22 }), file('3', 'c.mp3', { size: 33 })], memory, 10);
    fill(database, '1', { plays: 1, tags: [['a', 'manual']] });
    fill(database, '2', { plays: 2, tags: [['b', 'manual']] });
    fill(database, '3', { plays: 3, tags: [['c', 'manual']] });

    takeIn(database, [file('1', 'c.mp3', { size: 33 }), file('2', 'a.mp3', { size: 11 }), file('3', 'b.mp3', { size: 22 })], memory, 20);

    assert.deepEqual(database.all(`SELECT track_id, COUNT(*) AS n FROM plays GROUP BY track_id ORDER BY track_id`), [
      { track_id: '1', n: 3 },
      { track_id: '2', n: 1 },
      { track_id: '3', n: 2 },
    ]);
    assert.deepEqual(database.all(`SELECT track_id, tag FROM track_tags ORDER BY track_id`), [
      { track_id: '1', tag: 'c' },
      { track_id: '2', tag: 'a' },
      { track_id: '3', tag: 'b' },
    ]);
    assert.deepEqual(
      [...readFiles(database).values()].map((row) => `${row.id} ${row.filename}`).sort(),
      ['1 c.mp3', '2 a.mp3', '3 b.mp3']
    );
  });

  it('notes a copy, and asks only once both have been listened to', () => {
    const { database } = open();
    takeIn(database, [file('1', 'a.mp3')], fresh(), 10);
    fill(database, '1', { plays: 2 });
    const both = [file('1', 'a.mp3'), file('9', 'a.mp3', { folder: 'Copy/' })];

    takeIn(database, both, fresh(), 20);
    assert.deepEqual(readPairs(database), [{ from: '1', to: '9', state: 'alike' }]);
    assert.deepEqual(suggestions(database), []);

    // The next time the app is started, by when the copy has a listen too.
    fill(database, '9', { plays: 1 });
    takeIn(database, both, fresh(), 30);
    assert.deepEqual(readPairs(database), [{ from: '1', to: '9', state: 'asked' }]);
    assert.deepEqual(idsIn(database, 'plays'), ['1', '1', '9']);
  });

  it('follows the copy when the original is deleted later', () => {
    const { database } = open();
    const memory = fresh();
    takeIn(database, [file('1', 'a.mp3')], memory, 10);
    fill(database, '1', { plays: 2 });
    takeIn(database, [file('1', 'a.mp3'), file('9', 'a.mp3', { folder: 'Copy/' })], memory, 20);

    takeIn(database, [file('9', 'a.mp3', { folder: 'Copy/' })], memory, 30);

    assert.deepEqual(idsIn(database, 'plays'), ['9', '9']);
    assert.deepEqual(readPairs(database), []);
    assert.deepEqual([...readFiles(database).keys()], ['9']);
  });

  it('asks about songs that were lost before any of this was kept', () => {
    const { database } = open();
    // Listened to under a number the library no longer has, and under one it does.
    fill(database, '40', { plays: 2 });
    database.run(`UPDATE plays SET filename = 'a.mp3', title = 'a' WHERE track_id = '40'`);
    fill(database, '2', { plays: 1 });

    takeIn(database, [file('2', 'b.mp3'), file('9', 'a.mp3')], fresh(), 10);

    assert.deepEqual(idsIn(database, 'plays'), ['40', '40', '2'], 'nothing is moved on so little');
    const asked = suggestions(database);
    assert.equal(asked.length, 1);
    assert.deepEqual([asked[0]!.from.id, asked[0]!.from.filename, asked[0]!.to.id], ['40', 'a.mp3', '9']);
  });

  it('does not ask again about a pair that was kept apart', () => {
    const { database } = open();
    takeIn(database, [file('1', 'a.mp3'), file('2', 'b.mp3')], fresh(), 10);
    fill(database, '1', { plays: 1 });
    const after = [file('2', 'b.mp3'), file('9', 'a.mp3', { size: 5 })];
    takeIn(database, after, fresh(), 20);
    assert.equal(suggestions(database).length, 1);

    database.transaction(() => notePairs(database, [{ from: '1', to: '9' }], 'apart', 30));
    takeIn(database, after, fresh(), 40);
    takeIn(database, [...after, file('10', 'c.mp3')], fresh(), 50);

    assert.deepEqual(suggestions(database), []);
    assert.deepEqual(readPairs(database), [{ from: '1', to: '9', state: 'apart' }]);
  });

  it('drops a question once there is nothing left to join', () => {
    const { database } = open();
    takeIn(database, [file('1', 'a.mp3'), file('2', 'b.mp3')], fresh(), 10);
    fill(database, '1', { plays: 1 });
    takeIn(database, [file('2', 'b.mp3'), file('9', 'a.mp3', { size: 5 })], fresh(), 20);

    database.run(`DELETE FROM plays`);

    assert.deepEqual(suggestions(database), []);
    assert.deepEqual(readPairs(database), []);
  });

  it('stops looking for a file the app erased', () => {
    const { database } = open();
    takeIn(database, [file('1', 'a.mp3'), file('2', 'b.mp3')], fresh(), 10);
    fill(database, '1', { plays: 1 });

    database.transaction(() => forgetFiles(database, ['1']));
    takeIn(database, [file('2', 'b.mp3'), file('9', 'a.mp3')], fresh(), 20);

    assert.deepEqual(idsIn(database, 'plays'), ['1'], 'the listen is history, and stays where it was');
    assert.deepEqual(suggestions(database), []);
  });
});
