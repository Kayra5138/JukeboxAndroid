import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  chooseCoversIn,
  fillCoversIn,
  markCoverSearchedIn,
  placeTracksIn,
  saveMetadataTo,
  unplaceTracksIn,
  type MetadataDb,
} from '../metadataRows.ts';
import { migrate } from '../migrations.ts';
import type { Placing, TrackMetadata } from '../metadata.ts';

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
  /** The whole row but for when it was written, or undefined where there is none. */
  const whole = (id: string) => {
    const found = database.prepare('SELECT * FROM track_metadata WHERE track_id = ?').get(id);
    if (!found) return undefined;
    const { fetched_at: _when, ...rest } = found;
    return { ...rest };
  };
  const shared = (id: string) =>
    (database.prepare('SELECT artwork_url FROM shared_covers WHERE track_id = ?').get(id) as
      | { artwork_url: string }
      | undefined)?.artwork_url;
  return { target, read, whole, shared };
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

  it('gives a track with no row, or only a note that nothing was found, a cover of its own apart from the rows', () => {
    const { target, read, shared } = open();
    saveMetadataTo(target, entry('missed', { status: 'not_found', source: null }), 1);

    const filled = fillCoversIn(target, [
      { trackIds: ['nobody', 'missed'], uri: 'file:///covers/a.jpg', album: 'Ruins' },
    ]);

    assert.deepEqual(filled, ['nobody', 'missed']);
    assert.equal(shared('nobody'), 'file:///covers/a.jpg');
    assert.equal(shared('missed'), 'file:///covers/a.jpg');
    // No row is made, so the track still counts as never looked up; and the
    // note that nothing was found is left saying exactly that.
    assert.equal(read('nobody'), undefined);
    assert.equal(read('missed').status, 'not_found');
    assert.equal(read('missed').artwork_url, null);
  });

  it('never replaces a cover a track was given, and never puts a second on its row', () => {
    const { target, read, shared } = open();
    fillCoversIn(target, [{ trackIds: ['1'], uri: 'file:///covers/first.jpg', album: null }]);
    saveMetadataTo(target, entry('1'), 2);

    const filled = fillCoversIn(target, [{ trackIds: ['1'], uri: 'file:///covers/second.jpg', album: null }]);

    assert.deepEqual(filled, []);
    assert.equal(shared('1'), 'file:///covers/first.jpg');
    assert.equal(read('1').artwork_url, null);
  });

  it('gives nothing to a track somebody took the cover off', () => {
    const { target, read, shared } = open();
    fillCoversIn(target, [{ trackIds: ['1'], uri: 'file:///covers/given.jpg', album: null }]);
    saveMetadataTo(target, entry('1', { status: 'manual', coverRemovedAt: 9 }), 2);
    // Taking the cover off took the given one with it.
    assert.equal(shared('1'), undefined);

    const filled = fillCoversIn(target, [{ trackIds: ['1'], uri: 'file:///covers/a.jpg', album: null }]);

    assert.deepEqual(filled, []);
    assert.equal(read('1').artwork_url, null);
    assert.equal(shared('1'), undefined);
  });
});

