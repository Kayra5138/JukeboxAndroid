import assert from 'node:assert/strict';
import { test } from 'node:test';

import { byRecent, recentFrom, usedNow } from '../recent.ts';

test('the list just used goes first, the others after it in the order they were used', () => {
  assert.deepEqual(usedNow([3, 1, 2], 2), [2, 3, 1]);
  assert.deepEqual(usedNow([], 5), [5]);
  const lists = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  assert.deepEqual(byRecent(lists, [3, 1]).map((list) => list.id), [3, 1, 2, 4]);
});

test('a setting that cannot be read is no lists used yet', () => {
  assert.deepEqual(recentFrom(null), []);
  assert.deepEqual(recentFrom('nonsense'), []);
  assert.deepEqual(recentFrom('[2, "x", 3.5, 4]'), [2, 4]);
});
