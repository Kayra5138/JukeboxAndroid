import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { track } from '../../__tests__/support.ts';
import { migrate } from '../../db/migrations.ts';
import { mergeMetadata, type EnrichedTrack } from '../../media/enriched.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import type { Tag } from '../../db/tags.ts';
import type { Track } from '../../types.ts';
import { CACHE_VERSION, decodeLibrary, encodeLibrary } from '../cache.ts';
import { watchOverlay } from '../overlay.ts';
import { keepIdentity, keepMap, sameTrack } from '../reconcile.ts';
import { createLibraryStore, type LibraryDeps, type LibraryState } from '../store.ts';

/** A reading of the device: the same tracks every time, and never the same objects. */
const reading = (tracks: Track[]): Track[] => tracks.map((entry) => ({ ...entry }));

const THREE = [
  track({ id: '1', title: 'One', artist: 'A', size: 100 }),
  track({ id: '2', title: 'Two', artist: 'A', size: 200 }),
  track({ id: '3', title: 'Three', artist: 'B', size: 300 }),
];

describe('keeping the tracks that have not changed', () => {
  it('hands back the very list when a reading says the same', () => {
    const shown = reading(THREE);
    assert.equal(keepIdentity(shown, reading(THREE)), shown);
  });

  it('keeps every unchanged track and takes the changed one from the reading', () => {
    const shown = reading(THREE);
    const read = reading(THREE);
    read[1] = { ...read[1], title: 'Two (remastered)' };
    const kept = keepIdentity(shown, read);
    assert.notEqual(kept, shown);
    assert.equal(kept[0], shown[0]);
    assert.equal(kept[1], read[1]);
    assert.equal(kept[2], shown[2]);
  });

  it('drops a track that is no longer read, and keeps the rest', () => {
    const shown = reading(THREE);
    const kept = keepIdentity(shown, reading([THREE[0], THREE[2]]));
    assert.deepEqual(kept.map((entry) => entry.id), ['1', '3']);
    assert.equal(kept[0], shown[0]);
    assert.equal(kept[1], shown[2]);
  });

  it('takes in a new track without disturbing the others', () => {
    const shown = reading(THREE);
    const four = track({ id: '4', title: 'Four' });
    const kept = keepIdentity(shown, reading([THREE[0], four, THREE[1], THREE[2]]));
    assert.deepEqual(kept.map((entry) => entry.id), ['1', '4', '2', '3']);
    assert.equal(kept[0], shown[0]);
    assert.equal(kept[2], shown[1]);
    assert.equal(kept[3], shown[2]);
  });

  it('follows the order of the reading, with the same tracks', () => {
    const shown = reading(THREE);
    const kept = keepIdentity(shown, reading([THREE[2], THREE[0], THREE[1]]));
    assert.notEqual(kept, shown);
    assert.deepEqual(kept, [shown[2], shown[0], shown[1]]);
    assert.equal(kept[0], shown[2]);
  });

  it('reads tags by what they say and not by which list they are', () => {
    const one = { id: '1', tags: ['rock', 'live'], year: 1991 };
    assert.ok(sameTrack(one, { id: '1', tags: ['rock', 'live'], year: 1991 }));
    assert.ok(!sameTrack(one, { id: '1', tags: ['live', 'rock'], year: 1991 }));
    assert.ok(!sameTrack(one, { id: '1', tags: ['rock'], year: 1991 }));
    assert.ok(!sameTrack(one, { id: '1', tags: ['rock', 'live'], year: 1992 }));
  });

  it('tells nothing from nought and from a field that is not there', () => {
    assert.ok(!sameTrack({ id: '1', size: null as number | null }, { id: '1', size: 0 }));
    assert.ok(!sameTrack<{ id: string; size?: number | null }>({ id: '1', size: null }, { id: '1' }));
  });

  it('makes an empty list of an empty reading', () => {
    const shown = reading(THREE);
    assert.deepEqual(keepIdentity(shown, []), []);
    const none: Track[] = [];
    assert.equal(keepIdentity(none, []), none);
  });
});

