import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { albumsOf } from '../albums.ts';
import type { EnrichedTrack } from '../enriched.ts';
import {
  asSortOrder,
  compareNames,
  nextSort,
  sortAlbums,
  sortTracks,
  type SortOrder,
} from '../sort.ts';
import { track } from '../../__tests__/support.ts';

function song(
  id: string,
  fields: Partial<EnrichedTrack> & { title: string }
): EnrichedTrack {
  return {
    ...track({ id, title: fields.title }),
    genre: null,
    year: null,
    discNumber: null,
    tags: [],
    enriched: false,
    ...fields,
  };
}

const titles = (tracks: EnrichedTrack[]) => tracks.map((entry) => entry.title);
const nothingPlayed = new Map<string, number>();

/** The alphabet in Turkish order, as a sorted list of one-word names. */
function ordered(names: string[]): string[] {
  return [...names].sort(compareNames);
}

describe('compareNames', () => {
  it('puts the dotless i before the dotted one', () => {
    // The whole reason the alphabet is written out: every engine that takes its
    // order from the device would put these the other way round on a phone set
    // to English, and `ısı` is not a word that belongs among the i's.
    assert.deepEqual(ordered(['iyi', 'ısı']), ['ısı', 'iyi']);
  });

  it('keeps the letters Turkish adds in the places Turkish gives them', () => {
    assert.deepEqual(
      ordered(['söz', 'su', 'sıra', 'şarkı', 'sen']),
      ['sen', 'sıra', 'söz', 'su', 'şarkı']
    );
    assert.deepEqual(ordered(['cam', 'çay', 'dal']), ['cam', 'çay', 'dal']);
    assert.deepEqual(ordered(['göz', 'gün', 'ağaç', 'gelir']), ['ağaç', 'gelir', 'göz', 'gün']);
  });

  it('does not let a capital decide anything', () => {
    assert.equal(compareNames('Şımarık', 'şımarık'), 0);
    // The dotted capital is the case the fold exists for: lowered by the
    // engine's own rules it becomes an `i` wearing a separate dot, which the
    // alphabet has never heard of.
    assert.equal(compareNames('İSTANBUL', 'istanbul'), 0);
    assert.deepEqual(ordered(['Zil', 'ada', 'Bir']), ['ada', 'Bir', 'Zil']);
  });

  it('files a letter it does not know under the one beneath it', () => {
    // An `é` is an `e` wearing something; ranking it by its code point would
    // put every word carrying one past the end of the alphabet.
    assert.deepEqual(ordered(['Cafz', 'Café', 'Cafa']), ['Cafa', 'Café', 'Cafz']);
    // The Turkish letters are not merely accents and are never folded this way.
    assert.notEqual(compareNames('öz', 'oz'), 0);
  });

  it('puts the shorter of two names that agree so far first', () => {
    assert.deepEqual(ordered(['Karanlık', 'Kar', 'Kara']), ['Kar', 'Kara', 'Karanlık']);
  });

  it('sorts digits and scripts it has no opinion about either side of the alphabet', () => {
    assert.deepEqual(ordered(['妖精帝國', 'aria', '1979']), ['1979', 'aria', '妖精帝國']);
  });
});

describe('asSortOrder and nextSort', () => {
  it('falls back to alphabetical for anything it does not recognise', () => {
    assert.equal(asSortOrder(null), 'name');
    assert.equal(asSortOrder('by-colour'), 'name');
    assert.equal(asSortOrder('played'), 'played');
  });

  it('comes back round to where it started', () => {
    const seen: SortOrder[] = ['name'];
    for (let step = 0; step < 3; step += 1) seen.push(nextSort(seen[seen.length - 1]!));
    assert.deepEqual(seen, ['name', 'added', 'played', 'name']);
  });
});

