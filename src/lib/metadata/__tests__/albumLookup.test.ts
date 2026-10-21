import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lookUpAlbum, placedOnRelease, type AlbumLookupDeps, type AlbumToLookUp } from '../albumLookup.ts';
import type { AlbumRest } from '../../album/rest.ts';
import type { TrackMetadata } from '../../db/metadata.ts';
import type { EnrichProgress } from '../pipeline.ts';
import { track } from '../../__tests__/support.ts';

const listed = (position: number, title: string, have: string | null, lengthSec: number | null = 200): AlbumRest['tracks'][number] => ({
  disc: 1, position, title, lengthSec, artist: null, have,
});

const REST: AlbumRest = {
  groupId: 'group',
  release: { id: 'release', title: 'A Night at the Opera', artist: 'Queen', year: 1975 },
  discs: 1,
  tracks: [
    listed(1, 'Death on Two Legs', '1'),
    listed(2, 'Lazing on a Sunday Afternoon', null, 68),
    listed(3, 'Bohemian Rhapsody', '3'),
  ],
  covered: 2,
  rivals: 0,
};

const ALBUM: AlbumToLookUp = {
  name: 'A Night at the Opera',
  artist: 'Queen',
  tracks: [
    track({ id: '1', title: 'death on two legs', artist: 'Queen', album: 'A Night at the Opera', trackNumber: 1 }),
    // Spelled by the file in a way no title comparison reads; its place and length say who it is.
    track({ id: '2', title: 'Track 02', artist: 'Queen', album: 'A Night at the Opera', trackNumber: 2, durationSec: 69 }),
    track({ id: '3', title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', trackNumber: 3 }),
    track({ id: '4', title: 'Bonus', artist: 'Queen', album: 'A Night at the Opera' }),
    track({ id: '5', title: 'Edited', artist: 'Queen', album: 'A Night at the Opera', trackNumber: 1 }),
  ],
};

function world(rows: TrackMetadata[] = [], options: { release?: AlbumRest | null; cover?: string | null } = {}) {
  const saved: TrackMetadata[] = [];
  const tags: [string, string[]][] = [];
  const chosen: { ids: string[]; uri: string; keep: string[] }[] = [];
  const forgotten: string[][] = [];
  const eachAsked: string[][] = [];
  const asked: string[] = [];
  const held = new Map(rows.map((row) => [row.trackId, row]));
  const deps: AlbumLookupDeps = {
    release: async () => {
      asked.push('release');
      const rest = options.release === undefined ? REST : options.release;
      return rest ? { ok: true, rest } : { ok: false, why: 'notFound' };
    },
    genres: async () => {
      asked.push('genres');
      return ['rock', 'art rock'];
    },
    cover: async () => {
      asked.push('cover');
      return options.cover === undefined ? 'https://is1-ssl.mzstatic.com/opera/600x600bb.jpg' : options.cover;
    },
    download: async () => 'file:///covers/opera.jpg',
    pictures: async (ids) => new Map(ids.map((id) => [id, false])),
    readAllMetadata: () => held,
    saveMetadata: (entry) => {
      saved.push(entry);
      held.set(entry.trackId, entry);
    },
    saveLookupTags: (id, list) => tags.push([id, list]),
    chooseCovers: (ids, uri, keep) => {
      chosen.push({ ids, uri, keep: [...keep] });
      return ids.filter((id) => !keep.has(id));
    },
    forgetMetadata: (ids) => forgotten.push(ids),
    lookUpEach: async (tracks, onProgress) => {
      eachAsked.push(tracks.map((entry) => entry.id));
      onProgress({ done: tracks.length, total: tracks.length, matched: 1, covers: 0, throttled: false });
      return { matched: 1, missed: tracks.length - 1, coversSaved: 0, cancelled: false };
    },
  };
  return { deps, saved, tags, chosen, forgotten, eachAsked, asked };
}

const manual = (trackId: string, changes: Partial<TrackMetadata> = {}): TrackMetadata => ({
  trackId, status: 'manual', source: 'manual', title: 'Edited', artist: null, album: null, genre: null,
  year: null, artworkUrl: null, trackNumber: null, discNumber: null, ...changes,
});

describe('finding the library’s tracks on the record', () => {
  it('takes what the titles said, then a place and a length that agree', () => {
    const placed = placedOnRelease(REST, ALBUM.tracks);
    assert.deepEqual([...placed.keys()].sort(), ['1', '2', '3']);
    assert.equal(placed.get('2')?.title, 'Lazing on a Sunday Afternoon');
  });

  it('does not take a place alone, nor a length that is out by more than a few seconds', () => {
    const placed = placedOnRelease(REST, [
      track({ id: '2', title: 'Track 02', trackNumber: 2, durationSec: 90 }),
      track({ id: '9', title: 'Track 02', trackNumber: 2, durationSec: 0 }),
    ]);
    assert.equal(placed.has('2') || placed.has('9'), false);
  });
});

describe('looking a record up as one', () => {
  it('fills what the record says for the tracks on it, gives them its cover, and asks about the rest one by one', async () => {
    const { deps, saved, tags, chosen, forgotten, eachAsked, asked } = world([manual('5')]);
    const seen: EnrichProgress[] = [];

    const result = await lookUpAlbum(ALBUM, (progress) => seen.push(progress), undefined, deps);

    // One question for the record, one for its genres, one for its cover.
    assert.deepEqual(asked, ['release', 'genres', 'cover']);
    assert.deepEqual(saved.map((row) => row.trackId), ['1', '2', '3']);
    assert.deepEqual(saved[1], {
      trackId: '2', status: 'matched', source: 'musicbrainz', title: 'Lazing on a Sunday Afternoon',
      artist: 'Queen', album: 'A Night at the Opera', albumArtist: 'Queen', genre: 'rock', year: 1975,
      artworkUrl: null, trackNumber: 2, discNumber: null,
    });
    assert.deepEqual(tags[0], ['1', ['rock', 'art rock']]);
    assert.deepEqual(chosen, [{ ids: ['1', '2', '3', '4', '5'], uri: 'file:///covers/opera.jpg', keep: [] }]);
    // The edited track is left alone; only the one the record did not list is asked about afresh.
    assert.deepEqual(forgotten, [['4']]);
    assert.deepEqual(eachAsked, [['4']]);
    assert.equal(result.matched, 4);
    assert.equal(result.coversSaved, 5);
    assert.equal(seen.at(-1)?.done, 5);
    assert.equal(seen.at(-1)?.total, 5);
  });

  it('keeps a cover chosen by hand, a cover taken off by hand, and a file’s own picture', async () => {
    const { deps, chosen } = world([
      manual('5', { artworkUrl: 'file:///covers/mine.jpg' }),
      manual('4', { coverRemovedAt: 3 }),
    ]);
    deps.pictures = async (ids) => new Map(ids.map((id) => [id, id === '3']));

    await lookUpAlbum(ALBUM, () => {}, undefined, deps);

    assert.deepEqual(chosen[0]?.keep.sort(), ['3', '4', '5']);
  });

  it('keeps the earlier year a track already had, and a cover it already had until the record’s comes', async () => {
    const { deps, saved } = world(
      [{ ...manual('1'), status: 'matched', source: 'musicbrainz', year: 1974, artworkUrl: 'file:///covers/old.jpg' }],
      { cover: null }
    );
    await lookUpAlbum(ALBUM, () => {}, undefined, deps);
    assert.equal(saved[0]?.year, 1974);
    assert.equal(saved[0]?.artworkUrl, 'file:///covers/old.jpg');
  });

  it('asks about every track one by one when the record is not in the catalogue', async () => {
    const { deps, saved, eachAsked } = world([], { release: null });
    await lookUpAlbum(ALBUM, () => {}, undefined, deps);
    assert.deepEqual(saved, []);
    assert.deepEqual(eachAsked, [['1', '2', '3', '4', '5']]);
  });

  it('stops where it is asked to, with what it did written', async () => {
    const stop = new AbortController();
    const { deps, saved, eachAsked } = world();
    deps.genres = async () => {
      stop.abort();
      return [];
    };
    const result = await lookUpAlbum(ALBUM, () => {}, stop.signal, deps);
    assert.equal(result.cancelled, true);
    assert.deepEqual(saved, []);
    assert.deepEqual(eachAsked, []);
  });
});

describe('a record nobody can say whose it is', () => {
  it('is not asked about by its name alone', async () => {
    const { deps, asked, eachAsked } = world([], { release: null });
    await lookUpAlbum({ ...ALBUM, artist: null }, () => {}, undefined, deps);
    assert.equal(asked.includes('cover'), false);
    assert.equal(eachAsked.length, 1);
  });
});
