import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AGAIN,
  drawBatch,
  scoreLibrary,
  seedsOf,
  type Candidate,
  type Context,
} from '../autoplay/library.ts';

const song = (id: string, more: Partial<Candidate> = {}): Candidate => ({
  id,
  lead: '',
  names: [],
  albumArtist: '',
  tags: [],
  genre: null,
  year: null,
  ...more,
});
const by = (artist: string, more: Partial<Candidate> = {}) => ({ lead: artist, names: [artist], ...more });

const context = (more: Partial<Context> = {}): Context => ({
  idf: new Map(),
  together: () => undefined,
  near: new Map(),
  skipRate: new Map(),
  ...more,
});

const ids = (scored: { candidate: Candidate }[]) => scored.map((entry) => entry.candidate.id);

describe('scoreLibrary', () => {
  it('counts a rare tag for far more than a common one', () => {
    const seed = song('seed', { tags: ['rock', 'shoegaze'] });
    const idf = new Map([['rock', 0.1], ['shoegaze', 3]]);
    const scored = scoreLibrary(
      [song('common', { tags: ['rock'] }), song('rare', { tags: ['shoegaze'] }), song('nothing', { tags: ['jazz'] })],
      [{ candidate: seed, weight: 1 }],
      context({ idf }),
      new Set()
    );
    assert.deepEqual(ids(scored), ['rare', 'common']);
  });

  it('puts the same artist ahead of a shared guest, and both ahead of nothing', () => {
    const seed = song('seed', by('portishead', { names: ['portishead', 'tricky'] }));
    const scored = scoreLibrary(
      [song('same', by('portishead')), song('guest', by('massive attack', { names: ['massive attack', 'tricky'] })), song('none', by('abba'))],
      [{ candidate: seed, weight: 1 }],
      context(),
      new Set()
    );
    assert.deepEqual(ids(scored), ['same', 'guest']);
  });

  it('hears what is played together, and what Discover says is near', () => {
    const seed = song('seed', by('a'));
    const scored = scoreLibrary(
      [song('paired', by('x')), song('neighbour', by('b')), song('stranger', by('c'))],
      [{ candidate: seed, weight: 1 }],
      context({
        together: (id) => (id === 'seed' ? new Map([['paired', 3]]) : undefined),
        near: new Map([['a', new Map([['b', 0.8]])]]),
      }),
      new Set()
    );
    assert.deepEqual(ids(scored), ['paired', 'neighbour']);
  });

  it('weighs the seeds: the song playing counts for more than the one before it', () => {
    const scored = scoreLibrary(
      [song('likeNow', by('now')), song('likeBefore', by('before'))],
      [{ candidate: song('s1', by('now')), weight: 1 }, { candidate: song('s2', by('before')), weight: 0.6 }],
      context(),
      new Set()
    );
    assert.deepEqual(ids(scored), ['likeNow', 'likeBefore']);
  });

  it('leaves out what is excluded, and marks down what is skipped and what was in the last batch', () => {
    const seed = song('seed', by('a'));
    const all = [song('kept', by('a')), song('skipped', by('a')), song('again', by('a')), song('queued', by('a'))];
    const scored = scoreLibrary(
      all,
      [{ candidate: seed, weight: 1 }],
      context({ skipRate: new Map([['skipped', 1]]) }),
      new Set(['queued', 'seed']),
      new Set(['again'])
    );
    assert.deepEqual(ids(scored), ['kept', 'skipped', 'again']);
    const score = (id: string) => scored.find((entry) => entry.candidate.id === id)!.score;
    assert.ok(Math.abs(score('again') - score('kept') * AGAIN) < 1e-9);
  });

  it('falls back on genre and years for a library with nothing better', () => {
    const seed = song('seed', { genre: 'trip hop', year: 1994 });
    const scored = scoreLibrary(
      [song('genre', { genre: 'trip hop' }), song('era', { year: 1996 }), song('neither', { genre: 'polka', year: 1970 })],
      [{ candidate: seed, weight: 1 }],
      context(),
      new Set()
    );
    assert.deepEqual(ids(scored), ['genre', 'era']);
  });
});

/** A run of numbers that is the same every time. */
function steady(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('drawBatch', () => {
  const field = Array.from({ length: 40 }, (_, n) =>
    ({ candidate: song(`t${n}`, by(`artist${n % 5}`)), score: 40 - n })
  );

  it('never puts one artist after themself, counting the song before the batch', () => {
    const batch = drawBatch(field, 8, 'artist0', steady());
    assert.equal(batch.length, 8);
    assert.notEqual(batch[0]!.lead, 'artist0');
    batch.forEach((pick, at) => {
      if (at > 0) assert.notEqual(pick.lead, batch[at - 1]!.lead);
    });
  });

  it('holds any one artist to a quarter of the batch', () => {
    const batch = drawBatch(field, 8, null, steady(7));
    const counts = new Map<string, number>();
    for (const pick of batch) counts.set(pick.lead, (counts.get(pick.lead) ?? 0) + 1);
    for (const count of counts.values()) assert.ok(count <= 2);
  });

  it('draws only from the best thirty', () => {
    const batch = drawBatch(field, 8, null, steady(3));
    for (const pick of batch) assert.ok(Number(pick.id.slice(1)) < 30);
  });

  it('comes out short rather than breaking the rules', () => {
    const one = Array.from({ length: 10 }, (_, n) => ({ candidate: song(`s${n}`, by('only')), score: 1 }));
    assert.equal(drawBatch(one, 8, null, steady()).length, 1);
  });

  it('is not the same batch twice running once the last one is marked down', () => {
    const seed = song('seed', by('a'));
    const library = Array.from({ length: 30 }, (_, n) => song(`x${n}`, by(`artist${n % 6}`, { tags: ['dream pop'] })));
    const ctx = context({ idf: new Map([['dream pop', 1]]) });
    const seeds = [{ candidate: { ...seed, tags: ['dream pop'] }, weight: 1 }];
    const first = drawBatch(scoreLibrary(library, seeds, ctx, new Set()), 8, null, steady(11));
    const second = drawBatch(scoreLibrary(library, seeds, ctx, new Set(), new Set(first.map((pick) => pick.id))), 8, null, steady(11));
    assert.notDeepEqual(new Set(second.map((pick) => pick.id)), new Set(first.map((pick) => pick.id)));
  });
});

describe('seedsOf', () => {
  const queue = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));

  it('counts the song playing most, the two before it less, and the ones still to come a little', () => {
    assert.deepEqual(
      seedsOf(queue, 3).map(({ track, weight }) => [track.id, weight]),
      [['d', 1], ['c', 0.6], ['b', 0.35], ['e', 0.4], ['f', 0.4]]
    );
  });

  it('counts a song queued twice once', () => {
    const twice = [{ id: 'a' }, { id: 'b' }, { id: 'a' }];
    assert.deepEqual(seedsOf(twice, 2).map(({ track }) => track.id), ['a', 'b']);
  });
});