describe('keeping what is read beside the library', () => {
  it('is the map it was when it says what it said, and the new one when it does not', () => {
    const shown = new Map([['1', 10], ['2', 20]]);
    assert.equal(keepMap(shown, new Map([['2', 20], ['1', 10]])), shown);
    const more = new Map([['1', 10], ['2', 20], ['3', 30]]);
    assert.equal(keepMap(shown, more), more);
    const other = new Map([['1', 10], ['2', 21]]);
    assert.equal(keepMap(shown, other), other);
    const renamed = new Map([['1', 10], ['9', 20]]);
    assert.equal(keepMap(shown, renamed), renamed);
    const empty = new Map<string, number>();
    assert.equal(keepMap(empty, new Map()), empty);
  });
});

describe('the library as it is written down', () => {
  it('comes back as it went in', () => {
    const tracks = [
      track({ id: '7', title: 'Şarkı "bir"', artist: null, album: 'Albüm', trackNumber: 3, folder: 'Music/x d/', filename: 'a.mp3', addedAt: 1_700_000_000_000, size: 4_123_456 }),
      track({ id: '8', size: null }),
    ];
    assert.deepEqual(decodeLibrary(encodeLibrary('Music', tracks), 'Music'), tracks);
  });

  it('reads a track written without its size as one whose size is not known', () => {
    const [back] = decodeLibrary(encodeLibrary('Music', [track({ id: '7' })]), 'Music') ?? [];
    assert.equal(back?.size, null);
  });

  it('is nothing when there is nothing, or nothing that can be read', () => {
    assert.equal(decodeLibrary(null, 'Music'), null);
    assert.equal(decodeLibrary('', 'Music'), null);
    assert.equal(decodeLibrary('{"v":1,"root":"Music","rows":[[', 'Music'), null);
    assert.equal(decodeLibrary('null', 'Music'), null);
    assert.equal(decodeLibrary('[]', 'Music'), null);
  });

  it('is nothing when it was written by another version', () => {
    const words = encodeLibrary('Music', THREE);
    const older = JSON.stringify({ ...JSON.parse(words), v: CACHE_VERSION - 1 });
    const newer = JSON.stringify({ ...JSON.parse(words), v: CACHE_VERSION + 1 });
    assert.equal(decodeLibrary(older, 'Music'), null);
    assert.equal(decodeLibrary(newer, 'Music'), null);
    // The shape every earlier idea of this would have had: a bare list of tracks.
    assert.equal(decodeLibrary(JSON.stringify(THREE), 'Music'), null);
  });

  it('is nothing when its fields are not the ones a track has now', () => {
    const kept = JSON.parse(encodeLibrary('Music', THREE));
    const fewer = { ...kept, fields: kept.fields.slice(0, -1), rows: kept.rows.map((row: unknown[]) => row.slice(0, -1)) };
    const renamed = { ...kept, fields: kept.fields.map((field: string) => (field === 'folder' ? 'path' : field)) };
    assert.equal(decodeLibrary(JSON.stringify(fewer), 'Music'), null);
    assert.equal(decodeLibrary(JSON.stringify(renamed), 'Music'), null);
  });

  it('is nothing when it is of another folder', () => {
    assert.equal(decodeLibrary(encodeLibrary('Music', THREE), 'Music/Albums'), null);
  });

  it('is nothing at all when any one row is not a track', () => {
    const spoil = (change: (rows: unknown[][]) => void) => {
      const kept = JSON.parse(encodeLibrary('Music', THREE));
      change(kept.rows);
      return JSON.stringify(kept);
    };
    assert.equal(decodeLibrary(spoil((rows) => { rows[1][0] = 2; }), 'Music'), null);
    assert.equal(decodeLibrary(spoil((rows) => { rows[1][2] = null; }), 'Music'), null);
    assert.equal(decodeLibrary(spoil((rows) => { rows[2][6] = 'long'; }), 'Music'), null);
    assert.equal(decodeLibrary(spoil((rows) => { rows[0].pop(); }), 'Music'), null);
    assert.equal(decodeLibrary(spoil((rows) => { rows[2][0] = rows[0][0]; }), 'Music'), null);
    assert.equal(decodeLibrary(spoil((rows) => { rows.push('x' as unknown as unknown[]); }), 'Music'), null);
  });
});

