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

describe('the order albumsOf hands records back in', () => {
  /** One record per pair, each with a single track, handed over in the order given. */
  const filed = (records: [artist: string | null, album: string][]) =>
    albumsOf(
      records.map(([artist, album], at) => song(String(at), { title: 'A', album, artist }))
    ).map((album) => [album.artist, album.name]);

  /** The same for records told apart by who they are by: each has a name of its own. */
  const byArtist = (artists: string[]) =>
    filed(artists.map((artist, at) => [artist, `Record ${at}`])).map(([artist]) => artist);

  it('files by who a record is by, and then by what it is called', () => {
    assert.deepEqual(
      filed([
        ['Mor ve Ötesi', 'Dünya Yalan Söylüyor'],
        ['Duman', 'Seni Kendime Sakladım'],
        ['Duman', 'Belki Alışman Lazım'],
      ]),
      [
        ['Duman', 'Belki Alışman Lazım'],
        ['Duman', 'Seni Kendime Sakladım'],
        ['Mor ve Ötesi', 'Dünya Yalan Söylüyor'],
      ]
    );
  });

  it('reads the alphabet as Turkish does, whatever language the phone is in', () => {
    // Each of these comes after the letter it looks like and before the next
    // one along, and the undotted i comes before the dotted. Folded to ASCII,
    // or left to a phone in English, they come out in some other order.
    assert.deepEqual(
      byArtist([
        'Şebnem Ferah',
        'Sezen Aksu',
        'Tarkan',
        'Kibariye',
        'Kıraç',
        'Hande Yener',
        'Özdemir Erdoğan',
        'Orhan Gencebay',
        'Pinhani',
        'Çelik',
        'Cem Karaca',
        'Duman',
      ]),
      [
        'Cem Karaca',
        'Çelik',
        'Duman',
        'Hande Yener',
        'Kıraç',
        'Kibariye',
        'Orhan Gencebay',
        'Özdemir Erdoğan',
        'Pinhani',
        'Sezen Aksu',
        'Şebnem Ferah',
        'Tarkan',
      ]
    );
  });

  it('takes no notice of case', () => {
    // By code point every capital comes before every small letter, which
    // files `adamlar` after `Zakkum`.
    assert.deepEqual(
      byArtist([
        'Zakkum',
        'adamlar',
        'BÜYÜK EV ABLUKADA',
        'Athena',
      ]),
      ['adamlar', 'Athena', 'BÜYÜK EV ABLUKADA', 'Zakkum']
    );
  });

  it('puts digits before letters, and reads them a character at a time', () => {
    assert.deepEqual(
      byArtist([
        'Adamlar',
        '9 Lazy 9',
        'maNga',
        '10cc',
        '2Pac',
      ]),
      // `10cc` before `2Pac`: a name is not a number, and nobody looks for
      // one by its size.
      ['10cc', '2Pac', '9 Lazy 9', 'Adamlar', 'maNga']
    );
  });

  it('puts records nobody can be named for first, by their own names', () => {
    assert.deepEqual(
      filed([
        ['Athena', 'Holigan'],
        [null, 'Şarkılar'],
        ['10cc', 'Bloody Tourists'],
        [null, 'Sampler'],
      ]),
      [
        [null, 'Sampler'],
        [null, 'Şarkılar'],
        ['10cc', 'Bloody Tourists'],
        ['Athena', 'Holigan'],
      ]
    );
  });

  it('comes out the same whatever order the tracks arrived in', () => {
    const records: [string | null, string][] = [
      ['Duman', 'Darmaduman'],
      ['duman', 'Belki'],
      [null, 'İz'],
      [null, 'iz bırak'],
      ['Çelik', 'Ateşteyim'],
    ];
    assert.deepEqual(filed([...records].reverse()), filed(records));
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

  it('reads unnumbered filenames in the library\'s alphabet, without regard to case', () => {
    const ordered = orderWithin([
      song('1', { title: 'd', filename: 'şarkı.mp3' }),
      song('2', { title: 'c', filename: 'Sarkı.mp3' }),
      song('3', { title: 'b', filename: 'ışık.mp3' }),
      song('4', { title: 'a', filename: 'Zil.mp3' }),
      song('5', { title: 'e', filename: '02 ara.mp3' }),
    ]);

    assert.deepEqual(names(ordered), ['e', 'b', 'c', 'd', 'a']);
  });

  it('breaks a tie for one position by title', () => {
    const ordered = orderWithin([
      song('1', { title: 'Şimdi', trackNumber: 1 }),
      song('2', { title: 'sonra', trackNumber: 1 }),
      song('3', { title: 'Önce', trackNumber: 1 }),
    ]);

    assert.deepEqual(names(ordered), ['Önce', 'sonra', 'Şimdi']);
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
