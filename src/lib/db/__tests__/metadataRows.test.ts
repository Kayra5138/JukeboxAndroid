import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { fillCoversIn, markCoverSearchedIn, saveMetadataTo, type MetadataDb } from '../metadataRows.ts';
import { migrate } from '../migrations.ts';
import type { TrackMetadata } from '../metadata.ts';

/**
 * The statements themselves, against a real SQLite brought up by the real
 * migrations: what is being checked is what the SQL lets through, and only
 * SQLite can say.
 */
function open() {
  const database = new DatabaseSync(':memory:');
  migrate({
    execSync: (sql) => database.exec(sql),
    getFirstSync: <T,>(sql: string) => (database.prepare(sql).get() as T) ?? null,
  });
  const target: MetadataDb = {
    runSync: (sql, ...params) => ({ changes: Number(database.prepare(sql).run(...params).changes) }),
    withTransactionSync: (task) => {
      database.exec('BEGIN');
      task();
      database.exec('COMMIT');
    },
  };
  const read = (id: string) =>
    database
      .prepare('SELECT status, album, artwork_url, cover_searched_at FROM track_metadata WHERE track_id = ?')
      .get(id) as { status: string; album: string | null; artwork_url: string | null; cover_searched_at: number | null };
  return { target, read };
}

const entry = (trackId: string, changes: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId, status: 'matched', source: 'musicbrainz', title: 'Song', artist: 'Someone',
  album: null, genre: 'rock', year: 2001, artworkUrl: null, trackNumber: null,
  discNumber: null, ...changes,
});

describe('putting covers on rows', () => {
  it('fills a row with no cover and one holding only an address', () => {
    const { target, read } = open();
    saveMetadataTo(target, entry('1'), 1);
    saveMetadataTo(target, entry('2', { artworkUrl: 'https://is1-ssl.mzstatic.com/a.jpg' }), 1);

    const filled = fillCoversIn(target, [{ trackIds: ['1', '2'], uri: 'file:///covers/a.jpg', album: 'Ruins' }]);

    assert.deepEqual(filled, ['1', '2']);
    assert.equal(read('1').artwork_url, 'file:///covers/a.jpg');
    assert.equal(read('2').artwork_url, 'file:///covers/a.jpg');
    assert.equal(read('1').album, 'Ruins');
  });

  it('never writes over a cover the app already holds, looked up or chosen', () => {
    const { target, read } = open();
    saveMetadataTo(target, entry('found', { artworkUrl: 'file:///covers/found.jpg' }), 1);
    saveMetadataTo(target, entry('chosen', { status: 'manual', artworkUrl: 'file:///covers/chosen.jpg' }), 1);

    const filled = fillCoversIn(target, [
      { trackIds: ['found', 'chosen'], uri: 'file:///covers/other.jpg', album: 'Ruins' },
    ]);

    assert.deepEqual(filled, []);
    assert.equal(read('found').artwork_url, 'file:///covers/found.jpg');
    assert.equal(read('chosen').artwork_url, 'file:///covers/chosen.jpg');
    // Not the album either: a row that was not filled was not touched.
    assert.equal(read('found').album, null);
  });

  it('leaves an album that is already named, and any album somebody typed', () => {
    const { target, read } = open();
    saveMetadataTo(target, entry('named', { album: 'Its Own' }), 1);
    saveMetadataTo(target, entry('typed', { status: 'manual', album: null }), 1);

    fillCoversIn(target, [{ trackIds: ['named', 'typed'], uri: 'file:///covers/a.jpg', album: 'Ruins' }]);

    assert.equal(read('named').album, 'Its Own');
    assert.equal(read('typed').album, null);
    assert.equal(read('typed').artwork_url, 'file:///covers/a.jpg');
  });

  it('says nothing was filled for a track with no row', () => {
    const { target } = open();
    assert.deepEqual(fillCoversIn(target, [{ trackIds: ['nobody'], uri: 'file:///covers/a.jpg', album: null }]), []);
  });
});

describe('remembering a search that found no cover', () => {
  it('marks the rows it is given and no others', () => {
    const { target, read } = open();
    saveMetadataTo(target, entry('1'), 1);
    saveMetadataTo(target, entry('2'), 1);

    markCoverSearchedIn(target, ['1'], 77);

    assert.equal(read('1').cover_searched_at, 77);
    assert.equal(read('2').cover_searched_at, null);
  });

  it('is forgotten when the row is saved again', () => {
    // Saved again means named again, and a search that failed under the old
    // names says nothing about the new ones.
    const { target, read } = open();
    saveMetadataTo(target, entry('1'), 1);
    markCoverSearchedIn(target, ['1'], 77);

    saveMetadataTo(target, entry('1', { status: 'manual', artist: 'Spelled Right' }), 2);

    assert.equal(read('1').cover_searched_at, null);
    assert.equal(read('1').status, 'manual');
  });
});