describe('counting the writes to what the app knows of the tracks', () => {
  function open() {
    const database = new DatabaseSync(':memory:');
    const target = {
      execSync: (sql: string) => database.exec(sql),
      getFirstSync: <T,>(sql: string) => (database.prepare(sql).get() as T) ?? null,
    };
    migrate(target);
    return { database, count: watchOverlay(target), target };
  }
  const describeTrack = (database: DatabaseSync, id: string, album: string) =>
    database
      .prepare(
        `INSERT INTO track_metadata (track_id, status, album, fetched_at) VALUES (?, 'matched', ?, 0)
         ON CONFLICT(track_id) DO UPDATE SET album = excluded.album`
      )
      .run(id, album);

  it('moves for a row added, changed or taken away in either table', () => {
    const { database, count } = open();
    let last = count();
    const moved = () => {
      const now = count();
      const did = now !== last;
      last = now;
      return did;
    };
    describeTrack(database, '1', 'First');
    assert.ok(moved(), 'a row added');
    describeTrack(database, '1', 'Second');
    assert.ok(moved(), 'a row written over');
    database.prepare(`UPDATE track_metadata SET genre = 'rock' WHERE track_id = '1'`).run();
    assert.ok(moved(), 'a row changed');
    database.prepare(`INSERT INTO track_tags (track_id, tag, position, source) VALUES ('1', 'rock', 0, 'manual')`).run();
    assert.ok(moved(), 'a tag added');
    database.prepare(`UPDATE track_tags SET track_id = '2' WHERE track_id = '1'`).run();
    assert.ok(moved(), 'a tag moved to another track');
    database.prepare(`DELETE FROM track_tags`).run();
    assert.ok(moved(), 'a tag taken away');
    database.prepare(`DELETE FROM track_metadata`).run();
    assert.ok(moved(), 'a row taken away');
  });

  it('stays where it is for a write that changes nothing, and for other tables', () => {
    const { database, count } = open();
    describeTrack(database, '1', 'First');
    const before = count();
    database.prepare(`UPDATE track_metadata SET genre = 'rock' WHERE track_id = 'nobody'`).run();
    database.prepare(`INSERT INTO settings (key, value) VALUES ('a', 'b')`).run();
    database.prepare(`SELECT * FROM track_metadata`).all();
    assert.equal(count(), before);
  });

  it('can be begun twice on one connection without losing count', () => {
    const { database, count, target } = open();
    describeTrack(database, '1', 'First');
    const before = count();
    const again = watchOverlay(target);
    assert.equal(again(), before);
    describeTrack(database, '2', 'Other');
    assert.equal(again(), count());
    assert.notEqual(count(), before);
  });
});

