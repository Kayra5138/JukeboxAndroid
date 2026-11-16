import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { songFinder, type LibrarySong } from '../../history/import.ts';
import { readSpotifyLists } from '../spotify.ts';

const track = (trackName: string, artistName: string, albumName: string) => ({
  track: { trackName, artistName, albumName, trackUri: 'spotify:track:0' },
  episode: null,
  localTrack: null,
  audiobook: null,
  addedDate: '2024-04-30',
});

const playlists = JSON.stringify({
  playlists: [
    {
      name: 'Road',
      lastModifiedDate: '2024-05-01',
      items: [
        track('Numb', 'Linkin Park', 'Meteora'),
        { track: null, episode: { episodeName: 'A talk', showName: 'A show' }, localTrack: null, addedDate: '2024-04-30' },
        { track: null, episode: null, localTrack: { uri: 'spotify:local:Sezen+Aksu:Gülümse:Hadi+Bakal%C4%B1m:254' }, addedDate: '2024-04-30' },
        track('Paranoid Android - Remastered 2017', 'Radiohead', 'OK Computer OKNOTOK 1997 2017'),
      ],
      description: null,
      numberOfFollowers: 0,
    },
    { name: 'Podcasts only', lastModifiedDate: '2024-05-01', items: [{ track: null, episode: { episodeName: 'One' }, localTrack: null }] },
    { name: 'Empty', lastModifiedDate: '2024-05-01', items: [] },
  ],
});

describe('Spotify’s playlists', () => {
  it('reads each playlist’s songs in order, a file of the phone’s own by its address, and leaves episodes out', () => {
    const read = readSpotifyLists(playlists)!;
    assert.equal(read.liked, null);
    assert.equal(read.lists.length, 1, 'a playlist with no songs in it is not brought');
    const [road] = read.lists;
    assert.equal(road!.name, 'Road');
    assert.deepEqual(road!.items, [
      { title: 'Numb', artist: 'Linkin Park', album: 'Meteora' },
      { title: 'Hadi Bakalım', artist: 'Sezen Aksu', album: 'Gülümse' },
      { title: 'Paranoid Android - Remastered 2017', artist: 'Radiohead', album: 'OK Computer OKNOTOK 1997 2017' },
    ]);
  });

  it('reads the songs saved with the heart from the library file', () => {
    const library = JSON.stringify({
      tracks: [{ artist: 'Linkin Park', album: 'Meteora', track: 'Numb', uri: 'spotify:track:0' }],
      albums: [],
      shows: [],
      episodes: [],
      artists: [],
    });
    assert.deepEqual(readSpotifyLists(library), { lists: [], liked: [{ title: 'Numb', artist: 'Linkin Park', album: 'Meteora' }] });
  });

  it('says a file is not Spotify’s when it is something else', () => {
    assert.equal(readSpotifyLists('#EXTM3U\nsong.mp3\n'), null);
    assert.equal(readSpotifyLists('[{"endTime": "2023-04-01 13:52"}]'), null);
    assert.equal(readSpotifyLists('{"settings": true}'), null);
    assert.equal(readSpotifyLists('{"playlists": '), null);
  });

  it('finds a playlist’s songs in the library by name, a remaster as the song it is', () => {
    const song = (id: string, title: string, artist: string, album: string | null = null): LibrarySong => ({
      id,
      title,
      artist,
      album,
      durationSec: 200,
      filename: null,
    });
    const find = songFinder([song('1', 'Numb', 'Linkin Park', 'Meteora'), song('2', 'Paranoid Android', 'Radiohead'), song('3', 'Hadi Bakalım', 'Sezen Aksu')]);
    const found = readSpotifyLists(playlists)!.lists[0]!.items.map((item) => find(item)?.id ?? null);
    assert.deepEqual(found, ['1', '3', '2']);
  });
});