describe('a cover chosen for a whole record', () => {
  it('replaces whatever each track wore, on its row where it has one and apart where it has none', () => {
    const { target, read, shared } = open();
    saveMetadataTo(target, entry('looked', { artworkUrl: 'file:///covers/single.jpg' }), 1);
    saveMetadataTo(target, entry('removed', { status: 'manual', coverRemovedAt: 3 }), 1);
    fillCoversIn(target, [{ trackIds: ['given'], uri: 'file:///covers/old.jpg', album: null }]);

    const chosen = chooseCoversIn(target, ['looked', 'removed', 'given', 'kept'], 'file:///covers/album.jpg', 4, new Set(['kept']));

    assert.deepEqual(chosen, ['looked', 'removed', 'given']);
    assert.equal(read('looked').artwork_url, 'file:///covers/album.jpg');
    assert.equal(read('removed').artwork_url, 'file:///covers/album.jpg');
    assert.equal(shared('given'), 'file:///covers/album.jpg');
    assert.equal(shared('kept'), undefined);
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

describe('giving tracks their places on a record', () => {
  const full = (trackId: string, changes: Partial<TrackMetadata> = {}) =>
    entry(trackId, { album: 'Ruins', artworkUrl: 'file:///covers/a.jpg', trackNumber: 7, discNumber: 2, ...changes });
  const miss = (trackId: string) =>
    entry(trackId, { status: 'not_found', source: null, title: null, artist: null, genre: null, year: null });
  const placing = (trackId: string, was: Placing['was'], trackNumber = 3, discNumber: number | null = null): Placing => ({
    trackId, trackNumber, discNumber, was,
  });
  const NONE = { status: null, trackNumber: null, discNumber: null };

  it('moves the two columns of a row that is there, a lookup’s or an edit, and nothing else', () => {
    const { target, whole } = open();
    saveMetadataTo(target, full('found'), 1);
    saveMetadataTo(target, full('typed', { status: 'manual', source: 'manual' }), 1);
    markCoverSearchedIn(target, ['found'], 77);
    const before = { found: whole('found'), typed: whole('typed') };

    placeTracksIn(
      target,
      [
        placing('found', { status: 'matched', trackNumber: 7, discNumber: 2 }),
        placing('typed', { status: 'manual', trackNumber: 7, discNumber: 2 }, 4, 1),
      ],
      2
    );

    assert.deepEqual(whole('found'), { ...before.found, track_number: 3, disc_number: null });
    assert.deepEqual(whole('typed'), { ...before.typed, track_number: 4, disc_number: 1 });
  });

  it('makes a row of the place alone where there is none, and of a note that nothing was found', () => {
    const { target, whole } = open();
    saveMetadataTo(target, miss('missed'), 1);

    placeTracksIn(target, [placing('new', NONE), placing('missed', { ...NONE, status: 'not_found' }, 5)], 2);

    const bare = {
      status: 'matched', source: null, title: null, artist: null, album: null, genre: null,
      year: null, artwork_url: null, disc_number: null, cover_searched_at: null,
      album_artist: null, cover_removed_at: null,
    };
    assert.deepEqual(whole('new'), { track_id: 'new', ...bare, track_number: 3 });
    assert.deepEqual(whole('missed'), { track_id: 'missed', ...bare, track_number: 5 });
  });

  it('is put back exactly: the numbers a row had, a miss a miss, and no row where there was none', () => {
    const { target, whole } = open();
    saveMetadataTo(target, full('found'), 1);
    saveMetadataTo(target, full('typed', { status: 'manual', source: 'manual', trackNumber: null, discNumber: null }), 1);
    saveMetadataTo(target, miss('missed'), 1);
    const before = ['found', 'typed', 'missed', 'new'].map(whole);
    const placings = [
      placing('found', { status: 'matched', trackNumber: 7, discNumber: 2 }),
      placing('typed', { status: 'manual', trackNumber: null, discNumber: null }, 4, 1),
      placing('missed', { ...NONE, status: 'not_found' }, 5),
      placing('new', NONE, 6),
    ];

    placeTracksIn(target, placings, 2);
    unplaceTracksIn(target, placings);

    assert.deepEqual(['found', 'typed', 'missed', 'new'].map(whole), before);
  });

  it('keeps what a made row was given since, and takes only the place back', () => {
    const { target, whole } = open();
    const placings = [placing('new', NONE)];
    placeTracksIn(target, placings, 2);
    fillCoversIn(target, [{ trackIds: ['new'], uri: 'file:///covers/a.jpg', album: 'Ruins' }]);

    unplaceTracksIn(target, placings);

    assert.equal(whole('new')?.artwork_url, 'file:///covers/a.jpg');
    assert.equal(whole('new')?.track_number, null);
  });

  it('does not take back a place that has been changed again since', () => {
    const { target, whole } = open();
    saveMetadataTo(target, full('found'), 1);
    const placings = [placing('found', { status: 'matched', trackNumber: 7, discNumber: 2 })];
    placeTracksIn(target, placings, 2);
    saveMetadataTo(target, full('found', { status: 'manual', trackNumber: 9, discNumber: null }), 3);

    unplaceTracksIn(target, placings);

    assert.equal(whole('found')?.track_number, 9);
  });
});
