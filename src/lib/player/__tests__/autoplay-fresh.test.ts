import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chooseFresh, freshTrouble, nearness, type FreshItem, type FreshSeed, type FreshSong } from '../autoplay/fresh.ts';
import { artistNearness, listenedTogether, skipRates } from '../autoplay/listening.ts';
import type { Track } from '../../types.ts';

const fold = (name: string) => name.trim().toLowerCase();

const tune = (n: number, artist: string, more: Partial<FreshSong> = {}): FreshSong => ({
  recordingMbid: `rec-${n}`,
  title: `Song ${n}`,
  artist,
  artistMbid: `artist-${artist}`,
  because: '',
  ...more,
});
const file = (n: number): Track => ({ id: `discover:job-${n}`, uri: '', title: `Song ${n}`, artist: null, album: null, artworkUri: null, durationSec: 200, trackNumber: null, filename: null, folder: null, addedAt: null });
const item = (song: FreshSong, more: Partial<FreshItem> = {}): FreshItem => ({ song, track: null, heard: false, lost: false, ...more });

const seed: FreshSeed[] = [{ names: ['beach house'], tags: ['dream pop'], weight: 1 }];

describe('nearness', () => {
  it('ranks the same artist, then one Discover came to from that artist, then a shared tag', () => {
    const same = nearness(tune(1, 'Beach House'), seed, fold);
    const led = nearness(tune(2, 'Alvvays', { why: { seeds: ['Beach House'], similarity: 0.9 } }), seed, fold);
    const tagged = nearness(tune(3, 'Slowdive', { tags: ['dream pop'] }), seed, fold);
    const none = nearness(tune(4, 'ABBA', { tags: ['disco'] }), seed, fold);
    assert.ok(same > led && led > tagged && tagged > 0);
    assert.equal(none, 0);
  });

  it('reads the old one-line reason of a song kept from before', () => {
    assert.ok(nearness(tune(5, 'Alvvays', { because: 'Beach House · Slowdive' }), seed, fold) > 0);
  });
});

describe('chooseFresh', () => {
  it('plays what is ready, the nearest first and the rest after', () => {
    const items = [
      item(tune(1, 'ABBA'), { track: file(1) }),
      item(tune(2, 'Beach House'), { track: file(2) }),
      item(tune(3, 'Alvvays', { why: { seeds: ['Beach House'], similarity: 0.5 } }), { track: file(3) }),
    ];
    const choice = chooseFresh(items, [], seed, new Set(), new Set(), fold);
    assert.deepEqual(choice.ready.map((track) => track.id), ['discover:job-2', 'discover:job-3', 'discover:job-1']);
  });

  it('never offers a song already heard, already queued, played lately, or lost', () => {
    const items = [
      item(tune(1, 'Beach House'), { track: file(1), heard: true }),
      item(tune(2, 'Beach House'), { track: file(2) }),
      item(tune(3, 'Beach House'), { track: file(3) }),
      item(tune(4, 'Beach House'), { lost: true }),
      item(tune(5, 'Beach House'), { track: file(5) }),
    ];
    const choice = chooseFresh(items, [], seed, new Set(['discover:job-2']), new Set(['discover:job-3']), fold);
    assert.deepEqual(choice.ready.map((track) => track.id), ['discover:job-5']);
    assert.deepEqual(choice.call, []);
  });

  it('asks for near songs that are not ready, the list’s before the pool’s, and only near ones', () => {
    const items = [item(tune(1, 'Beach House')), item(tune(2, 'ABBA'))];
    const pool = [tune(1, 'Beach House'), tune(3, 'Beach House'), tune(4, 'Polka Band'), tune(5, 'Alvvays', { why: { seeds: ['Beach House'], similarity: 1 } })];
    const choice = chooseFresh(items, pool, seed, new Set(), new Set(), fold);
    assert.deepEqual(choice.call.map((song) => song.recordingMbid), ['rec-1', 'rec-3', 'rec-5']);
    assert.equal(choice.near, 3);
  });

  it('says when nothing at all is near, so that Discover can be asked to look around', () => {
    const choice = chooseFresh([item(tune(1, 'ABBA'), { track: file(1) })], [tune(2, 'Polka Band')], seed, new Set(), new Set(), fold);
    assert.equal(choice.near, 0);
    assert.equal(choice.ready.length, 1);
  });
});

describe('freshTrouble', () => {
  it('says why nothing new can be fetched now', () => {
    assert.equal(freshTrouble({ usable: false, network: null, wifiOnly: true }), 'unavailable');
    assert.equal(freshTrouble({ usable: true, network: { connected: false, wifi: false }, wifiOnly: false }), 'offline');
    assert.equal(freshTrouble({ usable: true, network: { connected: true, wifi: false }, wifiOnly: true }), 'wifi');
    assert.equal(freshTrouble({ usable: true, network: { connected: true, wifi: false }, wifiOnly: false }), null);
    assert.equal(freshTrouble({ usable: true, network: null, wifiOnly: true }), null);
  });
});

describe('listenedTogether', () => {
  it('pairs songs played one after the other in a sitting, both ways round', () => {
    const rows = [
      { track_id: 'b', started_at: 200_000, seconds_played: 100 },
      { track_id: 'a', started_at: 0, seconds_played: 180 },
      // The same song again is not a pairing.
      { track_id: 'b', started_at: 310_000, seconds_played: 100 },
      // Next morning: another sitting.
      { track_id: 'c', started_at: 50_000_000, seconds_played: 100 },
    ];
    const together = listenedTogether(rows);
    assert.equal(together.get('a')?.get('b'), 1);
    assert.equal(together.get('b')?.get('a'), 1);
    assert.equal(together.get('b')?.get('c'), undefined);
    assert.equal(together.get('b')?.get('b'), undefined);
  });
});

describe('skipRates', () => {
  it('says nothing below three endings, and the share walked out on above', () => {
    const rates = skipRates(new Map([['a', 1], ['b', 3]]), new Map([['a', 1], ['b', 1], ['c', 3]]));
    assert.equal(rates.get('a'), undefined);
    assert.equal(rates.get('b'), 0.25);
    assert.equal(rates.get('c'), 1);
  });
});

describe('artistNearness', () => {
  it('reads which artists Discover found near which, both ways, keeping the nearest', () => {
    const near = artistNearness(
      [
        { artist: 'Alvvays', why: { kind: 'near', seeds: ['Beach House'], similarity: 0.4 } },
        { artist: 'Alvvays', why: { kind: 'near', seeds: ['Beach House'], similarity: 0.9 } },
        { artist: 'Slowdive', why: { kind: 'yours', seeds: ['Slowdive'], via: ['Beach House'], similarity: null } },
        { artist: 'Nobody' },
      ],
      fold
    );
    assert.equal(near.get('beach house')?.get('alvvays'), 0.9);
    assert.equal(near.get('alvvays')?.get('beach house'), 0.9);
    assert.equal(near.get('slowdive')?.get('beach house'), 0.5);
  });
});
