import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  artistsOf,
  asArtistSort,
  nextArtistSort,
  sortArtists,
  UNKNOWN_ARTIST,
  type NamesOn,
} from '../artists.ts';
import type { EnrichedTrack } from '../enriched.ts';
import { stringsFor } from '../../i18n/languages.ts';
import { guestsNamedIn, splitCredit } from '../../metadata/credit.ts';
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

/** What `creditReader` hands out, with no catalogue having said anything. */
const namesOn: NamesOn = (listen) => [
  ...splitCredit(listen.artist),
  ...guestsNamedIn(listen.title),
];

const names = (artists: { name: string }[]) => artists.map((artist) => artist.name);
const ids = (tracks: EnrichedTrack[]) => tracks.map((entry) => entry.id);

describe('artistsOf', () => {
  it('puts a song by two artists under both of them', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'Lose Yourself', artist: 'Eminem' }),
        song('2', { title: 'The Monster', artist: 'Eminem, Rihanna' }),
        song('3', { title: 'Umbrella', artist: 'Rihanna' }),
      ],
      namesOn
    );

    assert.deepEqual(names(artists), ['Eminem', 'Rihanna']);
    assert.deepEqual(ids(artists[0].tracks), ['1', '2']);
    assert.deepEqual(ids(artists[1].tracks), ['2', '3']);
  });

  it('counts a guest named in the title, as the stats do', () => {
    const artists = artistsOf(
      [song('1', { title: 'Love the Way You Lie (feat. Rihanna)', artist: 'Eminem' })],
      namesOn
    );

    assert.deepEqual(names(artists), ['Eminem', 'Rihanna']);
  });

  it('counts a track once for an artist named in both places', () => {
    const artists = artistsOf(
      [song('1', { title: 'Stan (feat. Dido)', artist: 'Eminem feat. Dido' })],
      namesOn
    );

    assert.deepEqual(names(artists), ['Dido', 'Eminem']);
    assert.deepEqual(ids(artists[0].tracks), ['1']);
  });

  it('keeps a name whole that only looks like several', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'September', artist: 'Earth, Wind & Fire' }),
        song('2', { title: 'The Boxer', artist: 'Simon & Garfunkel' }),
      ],
      namesOn
    );

    assert.deepEqual(names(artists), ['Earth, Wind & Fire', 'Simon & Garfunkel']);
  });

  it('takes the word of whatever reading it is handed', () => {
    // A catalogue having said that this credit is one artist, which no rule
    // about ampersands could have known.
    const told: NamesOn = (listen) =>
      splitCredit(listen.artist, (credit) => (credit === 'Lena Raine & Minecraft' ? true : undefined));
    const artists = artistsOf([song('1', { title: 'Pigstep', artist: 'Lena Raine & Minecraft' })], told);

    assert.deepEqual(names(artists), ['Lena Raine & Minecraft']);
  });

  it('treats two spellings as one artist, and shows the commoner', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'A', artist: 'aurora' }),
        song('2', { title: 'B', artist: 'AURORA' }),
        song('3', { title: 'C', artist: 'AURORA' }),
      ],
      namesOn
    );

    assert.equal(artists.length, 1);
    assert.equal(artists[0].name, 'AURORA');
    assert.equal(artists[0].tracks.length, 3);
  });

  it('shows the first spelling met where none is commoner', () => {
    const artists = artistsOf(
      [song('1', { title: 'A', artist: 'Tarkan' }), song('2', { title: 'B', artist: 'TARKAN' })],
      namesOn
    );

    assert.equal(artists[0].name, 'Tarkan');
  });

  it('orders by name the way the library does, not the way the phone would', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'A', artist: 'Şebnem Ferah' }),
        song('2', { title: 'B', artist: 'Sezen Aksu' }),
        song('3', { title: 'C', artist: 'Tarkan' }),
        song('4', { title: 'D', artist: 'İlhan İrem' }),
        song('5', { title: 'E', artist: 'Özdemir Erdoğan' }),
        song('6', { title: 'F', artist: 'athena' }),
        song('7', { title: 'G', artist: 'Orhan Gencebay' }),
      ],
      namesOn
    );

    assert.deepEqual(names(artists), [
      'athena',
      'İlhan İrem',
      'Orhan Gencebay',
      'Özdemir Erdoğan',
      'Sezen Aksu',
      'Şebnem Ferah',
      'Tarkan',
    ]);
  });

  it('keeps tracks that name nobody, under one heading at the end', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'Untitled', artist: null }),
        song('2', { title: 'Zebra', artist: 'Zz Top' }),
        song('3', { title: 'Blank', artist: '   ' }),
      ],
      namesOn
    );

    assert.deepEqual(names(artists), ['Zz Top', 'Unknown artist']);
    assert.equal(artists[1].key, UNKNOWN_ARTIST);
    assert.deepEqual(ids(artists[1].tracks), ['3', '1']);
  });

  it('calls that heading what the language in use calls it, and keeps it where it was', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'Untitled', artist: null }),
        song('2', { title: 'Zebra', artist: 'Zz Top' }),
      ],
      namesOn,
      stringsFor('tr')
    );

    assert.deepEqual(names(artists), ['Zz Top', 'Bilinmeyen sanatçı']);
    // The name is all that changed: a screen opened with the key still finds it.
    assert.equal(artists[1].key, UNKNOWN_ARTIST);
  });

  it('lists an artist\'s tracks by title', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'Öp', artist: 'Tarkan' }),
        song('2', { title: 'Kuzu Kuzu', artist: 'Tarkan' }),
        song('3', { title: 'Ölürüm Sana', artist: 'Tarkan' }),
      ],
      namesOn
    );

    assert.deepEqual(ids(artists[0].tracks), ['2', '3', '1']);
  });

  it('counts the records their tracks are on, and only their part of each', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'A', artist: 'Eminem', album: 'Recovery' }),
        song('2', { title: 'B', artist: 'Eminem, Rihanna', album: 'Recovery' }),
        song('3', { title: 'C', artist: 'Rihanna', album: 'Loud' }),
        song('4', { title: 'D', artist: 'Eminem', album: null }),
      ],
      namesOn
    );
    const [eminem, rihanna] = artists;

    assert.deepEqual(eminem.albums.map((album) => album.name), ['Recovery']);
    assert.deepEqual(rihanna.albums.map((album) => album.name), ['Loud', 'Recovery']);
    assert.deepEqual(ids(rihanna.albums[1].tracks), ['2']);
  });

  it('borrows a cover from a record where there is one, and from any track otherwise', () => {
    const artists = artistsOf(
      [
        song('1', { title: 'Alone', artist: 'One' }),
        song('2', { title: 'On a record', artist: 'One', album: 'Ruins', trackNumber: 1 }),
        song('3', { title: 'Loose', artist: 'Two' }),
      ],
      namesOn
    );

    assert.equal(artists[0].cover?.id, '2');
    assert.equal(artists[1].cover?.id, '3');
  });

  it('has nothing to say about an empty library', () => {
    assert.deepEqual(artistsOf([], namesOn), []);
  });
});

