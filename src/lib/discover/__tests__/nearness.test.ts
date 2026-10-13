import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { readArtists } from '../deezer.ts';
import { readPopularity } from '../listenbrainz.ts';
import { ALPHA, filedNear, listenedNear, NEIGHBOURS_KEPT, sharePlaces, together, USERS_FLOOR, WITNESS } from '../nearness.ts';
import * as built from './built.ts';

type Rows = { artist_mbid: string; name: string; score: number }[];
const rows = (mbid: string) =>
  ((built.similar[mbid] ?? []) as Rows).map((row) => ({ mbid: row.artist_mbid, name: row.name, score: row.score }));
const users = readPopularity(built.popularity);
const AURORA = rows(built.IDS.AURORA!);

describe('how near ListenBrainz says an artist is, with fame taken out', () => {
  it('puts the artists everybody plays below the ones this artist’s listeners play', () => {
    // As it came: the most played names there are.
    const raw = [...AURORA].sort((left, right) => right.score - left.score).slice(0, 3).map((row) => row.name);
    assert.deepEqual(raw, ['Billie Eilish', 'Lana Del Rey', 'Lorde']);
    const near = listenedNear(AURORA, users, 'any').map((row) => row.name);
    assert.equal(near[0], 'Pomme');
    for (const name of ['BROODS', 'Oh Wonder']) assert.ok(near.indexOf(name) >= 0 && near.indexOf(name) < 10, name);
    // Coldplay shared eight hundred sittings with her, and so it has with everybody.
    assert.ok(near.indexOf('Coldplay') === -1 || near.indexOf('Coldplay') > near.indexOf('BROODS'));
  });

  it('counts the nearest as one and the rest as shares of it', () => {
    const near = listenedNear(AURORA, users, 'any');
    assert.equal(near[0]!.near, 1);
    assert.ok(near.every((row, index) => row.near > 0 && row.near <= 1 && (index === 0 || row.near <= near[index - 1]!.near)));
    assert.ok(near.length <= NEIGHBOURS_KEPT);
  });

  it('leans to known names or away from them by what somebody chose', () => {
    const place = (popularity: 'known' | 'any' | 'deep', name: string) =>
      listenedNear(AURORA, users, popularity).findIndex((row) => row.name === name);
    assert.ok(ALPHA.known < ALPHA.any && ALPHA.any < ALPHA.deep);
    // Billie Eilish is the raw nearest; the further fame is taken out, the further down she goes.
    assert.ok(place('known', 'Billie Eilish') <= place('any', 'Billie Eilish'));
    assert.ok(place('any', 'Billie Eilish') < place('deep', 'Billie Eilish'));
  });

  it('leaves out a coincidence, and an artist too few people play to divide by', () => {
    const made = [
      { mbid: 'a', name: 'Near', score: 100 },
      { mbid: 'b', name: 'Once or twice', score: 11 },
      { mbid: 'c', name: 'Three people', score: 60 },
      { mbid: 'd', name: 'A producer', score: 90 },
    ];
    const heard = new Map([['a', 5000], ['b', 5000], ['c', USERS_FLOOR - 1]]);
    assert.deepEqual(listenedNear(made, heard, 'any').map((row) => row.name), ['Near']);
  });

  it('falls back on the raw order when nobody could say how many people play whom', () => {
    const blind = listenedNear(AURORA, new Map(), 'any');
    assert.equal(blind[0]!.name, 'Billie Eilish');
    assert.equal(blind[0]!.near, 1);
  });

  it('makes nothing of nothing', () => {
    assert.deepEqual(listenedNear([], users, 'any'), []);
  });
});

describe('how near Deezer says an artist is', () => {
  it('goes by the order they are filed in, a twentieth a place', () => {
    const filed = filedNear(readArtists(built.related['7699874']));
    assert.equal(filed[0]!.artist.name, 'Paris Paloma');
    assert.equal(filed[0]!.near, 1);
    assert.ok(Math.abs(filed[1]!.near - 0.95) < 1e-9);
    assert.ok(filed.length <= 20 && filed.at(-1)!.near > 0);
  });
});

describe('what two witnesses say together', () => {
  it('believes either alone as far as eight tenths, and both more than either', () => {
    assert.ok(Math.abs(together(1, 0) - WITNESS) < 1e-9);
    assert.ok(Math.abs(together(0, 1) - WITNESS) < 1e-9);
    assert.ok(Math.abs(together(1, 1) - 0.96) < 1e-9);
    assert.equal(together(0, 0), 0);
    assert.ok(together(0.9, 0.2) > together(0.9, 0));
  });
});

describe('sharing places out by weight', () => {
  it('gives the heaviest most, in whole places that add up', () => {
    assert.deepEqual(sharePlaces([1, 0.72, 0.69, 0.57, 0.54, 0.47], 10), [3, 2, 2, 1, 1, 1]);
    assert.deepEqual(sharePlaces([1, 0.45, 0.37, 0.36, 0.34, 0.3], 10), [4, 2, 1, 1, 1, 1]);
    assert.deepEqual(sharePlaces([1, 0.69, 0.47], 5), [2, 2, 1]);
    assert.deepEqual(sharePlaces([1], 7), [7]);
  });

  it('gives nothing to nobody, and nothing where there is nothing to give', () => {
    assert.deepEqual(sharePlaces([1, 0], 3), [3, 0]);
    assert.deepEqual(sharePlaces([0, 0], 3), [0, 0]);
    assert.deepEqual(sharePlaces([1, 1], 0), [0, 0]);
    assert.deepEqual(sharePlaces([], 4), []);
  });
});
