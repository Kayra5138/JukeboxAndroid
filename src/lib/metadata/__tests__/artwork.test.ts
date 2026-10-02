import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fillArtwork } from '../artwork.ts';
import { track } from './support.ts';
import type { TrackMetadata } from '../../db/metadata.ts';

const row = (changes: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId: 'track-1', status: 'matched', source: 'musicbrainz', title: 'Song',
  artist: 'Artist', album: null, genre: 'rock', year: 2020, artworkUrl: null,
  trackNumber: null, discNumber: null, ...changes,
});

describe('album cover backfill', () => {
  it('finds artwork for existing MusicBrainz results using resolved credits', async () => {
    const saved: unknown[] = [];
    const count = await fillArtwork([track({ title: 'filename' })], {
      metadata: new Map([['track-1', row()]]),
      lookup: async (song) => {
        assert.equal(song.title, 'Song'); assert.equal(song.artist, 'Artist');
        return { artworkUrl: 'https://is1-ssl.mzstatic.com/cover.jpg', album: 'Album' };
      },
      download: async () => 'file:///cover.jpg',
      save: (...args) => { saved.push(args); },
    }, () => {});
    assert.equal(count, 1);
    assert.deepEqual(saved, [['track-1', 'file:///cover.jpg', 'Album']]);
  });

  it('downloads an existing remote cover without searching again', async () => {
    await fillArtwork([track({ title: 'Song' })], {
      metadata: new Map([['track-1', row({ artworkUrl: 'https://cover' })]]),
      lookup: async () => { throw new Error('Must not search'); },
      download: async (url) => { assert.equal(url, 'https://cover'); return 'file:///cover'; },
      save: (_id, uri) => assert.equal(uri, 'file:///cover'),
    }, () => {});
  });

  it('leaves already-local artwork alone', async () => {
    const count = await fillArtwork([track({ title: 'Song' })], {
      metadata: new Map([['track-1', row({ artworkUrl: 'file:///cover.jpg' })]]),
      lookup: async () => { assert.fail('Already stored'); },
      download: async () => { assert.fail('Already stored'); },
      save: () => assert.fail('Already stored'),
    }, () => {});
    assert.equal(count, 0);
  });

  it('does not publish after cancellation during an image download', async () => {
    const controller = new AbortController();
    const count = await fillArtwork([track({ title: 'Song' })], {
      metadata: new Map([['track-1', row({ artworkUrl: 'https://cover' })]]),
      lookup: async () => null,
      download: async () => { controller.abort(); return 'file:///cover'; },
      save: () => assert.fail('Cancelled'),
    }, () => {}, controller.signal);
    assert.equal(count, 0);
  });

  it('a failed cover cannot overwrite metadata or mark a track as not found', async () => {
    const metadata = row({ status: 'manual' });
    const before = { ...metadata };
    const count = await fillArtwork([track({ title: 'Song' })], {
      metadata: new Map([['track-1', metadata]]),
      lookup: async () => ({ artworkUrl: 'https://cover', album: 'Wrong album' }),
      download: async () => { throw new Error('Image unavailable'); },
      save: () => assert.fail('No cover downloaded'),
    }, () => {});
    assert.equal(count, 0);
    assert.deepEqual(metadata, before);
  });
});