describe('sortArtists', () => {
  const library = artistsOf(
    [
      song('1', { title: 'Kuzu Kuzu', artist: 'Tarkan', addedAt: 100 }),
      song('2', { title: 'Dudu', artist: 'Tarkan', addedAt: 300 }),
      song('3', { title: 'Şımarık', artist: 'Tarkan', addedAt: 200 }),
      song('4', { title: 'Runaway', artist: 'Aurora', addedAt: 900 }),
      song('5', { title: 'Çakkıdı', artist: 'Çelik', addedAt: null }),
      song('6', { title: 'Hop', artist: 'Çelik', addedAt: null }),
      song('7', { title: 'Untitled', artist: null, addedAt: 950 }),
      song('8', { title: 'Untitled 2', artist: null, addedAt: 960 }),
      song('9', { title: 'Untitled 3', artist: null, addedAt: 970 }),
      song('10', { title: 'Untitled 4', artist: null, addedAt: 980 }),
    ],
    namesOn
  );
  const nothing = new Map<string, number>();

  it('goes by name in the alphabet the rest of the library uses, nobody last', () => {
    assert.deepEqual(names(sortArtists(library, 'name', nothing)), [
      'Aurora',
      'Çelik',
      'Tarkan',
      'Unknown artist',
    ]);
  });

  it('puts whoever has the most tracks first, and settles a draw by name', () => {
    assert.deepEqual(names(sortArtists(library, 'tracks', nothing)), [
      'Tarkan',
      'Çelik',
      'Aurora',
      'Unknown artist',
    ]);
  });

  it('adds up the listens to every track of theirs', () => {
    const plays = new Map([
      ['1', 2],
      ['2', 2],
      ['4', 3],
      ['7', 50],
    ]);
    assert.deepEqual(names(sortArtists(library, 'played', plays)), [
      'Tarkan',
      'Aurora',
      'Çelik',
      'Unknown artist',
    ]);
  });

  it('dates an artist by the newest of their tracks, the undated after the dated', () => {
    assert.deepEqual(names(sortArtists(library, 'added', nothing)), [
      'Aurora',
      'Tarkan',
      'Çelik',
      'Unknown artist',
    ]);
  });

  it('keeps the heading for nobody last however large it is', () => {
    for (const order of ['name', 'tracks', 'played', 'added'] as const) {
      assert.equal(sortArtists(library, order, nothing).at(-1)?.key, UNKNOWN_ARTIST);
    }
  });

  it('counts a shared track for both of the artists it is under', () => {
    const shared = artistsOf(
      [
        song('1', { title: 'The Monster', artist: 'Eminem, Rihanna' }),
        song('2', { title: 'Umbrella', artist: 'Rihanna' }),
        song('3', { title: 'Stan', artist: 'Eminem' }),
        song('4', { title: 'Mockingbird', artist: 'Eminem' }),
      ],
      namesOn
    );
    const plays = new Map([
      ['1', 5],
      ['2', 4],
    ]);
    assert.deepEqual(names(sortArtists(shared, 'played', plays)), ['Rihanna', 'Eminem']);
    assert.deepEqual(names(sortArtists(shared, 'tracks', plays)), ['Eminem', 'Rihanna']);
  });

  it('hands back a copy', () => {
    const before = names(library);
    sortArtists(library, 'tracks', nothing);
    assert.deepEqual(names(library), before);
  });

  it('reads an unknown stored order as by name, and steps round all four', () => {
    assert.equal(asArtistSort(null), 'name');
    assert.equal(asArtistSort('size'), 'name');
    assert.equal(asArtistSort('played'), 'played');
    assert.equal(nextArtistSort('name'), 'tracks');
    assert.equal(nextArtistSort('added'), 'name');
  });
});
