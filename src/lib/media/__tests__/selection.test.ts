import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { holdsAll, markOf, tracksUnder, withGroupToggled } from '../selection.ts';

const group = (...ids: string[]) => ids.map((id) => ({ id }));

describe('markOf', () => {
  it('says none, some or all of a heading\'s tracks are chosen', () => {
    const tracks = group('1', '2', '3');
    assert.equal(markOf(tracks, new Set()), false);
    assert.equal(markOf(tracks, new Set(['9'])), false);
    assert.equal(markOf(tracks, new Set(['2'])), 'mixed');
    assert.equal(markOf(tracks, new Set(['1', '2', '3', '9'])), true);
  });

  it('never calls a heading with nothing under it chosen', () => {
    assert.equal(markOf([], new Set(['1'])), false);
  });
});

describe('withGroupToggled', () => {
  it('chooses every track of a heading none of which was chosen', () => {
    assert.deepEqual([...withGroupToggled(new Set(['9']), group('1', '2'))].sort(), ['1', '2', '9']);
  });

  it('finishes a heading that was partly chosen rather than emptying it', () => {
    assert.deepEqual([...withGroupToggled(new Set(['1']), group('1', '2'))].sort(), ['1', '2']);
  });

  it('lets go of all of them when all were held, and of nothing else', () => {
    assert.deepEqual([...withGroupToggled(new Set(['1', '2', '9']), group('1', '2'))], ['9']);
  });

  it('leaves the set it was given alone', () => {
    const before = new Set(['1']);
    withGroupToggled(before, group('1', '2'));
    assert.deepEqual([...before], ['1']);
  });

  it('leaves an artist who shares a track with the one chosen partly chosen', () => {
    const eminem = group('monster', 'stan');
    const rihanna = group('monster', 'umbrella');
    const selected = withGroupToggled(new Set(), eminem);
    assert.equal(markOf(eminem, selected), true);
    assert.equal(markOf(rihanna, selected), 'mixed');
  });
});

describe('tracksUnder and holdsAll', () => {
  const shown = tracksUnder([{ tracks: group('1', '2') }, { tracks: group('2', '3') }]);

  it('counts a track under two headings once', () => {
    assert.deepEqual([...shown].sort(), ['1', '2', '3']);
  });

  it('knows when everything shown is chosen, whatever else is', () => {
    assert.equal(holdsAll(new Set(['1', '2']), shown), false);
    assert.equal(holdsAll(new Set(['1', '2', '3', '9']), shown), true);
    assert.equal(holdsAll(new Set(['1', '2', '8', '9']), shown), false);
  });

  it('is never true of an empty list', () => {
    assert.equal(holdsAll(new Set(), new Set()), false);
  });
});
