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

  it('finds a Japanese title credited in Latin letters by the artist’s Latin name elsewhere', async () => {
    const japan = { trackId: 7, trackName: 'スカイクラッドの観測者', artistName: 'いとうかなこ', collectionName: 'Single' };
    const cover = { trackId: 8, trackName: 'スカイクラッドの観測者', artistName: 'Roselia', collectionName: 'Covers' };
    const asked = stubFetch((url) => {
      if (url.includes('/lookup')) {
        return { body: { results: [{ trackId: 8, trackName: 'Skyclad No Kansokusha', artistName: 'Roselia' }, { trackId: 7, trackName: 'Skyclad No Kansokusha', artistName: 'ITO KANAKO' }] } };
      }
      // Only a search by the title alone in Japan's store finds it: the artist is not written as asked anywhere.
      if (url.includes('country=JP') && !url.includes('Ito')) return { body: { results: [cover, japan] } };
      return { body: { results: [] } };
    });

    const found = await withoutWaiting(() => lookupTrack(track({ artist: 'Ito kanako', title: 'スカイクラッドの観測者' })));

    assert.equal(found?.artist, 'いとうかなこ');
    assert.equal(found?.latinTitle, 'Skyclad No Kansokusha');
    assert.equal(found?.latinArtist, 'ITO KANAKO');
    assert.equal(found?.nativeTitle, 'スカイクラッドの観測者');
    assert.ok(asked.some((url) => url.includes('lookup?id=8,7') || url.includes('lookup?id=7,8')));
  });

  it('takes a one-word artist only as one of the names credited, whole', async () => {
    const entry = (artistName: string) => ({ trackId: 1, trackName: 'Bloody Stream', artistName });
    stubFetch(() => ({ body: { results: [entry('Coda Piano Trio')] } }));
    assert.equal(await withoutWaiting(() => lookupTrack(track({ artist: 'Coda', title: 'Bloody Stream' }))), null);
    stubFetch(() => ({ body: { results: [entry('Coda & Saori Kodama')] } }));
    const found = await withoutWaiting(() => lookupTrack(track({ artist: 'Coda', title: 'Bloody Stream' })));
    assert.equal(found?.artist, 'Coda & Saori Kodama');
  });

  it('accepts a romanised artist spaced another way', async () => {
    stubFetch(() => ({ body: { results: [{ trackId: 1, trackName: 'Boku no Sensou', artistName: 'Shinsei kamattechan' }] } }));
    const found = await withoutWaiting(() => lookupTrack(track({ artist: 'SHINSEI KAMATTE CHAN', title: 'Boku no Sensou' })));
    assert.equal(found?.artist, 'Shinsei kamattechan');
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
