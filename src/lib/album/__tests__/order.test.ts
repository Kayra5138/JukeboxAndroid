import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { track } from '../../__tests__/support.ts';
import { albumsOf } from '../../media/albums.ts';
import { mergeMetadata } from '../../media/enriched.ts';
import { outOfPlace, placedByApp, placedKey, vouchedFor, type Listing } from '../order.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import type { DownloadJob } from '../../youtube/types.ts';

const row = (trackId: string, fields: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId, status: 'matched', source: 'itunes', title: null, artist: null, album: null,
  genre: null, year: null, artworkUrl: null, trackNumber: null, discNumber: null, ...fields,
});

/** A list whose lines are `[position, the library's track or null]`, or with a disc in front. */
const list = (
  lines: ([number, string | null] | [number, number, string | null])[],
  more: Partial<Listing> = {}
): Listing => {
  const tracks = lines.map((line) =>
    line.length === 3
      ? { disc: line[0], position: line[1], have: line[2] }
      : { disc: 1, position: line[0], have: line[1] }
  );
  return {
    source: 'musicbrainz',
    by: null,
    covered: tracks.filter((entry) => entry.have).length,
    discs: new Set(tracks.map((entry) => entry.disc)).size,
    tracks,
    ...more,
  };
};

const owned = (id: string, trackNumber: number | null = null, discNumber: number | null = null) => ({
  id, trackNumber, discNumber,
});
const rows = (...held: TrackMetadata[]) => {
  const byId = new Map(held.map((entry) => [entry.trackId, entry]));
  return (id: string) => byId.get(id) ?? null;
};
const NOBODY: ReadonlySet<string> = new Set();
const NONE = { status: null, trackNumber: null, discNumber: null };

describe('which lists may renumber the library', () => {
  it('the catalogue’s, once one of the library’s tracks is on it', () => {
    assert.equal(vouchedFor({ source: 'musicbrainz', by: null, covered: 1 }), true);
    assert.equal(vouchedFor({ source: 'musicbrainz', by: null, covered: 0 }), false);
  });

  it('a playlist only when the library’s tracks confirmed it', () => {
    assert.equal(vouchedFor({ source: 'youtube', by: 'tracks', covered: 3 }), true);
    // Taken on trust, even where a track of it happens to be here.
    assert.equal(vouchedFor({ source: 'youtube', by: 'album', covered: 1 }), false);
    assert.equal(vouchedFor({ source: 'youtube', by: 'album', covered: 0 }), false);
    assert.equal(vouchedFor({ source: 'youtube', by: 'tracks', covered: 0 }), false);
  });

  it('nothing is moved by a list that may not', () => {
    const lines: [number, string | null][] = [[1, 'a'], [2, 'b']];
    const here = [owned('a'), owned('b')];
    assert.deepEqual(outOfPlace(list(lines, { source: 'youtube', by: 'album' }), here, rows(), NOBODY), []);
    assert.deepEqual(outOfPlace(list(lines, { covered: 0 }), here, rows(), NOBODY), []);
    assert.equal(outOfPlace(list(lines, { source: 'youtube', by: 'tracks' }), here, rows(), NOBODY).length, 2);
  });
});

describe('which tracks are out of place', () => {
  it('one with no number, and one with the wrong number', () => {
    const moves = outOfPlace(
      list([[1, 'none'], [2, 'wrong'], [3, null]]),
      [owned('none'), owned('wrong', 7)],
      rows(row('wrong', { trackNumber: 7, genre: 'rock' })),
      NOBODY
    );
    assert.deepEqual(moves, [
      { trackId: 'none', trackNumber: 1, discNumber: null, was: NONE },
      { trackId: 'wrong', trackNumber: 2, discNumber: null, was: { status: 'matched', trackNumber: 7, discNumber: null } },
    ]);
  });

  it('not one that is where the list has it, whoever says so', () => {
    // The second has its number from the file, under a row that names none.
    const moves = outOfPlace(
      list([[1, 'row'], [2, 'file']]),
      [owned('row', 1), owned('file', 2)],
      rows(row('row', { trackNumber: 1 }), row('file')),
      NOBODY
    );
    assert.deepEqual(moves, []);
  });

  it('never a track the list has no line for', () => {
    const moves = outOfPlace(list([[1, 'known'], [2, null]]), [owned('known', 1), owned('stray'), owned('other', 9)], rows(), NOBODY);
    assert.deepEqual(moves, []);
  });

  it('a wrong number under a note that nothing was found is the file’s, and is replaced', () => {
    const moves = outOfPlace(list([[4, 'a']]), [owned('a', 1)], rows(row('a', { status: 'not_found', source: null })), NOBODY);
    assert.deepEqual(moves, [
      { trackId: 'a', trackNumber: 4, discNumber: null, was: { status: 'not_found', trackNumber: null, discNumber: null } },
    ]);
  });
});

describe('a number somebody typed', () => {
  const typed = row('a', { status: 'manual', source: 'manual', title: 'Typed', trackNumber: 9 });

  it('stays', () => {
    assert.deepEqual(outOfPlace(list([[2, 'a']]), [owned('a', 9)], rows(typed), NOBODY), []);
  });

  it('an edit that says nothing of the place is given one', () => {
    const edit = row('a', { status: 'manual', source: 'manual', title: 'Typed' });
    const moves = outOfPlace(list([[2, 'a']]), [owned('a')], rows(edit), NOBODY);
    assert.deepEqual(moves, [
      { trackId: 'a', trackNumber: 2, discNumber: null, was: { status: 'manual', trackNumber: null, discNumber: null } },
    ]);
  });

  it('a number the app filed a download under is the app’s to change', () => {
    const own = new Set([placedKey('a', { track: 9, disc: null })]);
    const moves = outOfPlace(list([[2, 'a']]), [owned('a', 9)], rows(typed), own);
    assert.equal(moves[0]?.trackNumber, 2);
    assert.deepEqual(moves[0]?.was, { status: 'manual', trackNumber: 9, discNumber: null });
  });

  it('but not once it has been changed by hand to another', () => {
    const own = new Set([placedKey('a', { track: 5, disc: null })]);
    assert.deepEqual(outOfPlace(list([[2, 'a']]), [owned('a', 9)], rows(typed), own), []);
  });
});