describe('sortTracks', () => {
  const library = [
    song('3', { title: 'Şımarık', artist: 'Tarkan', addedAt: 300 }),
    song('1', { title: 'ısırgan', artist: 'Biri', addedAt: 100 }),
    song('2', { title: 'iyilik', artist: 'Biri', addedAt: 200 }),
  ];

  it('leaves the list it was handed alone', () => {
    const before = titles(library);
    sortTracks(library, 'added', nothingPlayed);
    assert.deepEqual(titles(library), before);
  });

  it('orders by title rather than by artist', () => {
    // A departure from the order the media store hands the library over in, and
    // the point of offering the choice: the title is the line being scanned.
    assert.deepEqual(
      titles(sortTracks(library, 'name', nothingPlayed)),
      ['ısırgan', 'iyilik', 'Şımarık']
    );
  });

  it('puts the newest arrival first', () => {
    assert.deepEqual(
      titles(sortTracks(library, 'added', nothingPlayed)),
      ['Şımarık', 'iyilik', 'ısırgan']
    );
  });

  it('puts the most recently listened to first', () => {
    const played = new Map([
      ['1', 900],
      ['3', 500],
    ]);
    assert.deepEqual(
      titles(sortTracks(library, 'played', played)),
      // Never played, so it is not last in line — it is out of the question
      // altogether, and goes after everything that has an answer.
      ['ısırgan', 'Şımarık', 'iyilik']
    );
  });

  it('sends what it cannot date to the end, in alphabetical order', () => {
    const mixed = [
      song('1', { title: 'Zaman', addedAt: null }),
      song('2', { title: 'Bulut', addedAt: 100 }),
      song('3', { title: 'Adres', addedAt: null }),
    ];
    assert.deepEqual(titles(sortTracks(mixed, 'added', nothingPlayed)), ['Bulut', 'Adres', 'Zaman']);
  });

  it('settles two tracks of the same name the same way every time', () => {
    // A studio take and a live one really do share a title, and an order that
    // depends on how the engine's sort happened to run moves rows about
    // between one visit to the screen and the next.
    const same = [
      song('9', { title: 'Yalan', artist: 'Zeki' }),
      song('8', { title: 'Yalan', artist: 'Ahmet' }),
    ];
    assert.deepEqual(
      sortTracks(same, 'name', nothingPlayed).map((entry) => entry.artist),
      ['Ahmet', 'Zeki']
    );
    assert.deepEqual(
      sortTracks([...same].reverse(), 'name', nothingPlayed).map((entry) => entry.artist),
      ['Ahmet', 'Zeki']
    );
  });
});

describe('sortAlbums', () => {
  const names = (albums: { name: string }[]) => albums.map((album) => album.name);

  const shelf = albumsOf([
    song('1', { title: 'A', album: 'Gece', artist: 'Biri', addedAt: 100 }),
    song('2', { title: 'B', album: 'Gece', artist: 'Biri', addedAt: 900 }),
    song('3', { title: 'C', album: 'Ada', artist: 'Başka', addedAt: 400 }),
    song('4', { title: 'D', album: 'Ada', artist: 'Başka', addedAt: 500 }),
  ]);

  it('orders records by their own name, not by whoever made them', () => {
    assert.deepEqual(names(sortAlbums(shelf, 'name', nothingPlayed)), ['Ada', 'Gece']);
  });

  it('dates a record by its newest track rather than its first', () => {
    // A record arrives over time — a track at a time out of a download, or a
    // missing one filled in later — and dating it by the first would hide the
    // one new thing on the shelf in the view built to show what is new.
    assert.deepEqual(names(sortAlbums(shelf, 'added', nothingPlayed)), ['Gece', 'Ada']);
  });

  it('counts a listen to any track as a listen to the record', () => {
    const played = new Map([['3', 50]]);
    assert.deepEqual(names(sortAlbums(shelf, 'played', played)), ['Ada', 'Gece']);
  });

  it('sends a record nobody has played after every record somebody has', () => {
    const played = new Map([['1', 10]]);
    assert.deepEqual(names(sortAlbums(shelf, 'played', played)), ['Gece', 'Ada']);
  });

  it('leaves a shelf nothing can be said about in alphabetical order', () => {
    const undated = albumsOf([
      song('1', { title: 'A', album: 'Zil' }),
      song('2', { title: 'B', album: 'Ada' }),
    ]);
    assert.deepEqual(names(sortAlbums(undated, 'added', nothingPlayed)), ['Ada', 'Zil']);
    assert.deepEqual(names(sortAlbums(undated, 'played', nothingPlayed)), ['Ada', 'Zil']);
  });
});
