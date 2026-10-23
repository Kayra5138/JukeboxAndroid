import assert from 'node:assert/strict';
import { test } from 'node:test';

import { similarSourceFrom, TAP_MODES, tapModeFrom, tapQueue } from '../tap.ts';

const list = ['a', 'b', 'c', 'd', 'e'];
/** A shuffle that is only a reversal, so that what it was handed can be seen. */
const reverse = (rest: string[]) => [...rest].reverse();

test('the list plays from the row tapped, as it always did', () => {
  assert.deepEqual(tapQueue('list', list, 2, reverse), { tracks: list, start: 2, similar: false });
});

test('shuffled is the row tapped first, then every other row of the list laid out by the shuffle', () => {
  assert.deepEqual(tapQueue('shuffled', list, 2, reverse), { tracks: ['c', 'e', 'd', 'b', 'a'], start: 0, similar: false });
  assert.deepEqual(tapQueue('shuffled', ['a'], 0, reverse), { tracks: ['a'], start: 0, similar: false });
});

test('similar is the track alone, marked to be kept going; only is the track alone', () => {
  assert.deepEqual(tapQueue('similar', list, 4, reverse), { tracks: ['e'], start: 0, similar: true });
  assert.deepEqual(tapQueue('only', list, 0, reverse), { tracks: ['a'], start: 0, similar: false });
});

test('a row that is not there plays the list from its start', () => {
  for (const mode of TAP_MODES) {
    assert.deepEqual(tapQueue(mode, list, 9, reverse), { tracks: list, start: 0, similar: false });
  }
});

test('the list is never changed by being played', () => {
  const kept = [...list];
  tapQueue('shuffled', list, 1, (rest) => rest.reverse());
  assert.deepEqual(list, kept);
});

test('the setting reads anything it does not know as the list', () => {
  assert.equal(tapModeFrom('similar'), 'similar');
  assert.equal(tapModeFrom('only'), 'only');
  assert.equal(tapModeFrom(null), 'list');
  assert.equal(tapModeFrom('radio'), 'list');
});

test('similar songs come from the library unless something else was chosen for them', () => {
  assert.equal(similarSourceFrom(null), 'library');
  assert.equal(similarSourceFrom('off'), 'library');
  assert.equal(similarSourceFrom('fresh'), 'fresh');
  assert.equal(similarSourceFrom('mixed'), 'mixed');
});
