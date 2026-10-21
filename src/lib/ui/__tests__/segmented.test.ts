import assert from 'node:assert/strict';
import { test } from 'node:test';

import { insideBorder, withPlace } from '../segmented.ts';

test('a place reported again where it was is no change', () => {
  const before = { a: { x: 2, y: 2, width: 40, height: 30 } };
  assert.equal(withPlace(before, 'a', { x: 2, y: 2, width: 40, height: 30 }), before);
});

test('a place that moved, or a choice not yet seen, is noted beside the rest', () => {
  const before = { a: { x: 2, y: 2, width: 40, height: 30 } };
  const moved = withPlace(before, 'a', { x: 2, y: 34, width: 40, height: 30 });
  assert.notEqual(moved, before);
  assert.deepEqual(moved.a, { x: 2, y: 34, width: 40, height: 30 });
  const added = withPlace(before, 'b', { x: 46, y: 2, width: 50, height: 30 });
  assert.deepEqual(Object.keys(added), ['a', 'b']);
  assert.deepEqual(before, { a: { x: 2, y: 2, width: 40, height: 30 } });
});

test('a place is taken back by the border of the row it is measured in', () => {
  assert.deepEqual(insideBorder({ x: 3, y: 3, width: 60, height: 44 }, 1), { x: 2, y: 2, width: 60, height: 44 });
  const place = { x: 3, y: 3, width: 60, height: 44 };
  assert.equal(insideBorder(place, 0), place);
  assert.equal(insideBorder(undefined, 1), null);
});