/** A device and a database that say what the test tells them to, and count how often they are asked. */
function world(start: { tracks?: Track[]; kept?: string | null; root?: string } = {}) {
  const w = {
    root: start.root ?? 'Music',
    tracks: start.tracks ?? reading(THREE),
    permitted: true,
    /** What the stamp says. Null is "cannot say", as an older native build would. */
    stamp: 'a' as string | null,
    /** Thrown by the next scan, once. */
    failing: null as Error | null,
    metadata: new Map<string, TrackMetadata>(),
    tags: new Map<string, Tag[]>(),
    writes: 0 as number | null,
    kept: start.kept ?? null,
    scans: 0,
    merges: 0,
    keeps: 0,
    /** A scan waits on this when it is set, so a test can act while one is under way. */
    gate: null as Promise<void> | null,
  };
  const deps: LibraryDeps = {
    permitted: async () => w.permitted,
    root: () => w.root,
    scan: async () => {
      w.scans += 1;
      if (w.gate) await w.gate;
      if (w.failing) {
        const failure = w.failing;
        w.failing = null;
        throw failure;
      }
      return reading(w.tracks);
    },
    stamp: async () => w.stamp,
    merge: (tracks) => {
      w.merges += 1;
      return mergeMetadata(tracks, { readAllMetadata: () => w.metadata, allTags: () => w.tags });
    },
    overlay: () => w.writes,
    kept: {
      read: () => w.kept,
      write: (words) => {
        w.keeps += 1;
        w.kept = words;
      },
      clear: () => {
        w.keeps += 1;
        w.kept = null;
      },
    },
    later: (work) => work(),
  };
  const store = createLibraryStore(deps);
  const seen: LibraryState[] = [];
  store.subscribe(() => seen.push(store.state()));
  const tracks = (): EnrichedTrack[] => {
    const state = store.state();
    assert.equal(state.kind, 'library');
    return state.kind === 'library' ? state.tracks : [];
  };
  return { w, store, seen, tracks };
}

const matched = (trackId: string, changes: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId, status: 'matched', source: 'musicbrainz', title: null, artist: null, album: null,
  genre: null, year: null, artworkUrl: null, trackNumber: null, discNumber: null, ...changes,
});