describe('the downloads the app numbered', () => {
  const job = (id: string, fields: Partial<DownloadJob>, placement?: unknown): DownloadJob => ({
    id,
    video: { id, url: '', title: id, channel: '', thumbnail: null, duration: 200, placement } as DownloadJob['video'],
    format: 'mp3', folder: 'Music', status: 'done', progress: 100, trackId: null, error: null, described: true,
    ...fields,
  });
  const place = (trackNumber: number, album = 'Meteora', disc: number | null = null) => ({
    album, title: 'Faint', artist: 'Linkin Park', track: trackNumber, disc, year: null, genre: null,
  });

  it('are the finished ones fetched for this record, each at the place it was fetched for', () => {
    const placed = placedByApp(
      [
        job('1', { trackId: 'a' }, place(7)),
        job('2', { trackId: 'b' }, place(2, 'Meteora', 2)),
        // Not in yet, fetched for another record, and fetched for none.
        job('3', { trackId: null, status: 'downloading' }, place(3)),
        job('4', { trackId: 'd' }, place(4, 'Hybrid Theory')),
        job('5', { trackId: 'e' }),
      ],
      'meteora'
    );
    assert.deepEqual([...placed].sort(), [placedKey('a', { track: 7, disc: null }), placedKey('b', { track: 2, disc: 2 })].sort());
  });
});

describe('the disc', () => {
  it('is written from a list of more than one', () => {
    const moves = outOfPlace(
      list([[1, 1, 'a'], [2, 1, 'b']]),
      [owned('a', 1), owned('b', 1)],
      rows(),
      NOBODY
    );
    // The first is on disc 1 by saying nothing, which is how it sorts.
    assert.deepEqual(moves, [{ trackId: 'b', trackNumber: 1, discNumber: 2, was: NONE }]);
  });

  it('is written with the number, where the number was what was wrong', () => {
    const moves = outOfPlace(list([[1, 3, 'a'], [2, 1, null]]), [owned('a')], rows(), NOBODY);
    assert.deepEqual(moves, [{ trackId: 'a', trackNumber: 3, discNumber: 1, was: NONE }]);
  });

  it('is left as the library has it on a record of one disc', () => {
    const moves = outOfPlace(
      list([[1, 'unsaid'], [2, 'one']]),
      [owned('unsaid', 5), owned('one', 6, 1)],
      rows(row('one', { trackNumber: 6, discNumber: 1 })),
      NOBODY
    );
    assert.deepEqual(moves.map((move) => move.discNumber), [null, 1]);
    // And neither is a reason to write anything.
    assert.deepEqual(outOfPlace(list([[1, 'unsaid'], [2, 'one']]), [owned('unsaid', 1), owned('one', 2, 1)], rows(), NOBODY), []);
  });

  it('is taken away where it would play the track after the whole record', () => {
    const moves = outOfPlace(
      list([[1, 'a'], [2, 'b']]),
      [owned('a', 1, 2), owned('b', 2)],
      rows(row('a', { trackNumber: 1, discNumber: 2 })),
      NOBODY
    );
    assert.deepEqual(moves, [
      { trackId: 'a', trackNumber: 1, discNumber: null, was: { status: 'matched', trackNumber: 1, discNumber: 2 } },
    ]);
  });
});

describe('what the library shows afterwards', () => {
  it('is the record in its order, with nothing else about a track changed', () => {
    const files = [
      track({ id: 'c', title: 'Third', album: 'Ruins', filename: 'a.mp3' }),
      track({ id: 'a', title: 'First', album: 'Ruins', filename: 'z.mp3', trackNumber: 4 }),
      track({ id: 'b', title: 'Second', album: 'Ruins', filename: 'm.mp3' }),
    ];
    const held = new Map<string, TrackMetadata>([
      ['a', row('a', { genre: 'rock', year: 2001, artworkUrl: 'file:///covers/a.jpg', trackNumber: 4 })],
      ['b', row('b', { status: 'manual', source: 'manual', title: 'Second, Corrected' })],
    ]);
    const store = { readAllMetadata: () => held, allTags: () => new Map() };
    const before = albumsOf(mergeMetadata(files, store))[0]!;
    assert.deepEqual(before.tracks.map((entry) => entry.id), ['a', 'c', 'b']);

    const moves = outOfPlace(list([[1, 'a'], [2, 'b'], [3, 'c']]), before.tracks, (id) => held.get(id) ?? null, NOBODY);
    // As the table writes them: the two columns of a row that is there, and a
    // row of nothing else where there is none.
    for (const move of moves) {
      const existing = held.get(move.trackId);
      held.set(move.trackId, {
        ...(existing ?? row(move.trackId, { source: null })),
        trackNumber: move.trackNumber,
        discNumber: move.discNumber,
      });
    }

    const after = albumsOf(mergeMetadata(files, store))[0]!;
    assert.deepEqual(after.tracks.map((entry) => entry.id), ['a', 'b', 'c']);
    const strip = ({ trackNumber: _n, discNumber: _d, enriched: _e, ...rest }: (typeof after.tracks)[number]) => rest;
    for (const entry of after.tracks) {
      assert.deepEqual(strip(entry), strip(before.tracks.find((other) => other.id === entry.id)!));
    }
  });
});
