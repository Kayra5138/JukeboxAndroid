import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lookupTrack, searchAlbumCover } from '../itunes.ts';
import { stubFetch, track, withoutWaiting } from './support.ts';

const entry = (collectionName: string, picture: string) => ({
  trackName: 'Akuma no Ko',
  artistName: 'Ai Higuchi',
  collectionName,
  primaryGenreName: 'J-Pop',
  releaseDate: '2022-01-10T00:00:00Z',
  artworkUrl100: `https://is1-ssl.mzstatic.com/${picture}/100x100bb.jpg`,
});

describe('itunes lookupTrack', () => {
  it('takes the entry on the album the track names over the same song sold elsewhere', async () => {
    // One song, three times in the shop, each with its own cover. The file
    // says which record it is from, and that is the cover its neighbours get.
    stubFetch(() => ({
      body: {
        results: [
          entry('Akuma no Ko - Single', 'single'),
          entry('Saiaku Saiai', 'album'),
          entry('Anime Hits 2022', 'compilation'),
        ],
      },
    }));

    const found = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Ai Higuchi', title: 'Akuma no Ko', album: 'saiaku saiai' }))
    );

    assert.equal(found?.album, 'Saiaku Saiai');
    assert.equal(found?.artworkUrl, 'https://is1-ssl.mzstatic.com/album/600x600bb.jpg');
  });

  it('takes the first good entry as before when the track names no album, or one the shop lacks', async () => {
    stubFetch(() => ({
      body: { results: [entry('Akuma no Ko - Single', 'single'), entry('Saiaku Saiai', 'album')] },
    }));

    const bare = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Ai Higuchi', title: 'Akuma no Ko' }))
    );
    const elsewhere = await withoutWaiting(() =>
      lookupTrack(track({ artist: 'Ai Higuchi', title: 'Akuma no Ko', album: 'A Mixtape Of Mine' }))
    );

    assert.equal(bare?.album, 'Akuma no Ko - Single');
    assert.equal(elsewhere?.album, 'Akuma no Ko - Single');
  });
});

describe('itunes searchAlbumCover', () => {
  const record = (collectionName: string, artistName: string, picture: string, trackCount = 12) => ({
    collectionName,
    artistName,
    trackCount,
    artworkUrl100: `https://is1-ssl.mzstatic.com/${picture}/100x100bb.jpg`,
  });

  it('takes the record of that name by that artist, the exact name first', async () => {
    stubFetch(() => ({
      body: {
        results: [
          record('Greatest Hits', 'ABBA', 'abba'),
          record('Greatest Hits (Remastered)', 'Queen', 'remaster'),
          record('Greatest Hits', 'Queen', 'queen'),
        ],
      },
    }));
    const found = await withoutWaiting(() => searchAlbumCover('Greatest Hits', 'Queen', 17));
    assert.equal(found, 'https://is1-ssl.mzstatic.com/queen/600x600bb.jpg');
  });

  it('takes any artist for a compilation, and nothing for a record of another name', async () => {
    stubFetch(() => ({ body: { results: [record('Now 50', 'Various Artists', 'now')] } }));
    assert.equal(
      await withoutWaiting(() => searchAlbumCover('Now 50', 'Çeşitli Sanatçılar', 40)),
      'https://is1-ssl.mzstatic.com/now/600x600bb.jpg'
    );
    stubFetch(() => ({ body: { results: [record('Now 51', 'Various Artists', 'now')] } }));
    assert.equal(await withoutWaiting(() => searchAlbumCover('Now 50', 'Various Artists', 40)), null);
  });
});