describe('the one library', () => {
  it('reads the device the first time it is asked, and shows what it read', async () => {
    const { w, store, seen, tracks } = world();
    assert.deepEqual(store.state(), { kind: 'loading' });
    await store.refresh();
    assert.deepEqual(tracks().map((entry) => entry.id), ['1', '2', '3']);
    assert.equal(w.scans, 1);
    const state = store.state();
    assert.ok(state.kind === 'library' && state.confirmed && state.failure === null);
    // Nothing was on show, so the screens were told once and only once.
    assert.equal(seen.length, 1);
  });

  it('reads nothing and tells nobody when a look finds everything as it was', async () => {
    const { w, store, seen, tracks } = world();
    await store.refresh();
    const before = store.state();
    const list = tracks();
    seen.length = 0;
    await store.refresh();
    await store.refresh();
    assert.equal(w.scans, 1);
    assert.equal(w.merges, 1);
    assert.equal(store.state(), before);
    assert.equal(tracks(), list);
    assert.equal(seen.length, 0);
  });

  it('keeps every track it was showing when the device is read again and says the same', async () => {
    const { w, store, seen, tracks } = world();
    await store.refresh();
    const list = tracks();
    const first = [...list];
    seen.length = 0;
    w.stamp = 'b';
    await store.refresh();
    assert.equal(w.scans, 2);
    assert.equal(tracks(), list);
    tracks().forEach((entry, at) => assert.equal(entry, first[at]));
    assert.equal(seen.length, 0);
    // And the same when it is read because somebody insisted.
    await store.refresh(true);
    assert.equal(w.scans, 3);
    assert.equal(tracks(), list);
    assert.equal(seen.length, 0);
    // Neither reading was merged again, the tables not having been written to.
    assert.equal(w.merges, 1);
  });

  it('reads a changed file again and leaves the others as they were', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    const first = tracks();
    w.tracks = [THREE[0], { ...THREE[1], title: 'Two, retagged', size: 222 }, THREE[2]];
    w.stamp = 'b';
    await store.refresh();
    const second = tracks();
    assert.notEqual(second, first);
    assert.equal(second[0], first[0]);
    assert.notEqual(second[1], first[1]);
    assert.equal(second[1].title, 'Two, retagged');
    assert.equal(second[2], first[2]);
  });

  it('drops a file that has gone and takes in one that has arrived', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    const first = tracks();
    w.tracks = [THREE[0], THREE[2], track({ id: '9', title: 'Nine' })];
    w.stamp = 'b';
    await store.refresh();
    const second = tracks();
    assert.deepEqual(second.map((entry) => entry.id), ['1', '3', '9']);
    assert.equal(second[0], first[0]);
    assert.equal(second[1], first[2]);
  });

  it('does not notice a change the stamp does not own up to, until it is forced', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    w.tracks = [THREE[0]];
    await store.refresh();
    assert.equal(tracks().length, 3);
    await store.refresh(true);
    assert.equal(tracks().length, 1);
  });

  it('reads the device every time while there is no stamp to go by', async () => {
    const { w, store, seen, tracks } = world();
    w.stamp = null;
    await store.refresh();
    const list = tracks();
    seen.length = 0;
    await store.refresh();
    assert.equal(w.scans, 2);
    assert.equal(tracks(), list);
    assert.equal(seen.length, 0);
    w.tracks = [THREE[0]];
    await store.refresh();
    assert.equal(tracks().length, 1);
  });

  it('lays the tables over again when they have been written to, without reading the device', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    const first = tracks();
    w.metadata.set('2', matched('2', { genre: 'rock', year: 1991 }));
    w.tags.set('2', [{ tag: 'rock', position: 0, source: 'musicbrainz' }]);
    w.writes = 1;
    await store.refresh();
    const second = tracks();
    assert.equal(w.scans, 1);
    assert.equal(second[0], first[0]);
    assert.notEqual(second[1], first[1]);
    assert.equal(second[1].year, 1991);
    assert.deepEqual(second[1].tags, ['rock']);
    assert.equal(second[2], first[2]);
  });

  it('keeps the list it was showing when the tables were written to and say the same', async () => {
    const { w, store, seen, tracks } = world();
    w.tags.set('2', [{ tag: 'rock', position: 0, source: 'manual' }]);
    await store.refresh();
    const list = tracks();
    seen.length = 0;
    // Written again as they were: new rows, new lists, the same words.
    w.tags = new Map([['2', [{ tag: 'rock', position: 0, source: 'manual' }]]]);
    w.writes = 5;
    await store.refresh();
    assert.equal(w.merges, 2);
    assert.equal(tracks(), list);
    assert.equal(seen.length, 0);
  });

  it('lays the tables over on every look while there is no count to go by', async () => {
    const { w, store, tracks } = world();
    w.writes = null;
    await store.refresh();
    const first = tracks();
    w.metadata.set('1', matched('1', { year: 2001 }));
    await store.refresh();
    assert.equal(w.scans, 1);
    assert.equal(tracks()[0].year, 2001);
    assert.equal(tracks()[1], first[1]);
  });

  it('keeps the library on show when a reading fails, and says what went wrong', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    const list = tracks();
    w.failing = new Error('The media store is away.');
    w.stamp = 'b';
    await store.refresh();
    const state = store.state();
    assert.ok(state.kind === 'library');
    assert.equal(state.tracks, list);
    assert.match(state.failure ?? '', /media store is away/);
    // What is written down for the next start is not touched by it either.
    assert.deepEqual(decodeLibrary(w.kept, 'Music')?.map((entry) => entry.id), ['1', '2', '3']);

    // And the next look that works takes the complaint back.
    w.tracks = [THREE[0], THREE[1]];
    await store.refresh();
    const after = store.state();
    assert.ok(after.kind === 'library' && after.failure === null);
    assert.equal(tracks().length, 2);
    assert.equal(tracks()[0], list[0]);
  });

  it('takes the complaint back without a word more when the library is as it was', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    const list = tracks();
    w.failing = new Error('no');
    await store.refresh(true);
    assert.ok(store.state().kind === 'library' && (store.state() as { failure: string | null }).failure);
    await store.refresh();
    const state = store.state();
    assert.ok(state.kind === 'library' && state.failure === null && state.confirmed);
    assert.equal(tracks(), list);
  });

  it('says it failed, and no more, when a reading fails with nothing on show', async () => {
    const { w, store } = world();
    w.failing = new Error('The media store is away.');
    await store.refresh();
    const state = store.state();
    assert.ok(state.kind === 'error');
    assert.match(state.message, /media store is away/);
    await store.refresh();
    assert.equal(store.state().kind, 'library');
  });

  it('shows nothing it holds once leave to read is taken away, and reads afresh when it is given back', async () => {
    const { w, store } = world();
    await store.refresh();
    w.permitted = false;
    await store.refresh();
    assert.deepEqual(store.state(), { kind: 'denied' });
    assert.equal(w.scans, 1);
    // What was written down stays written down: nothing was learned about the files.
    assert.ok(w.kept);
    w.permitted = true;
    await store.refresh();
    assert.equal(store.state().kind, 'library');
    assert.equal(w.scans, 2);
  });

  it('shows an empty library as empty, since that is what the device said', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    w.tracks = [];
    w.stamp = 'b';
    await store.refresh();
    assert.deepEqual(tracks(), []);
    // But does not write an empty one down for the next start to open on.
    assert.equal(w.kept, null);
  });

  it('reads the other folder when the folder is changed, whatever the stamp says', async () => {
    const { w, store, tracks } = world();
    await store.refresh();
    w.root = 'Music/Albums';
    w.tracks = [THREE[2]];
    await store.refresh();
    assert.equal(w.scans, 2);
    assert.deepEqual(tracks().map((entry) => entry.id), ['3']);
    assert.deepEqual(decodeLibrary(w.kept, 'Music/Albums')?.map((entry) => entry.id), ['3']);
    assert.equal(decodeLibrary(w.kept, 'Music'), null);
  });

  it('looks once more when it is asked while already looking, and settles both askers together', async () => {
    const { w, store, tracks } = world();
    let open!: () => void;
    w.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const first = store.refresh();
    // Let the look get as far as its scan, then change the files under it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(w.scans, 1);
    const second = store.refresh(true);
    const third = store.refresh();
    assert.equal(second, first);
    assert.equal(third, first);
    w.gate = null;
    open();
    await second;
    assert.equal(w.scans, 2);
    assert.equal(tracks().length, 3);
  });

  it('does not start a second look when a screen asks again from inside being told', async () => {
    const { w, store } = world();
    let asked = 0;
    store.subscribe(() => {
      if (asked < 3) {
        asked += 1;
        void store.refresh();
      }
    });
    await store.refresh();
    // The first look, and one more for having been asked during it — which
    // found the stamp as it was, and so read nothing.
    assert.equal(w.scans, 1);
    assert.equal(store.state().kind, 'library');
  });
});

