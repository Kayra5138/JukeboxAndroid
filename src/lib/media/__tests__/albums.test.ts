import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { albumsOf, orderWithin } from '../albums.ts';
import type { EnrichedTrack } from '../enriched.ts';
import { track } from '../../__tests__/support.ts';

const song = (
  id: string,
  fields: Partial<EnrichedTrack> & { title: string }
): EnrichedTrack => ({
  ...track({ id, title: fields.title }),
  genre: null,
  year: null,
  discNumber: null,
  tags: [],
  enriched: true,
  ...fields,
});

const names = (tracks: EnrichedTrack[]) => tracks.map((entry) => entry.title);

describe('albumsOf', () => {
  it('collects the tracks that name the same record', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Ruins', artist: 'Someone' }),
      song('2', { title: 'B', album: 'Ruins', artist: 'Someone' }),
      song('3', { title: 'C', album: 'Other', artist: 'Someone' }),
    ]);

    assert.equal(albums.length, 2);
    assert.deepEqual(
      albums.map((album) => album.name).sort(),
      ['Other', 'Ruins']
    );
  });

  it('treats two spellings as one record', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Ruins' }),
      song('2', { title: 'B', album: ' ruins ' }),
    ]);

    assert.equal(albums.length, 1);
    assert.equal(albums[0].tracks.length, 2);
    // The spelling of the first one it saw, since one has to be chosen.
    assert.equal(albums[0].name, 'Ruins');
  });

  it('leaves out tracks that name no record', () => {
    // Not an album called nothing: tracks whose record is unknown. Collecting
    // them under one heading would invent a release.
    const albums = albumsOf([
      song('1', { title: 'A', album: null }),
      song('2', { title: 'B', album: '   ' }),
    ]);
    assert.deepEqual(albums, []);
  });

  it('keeps a compilation together rather than splitting it per artist', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Mix', artist: 'One' }),
      song('2', { title: 'B', album: 'Mix', artist: 'Two' }),
      song('3', { title: 'C', album: 'Mix', artist: 'Three' }),
      song('4', { title: 'D', album: 'Mix', artist: 'Four' }),
    ]);

    assert.equal(albums.length, 1);
    // Nobody appears on half of it, so naming one of them would be picking at
    // random.
    assert.equal(albums[0].artist, null);
  });

  it('names the artist when the record is mostly theirs', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Ruins', artist: 'Someone' }),
      song('2', { title: 'B', album: 'Ruins', artist: 'Someone' }),
      song('3', { title: 'C', album: 'Ruins', artist: 'A Guest' }),
    ]);

    assert.equal(albums[0].artist, 'Someone');
  });

  it('takes the year from whichever track knows it', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Ruins', year: null }),
      song('2', { title: 'B', album: 'Ruins', year: 2019 }),
    ]);

    assert.equal(albums[0].year, 2019);
  });
});

describe('orderWithin', () => {
  it('puts numbered tracks in their own order', () => {
    const ordered = orderWithin([
      song('1', { title: 'Third', trackNumber: 3 }),
      song('2', { title: 'First', trackNumber: 1 }),
      song('3', { title: 'Second', trackNumber: 2 }),
    ]);

    assert.deepEqual(names(ordered), ['First', 'Second', 'Third']);
  });

  it('reads discs before track numbers', () => {
    const ordered = orderWithin([
      song('1', { title: 'Two one', trackNumber: 1, discNumber: 2 }),
      song('2', { title: 'One nine', trackNumber: 9, discNumber: 1 }),
    ]);

    assert.deepEqual(names(ordered), ['One nine', 'Two one']);
  });

  it('puts what it cannot place after what it can, by filename', () => {
    // A track nobody has numbered is not track zero, and slipping it in among
    // the ones that are known would be claiming to know.
    const ordered = orderWithin([
      song('1', { title: 'Unknown b', filename: 'b.mp3' }),
      song('2', { title: 'Second', trackNumber: 2 }),
      song('3', { title: 'Unknown a', filename: 'a.mp3' }),
      song('4', { title: 'First', trackNumber: 1 }),
    ]);

    assert.deepEqual(names(ordered), ['First', 'Second', 'Unknown a', 'Unknown b']);
  });

  it('does not take a zero or a negative for a position', () => {
    const ordered = orderWithin([
      song('1', { title: 'Zero', trackNumber: 0, filename: 'z.mp3' }),
      song('2', { title: 'Real', trackNumber: 4 }),
    ]);

    assert.deepEqual(names(ordered), ['Real', 'Zero']);
  });

  it('leaves a record nobody numbered in filename order', () => {
    const ordered = orderWithin([
      song('1', { title: 'C', filename: '03.mp3' }),
      song('2', { title: 'A', filename: '01.mp3' }),
      song('3', { title: 'B', filename: '02.mp3' }),
    ]);

    assert.deepEqual(names(ordered), ['A', 'B', 'C']);
  });
});
