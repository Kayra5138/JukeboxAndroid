import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { ownedArtists, rankSuggestions, weighSeeds, type Suggested } from '../rank.ts';

const candidate = (name: string, score = 100) => ({ mbid: `mbid:${name}`, name, score });

const from = (seed: string, names: string[], weight = 1): Suggested => ({
  seed,
  weight,
  candidates: names.map((name) => candidate(name)),
});

describe('ranking what to go and listen to', () => {
  it('puts what two seeds agree on above what one seed loved', () => {
    const ranked = rankSuggestions(
      [from('A', ['Shared', 'Only A']), from('B', ['Only B', 'Shared'])],
      new Set(),
      10
    );
    assert.equal(ranked[0]!.name, 'Shared');
    // And says so: both are worth naming, strongest first.
    assert.deepEqual(ranked[0]!.because, ['A', 'B']);
  });

  it('leaves out anything already in the library', () => {
    const ranked = rankSuggestions([from('A', ['Owned', 'New'])], new Set(['owned']), 10);
    assert.deepEqual(ranked.map((entry) => entry.name), ['New']);
  });

  it('matches an owned artist through a different spelling', () => {
    // The whole reason the comparison is on the fold: these are one artist.
    const owned = ownedArtists([{ artist: 'Sigur Ros' }]);
    const ranked = rankSuggestions([from('A', ['Sigur Rós'])], owned, 10);
    assert.deepEqual(ranked, []);
  });

  /*
    The two below name their candidates against the alphabet on purpose. Ties
    fall back to the name, so a case whose expected order happens to be
    alphabetical would pass with the scoring taken out altogether and prove
    nothing about it.
  */
  it('lets a heavier seed outrank a lighter one at the same position', () => {
    const ranked = rankSuggestions(
      [from('Played a lot', ['Zed'], 1), from('Played once', ['Abel'], 0.2)],
      new Set(),
      10
    );
    assert.deepEqual(ranked.map((entry) => entry.name), ['Zed', 'Abel']);
  });

  it('counts a lower-placed suggestion for less than a higher one', () => {
    const ranked = rankSuggestions([from('A', ['Zed', 'Mona', 'Abel'])], new Set(), 10);
    assert.deepEqual(ranked.map((entry) => entry.name), ['Zed', 'Mona', 'Abel']);
  });

  it('keeps only as many as asked for', () => {
    assert.equal(rankSuggestions([from('A', ['a', 'b', 'c', 'd'])], new Set(), 2).length, 2);
  });

  it('ignores a candidate with nothing to identify or call it', () => {
    const ranked = rankSuggestions(
      [{ seed: 'A', weight: 1, candidates: [
        { mbid: '', name: 'No id', score: 1 },
        { mbid: 'x', name: '  ', score: 1 },
        { mbid: 'y', name: 'Fine', score: 1 },
      ] }],
      new Set(),
      10
    );
    assert.deepEqual(ranked.map((entry) => entry.name), ['Fine']);
  });
});

describe('what the library already holds', () => {
  it('skips tracks with no artist rather than owning the empty name', () => {
    const owned = ownedArtists([{ artist: null }, { artist: '' }, { artist: 'Real' }]);
    assert.deepEqual([...owned], ['real']);
  });
});

describe('how much each seed counts', () => {
  it('gives the most listened to the full say', () => {
    const [top] = weighSeeds([{ totalSeconds: 400 }, { totalSeconds: 100 }]);
    assert.equal(top!.weight, 1);
  });

  it('flattens the gap rather than carrying it through', () => {
    // A quarter of the listening, but not a quarter of the say -- otherwise
    // one favourite decides the page on its own.
    const [, second] = weighSeeds([{ totalSeconds: 400 }, { totalSeconds: 100 }]);
    assert.equal(second!.weight, 0.5);
  });

  it('treats them all alike when nothing has been listened to', () => {
    const weighed = weighSeeds([{ totalSeconds: 0 }, { totalSeconds: 0 }]);
    assert.deepEqual(weighed.map((seed) => seed.weight), [1, 1]);
  });
});