describe('the library written down for the next start', () => {
  it('is written once the device has been read, and not again while nothing changes', async () => {
    const { w, store } = world();
    await store.refresh();
    assert.equal(w.keeps, 1);
    assert.deepEqual(decodeLibrary(w.kept, 'Music')?.map((entry) => entry.id), ['1', '2', '3']);
    w.stamp = 'b';
    await store.refresh();
    await store.refresh(true);
    assert.equal(w.keeps, 1);
    w.tracks = [THREE[0]];
    await store.refresh(true);
    assert.equal(w.keeps, 2);
    assert.deepEqual(decodeLibrary(w.kept, 'Music')?.map((entry) => entry.id), ['1']);
  });

  it('is shown at once on a new start, marked as not yet confirmed, and then confirmed', async () => {
    const kept = encodeLibrary('Music', THREE);
    const { w, store, seen, tracks } = world({ kept });
    let open!: () => void;
    w.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const looking = store.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const early = store.state();
    assert.ok(early.kind === 'library' && !early.confirmed);
    const list = tracks();
    assert.deepEqual(list.map((entry) => entry.id), ['1', '2', '3']);
    w.gate = null;
    open();
    await looking;
    const late = store.state();
    assert.ok(late.kind === 'library' && late.confirmed);
    // The device said the same, so the list is the list that was shown, it
    // was merged the once, and it was not written down a second time.
    assert.equal(tracks(), list);
    assert.equal(w.scans, 1);
    assert.equal(w.merges, 1);
    assert.equal(w.keeps, 0);
    assert.deepEqual(seen.map((state) => state.kind), ['library', 'library']);
  });

  it('is read from the device on a new start even when the stamp is one it might have known', async () => {
    const { w, store, tracks } = world({ kept: encodeLibrary('Music', THREE) });
    w.tracks = [THREE[0], track({ id: '4', title: 'Four' })];
    await store.refresh();
    assert.equal(w.scans, 1);
    assert.deepEqual(tracks().map((entry) => entry.id), ['1', '4']);
    assert.deepEqual(decodeLibrary(w.kept, 'Music')?.map((entry) => entry.id), ['1', '4']);
  });

  it('is not shown without leave to read', async () => {
    const { w, store, seen } = world({ kept: encodeLibrary('Music', THREE) });
    w.permitted = false;
    await store.refresh();
    assert.deepEqual(store.state(), { kind: 'denied' });
    assert.ok(seen.every((state) => state.kind !== 'library'));
  });

  it('is passed over when it was written in a form no longer read', async () => {
    const stale = JSON.stringify({ ...JSON.parse(encodeLibrary('Music', THREE)), v: CACHE_VERSION + 7 });
    for (const kept of [stale, 'not json', JSON.stringify(THREE), encodeLibrary('Elsewhere', THREE)]) {
      const { w, store, seen, tracks } = world({ kept });
      let open!: () => void;
      w.gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      const looking = store.refresh();
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Nothing of it is shown while the device is being asked.
      assert.deepEqual(store.state(), { kind: 'loading' });
      w.gate = null;
      open();
      await looking;
      assert.equal(tracks().length, 3);
      assert.ok(seen.every((state) => state.kind !== 'library' || state.confirmed));
      // And it is written over with what the device said.
      assert.deepEqual(decodeLibrary(w.kept, 'Music')?.map((entry) => entry.id), ['1', '2', '3']);
    }
  });

  it('is passed over when reading it throws, and writing it failing harms nothing', async () => {
    const { store, tracks } = world();
    let scans = 0;
    const broken = createLibraryStore({
      permitted: async () => true,
      root: () => 'Music',
      scan: async () => {
        scans += 1;
        return reading(THREE);
      },
      stamp: async () => {
        throw new Error('no stamp');
      },
      merge: (tracks) => mergeMetadata(tracks, { readAllMetadata: () => new Map(), allTags: () => new Map() }),
      overlay: () => {
        throw new Error('no count');
      },
      kept: {
        read: () => {
          throw new Error('The file is spoiled.');
        },
        write: () => {
          throw new Error('The disk is full.');
        },
        clear: () => {
          throw new Error('The disk is full.');
        },
      },
      later: (work) => work(),
    });
    await broken.refresh();
    await broken.refresh();
    const state = broken.state();
    assert.ok(state.kind === 'library' && state.confirmed && state.failure === null);
    assert.equal(state.tracks.length, 3);
    // A stamp that cannot be had is no stamp: the device was read both times.
    assert.equal(scans, 2);
    // The other world is untouched by any of it.
    await store.refresh();
    assert.equal(tracks().length, 3);
  });

  it('is kept in step with what the app knows, which is read from the tables and not from it', async () => {
    const { w, store, tracks } = world({ kept: encodeLibrary('Music', THREE) });
    w.metadata.set('1', matched('1', { status: 'manual', title: 'One, as typed' }));
    await store.refresh();
    assert.equal(tracks()[0].title, 'One, as typed');
    assert.equal(decodeLibrary(w.kept, 'Music')?.[0].title, 'One');
  });
});
