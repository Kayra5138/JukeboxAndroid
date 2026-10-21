import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { albumKey, albumsOf, findAlbum, nameOfKey, narrowAlbums, orderWithin } from '../albums.ts';
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

describe('records told apart by their album artist', () => {
  const keys = (albums: { key: string }[]) => albums.map((album) => album.key).sort();

  it('keeps two records of one name apart when their tracks say who each is by', () => {
    const albums = albumsOf([
      song('1', { title: 'Bohemian Rhapsody', album: 'Greatest Hits', artist: 'Queen', albumArtist: 'Queen', folder: 'Music/Queen/' }),
      song('2', { title: 'Somebody to Love', album: 'Greatest Hits', artist: 'Queen', albumArtist: 'Queen', folder: 'Music/Queen/' }),
      song('3', { title: 'Waterloo', album: 'Greatest Hits', artist: 'ABBA', albumArtist: 'ABBA', folder: 'Music/ABBA/' }),
      song('4', { title: 'SOS', album: 'Greatest Hits', artist: 'ABBA', albumArtist: 'ABBA', folder: 'Music/ABBA/' }),
    ]);

    assert.equal(albums.length, 2);
    assert.deepEqual(keys(albums), ['greatest hits\u001fabba', 'greatest hits\u001fqueen']);
    assert.deepEqual(albums.map((album) => album.artist), ['ABBA', 'Queen']);
    assert.deepEqual(albums.map((album) => album.albumArtist), ['ABBA', 'Queen']);
  });

  it('does not split a record over a guest on one of its songs', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Infections', artist: 'Aurora', albumArtist: 'Aurora' }),
      song('2', { title: 'B', album: 'Infections', artist: 'Aurora & Someone', albumArtist: 'Aurora & Someone' }),
      song('3', { title: 'C', album: 'Infections', artist: 'Aurora feat. Other' }),
    ]);

    assert.equal(albums.length, 1);
    assert.equal(albums[0]!.tracks.length, 3);
    assert.equal(albums[0]!.artist, 'Aurora');
  });

  it('keeps a record of no album artist exactly as it was, key and all', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Ruins', artist: 'Aurora' }),
      song('2', { title: 'B', album: 'Ruins', artist: 'Aurora & Someone' }),
    ]);

    assert.equal(albums.length, 1);
    assert.equal(albums[0]!.key, 'ruins');
    assert.equal(albums[0]!.albumArtist, null);
    assert.equal(albums[0]!.artist, 'Aurora');
  });

  it('keeps a compilation by name, whatever its tracks call their own artists', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Now 50', artist: 'One', albumArtist: 'Various Artists' }),
      song('2', { title: 'B', album: 'Now 50', artist: 'Two', albumArtist: 'Various Artists' }),
      song('3', { title: 'C', album: 'Now 50', artist: 'Three' }),
    ]);

    assert.equal(albums.length, 1);
    assert.equal(albums[0]!.key, 'now 50');
    assert.equal(albums[0]!.compilation, true);
    assert.equal(albums[0]!.artist, 'Various Artists');
  });

  it('knows a compilation in the languages its tags are written in', () => {
    for (const many of ['Çeşitli Sanatçılar', 'Verschiedene Interpreten', 'ヴァリアス・アーティスト', 'VA']) {
      const [album] = albumsOf([
        song('1', { title: 'A', album: 'Hits', artist: 'One', albumArtist: many }),
        song('2', { title: 'B', album: 'Hits', artist: 'Two', albumArtist: many }),
      ]);
      assert.equal(album!.key, 'hits', many);
    }
  });

  it('keeps whole a compilation whose tagger put each singer down as the album artist', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Hits', artist: 'One', albumArtist: 'One', folder: 'Music/Hits/' }),
      song('2', { title: 'B', album: 'Hits', artist: 'Two', albumArtist: 'Two', folder: 'Music/Hits/' }),
      song('3', { title: 'C', album: 'Hits', artist: 'Three', albumArtist: 'Three', folder: 'Music/Hits/' }),
    ]);

    assert.equal(albums.length, 1);
    assert.equal(albums[0]!.key, 'hits');
    assert.equal(albums[0]!.artist, null);
  });

  it('sends a track naming no album artist to the record of its own artist', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Greatest Hits', artist: 'Queen', albumArtist: 'Queen' }),
      song('2', { title: 'B', album: 'Greatest Hits', artist: 'Queen' }),
      song('3', { title: 'C', album: 'Greatest Hits', artist: 'ABBA', albumArtist: 'ABBA' }),
      song('4', { title: 'D', album: 'Greatest Hits', artist: 'ABBA feat. Somebody' }),
    ]);

    const byKey = new Map(albums.map((album) => [album.key, names(album.tracks)]));
    assert.deepEqual(byKey.get('greatest hits\u001fqueen'), ['A', 'B']);
    assert.deepEqual(byKey.get('greatest hits\u001fabba'), ['C', 'D']);
  });

  it('sends one by somebody else to the record in its folder, and leaves it by name where nothing says', () => {
    const albums = albumsOf([
      song('1', { title: 'A', album: 'Live', artist: 'Queen', albumArtist: 'Queen', folder: 'Music/Queen/Live/' }),
      song('2', { title: 'B', album: 'Live', artist: 'Freddie Mercury', folder: 'Music/Queen/Live/' }),
      song('3', { title: 'C', album: 'Live', artist: 'ABBA', albumArtist: 'ABBA', folder: 'Music/ABBA/Live/' }),
      song('4', { title: 'D', album: 'Live', artist: 'Stranger', folder: 'Music/Elsewhere/' }),
    ]);

    const byKey = new Map(albums.map((album) => [album.key, names(album.tracks)]));
    assert.deepEqual(byKey.get('live\u001fqueen'), ['A', 'B']);
    assert.deepEqual(byKey.get('live\u001fabba'), ['C']);
    assert.deepEqual(byKey.get('live'), ['D']);
  });

  it('makes keys that are unique, and the same whatever order the tracks came in', () => {
    const tracks = [
      song('1', { title: 'A', album: 'X', artist: 'P', albumArtist: 'P', folder: 'a/' }),
      song('2', { title: 'B', album: 'X', artist: 'Q', albumArtist: 'Q', folder: 'b/' }),
      song('3', { title: 'C', album: 'X', artist: 'R', folder: 'c/' }),
    ];
    const once = albumsOf(tracks);
    const again = albumsOf([...tracks].reverse());
    assert.equal(new Set(once.map((album) => album.key)).size, once.length);
    assert.deepEqual(keys(once), keys(again));
  });
});

describe('opening a record by its key', () => {
  const library = [
    song('1', { title: 'A', album: 'Greatest Hits', artist: 'Queen', albumArtist: 'Queen', folder: 'q/' }),
    song('2', { title: 'B', album: 'Greatest Hits', artist: 'Queen', albumArtist: 'Queen', folder: 'q/' }),
    song('3', { title: 'C', album: 'Greatest Hits', artist: 'ABBA', albumArtist: 'ABBA', folder: 'a/' }),
  ];

  it('finds the record with the very key', () => {
    const albums = albumsOf(library);
    assert.equal(findAlbum(albums, albumKey('Greatest Hits', 'ABBA'))?.tracks.length, 1);
  });

  it('finds the record a track is on, from the name alone', () => {
    const albums = albumsOf(library);
    assert.equal(findAlbum(albums, albumKey('Greatest Hits'), '3')?.artist, 'ABBA');
  });

  it('finds the record most of a name is on for a key written before records had artists', () => {
    const albums = albumsOf(library);
    assert.equal(findAlbum(albums, 'greatest hits')?.artist, 'Queen');
    assert.equal(findAlbum(albums, 'nothing'), null);
    assert.equal(nameOfKey(albumKey('Greatest Hits', 'Queen')), 'greatest hits');
  });

  it('keys a record by its name alone when it is by many people or by nobody', () => {
    assert.equal(albumKey(' Ruins ', null), 'ruins');
    assert.equal(albumKey('Ruins', 'Various Artists'), 'ruins');
    assert.equal(albumKey('Ruins', 'Aurora & Someone'), 'ruins\u001faurora');
  });
});

describe('records narrowed by a search', () => {
  it('keeps each record the search touched, with only what it found and under the record’s own key', () => {
    const library = [
      song('1', { title: 'A', album: 'Live', artist: 'Queen', albumArtist: 'Queen', folder: 'q/' }),
      song('2', { title: 'B', album: 'Live', artist: 'Freddie Mercury', folder: 'q/' }),
      song('3', { title: 'C', album: 'Live', artist: 'ABBA', albumArtist: 'ABBA', folder: 'a/' }),
    ];
    const albums = albumsOf(library);
    // Only the untagged track matched: grouped alone it would be a record of
    // the name; narrowed, it is still on Queen's.
    const narrowed = narrowAlbums(albums, [library[1]!]);
    assert.deepEqual(narrowed.map((album) => [album.key, names(album.tracks)]), [['live\u001fqueen', ['B']]]);
    assert.equal(narrowAlbums(albums, library)[0], albums[0]);
  });
});
