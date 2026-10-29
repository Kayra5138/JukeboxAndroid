import assert from 'node:assert/strict';
import { test } from 'node:test';

import { optionsFit, transportFit } from '../optionsFit.ts';

test('a row that fits is drawn as it always was', () => {
  assert.deepEqual(optionsFit(344, 6, 21), { size: 44, gap: 8, icon: 21, rows: 1 });
  assert.deepEqual(optionsFit(0, 6, 21), { size: 44, gap: 8, icon: 21, rows: 1 });
});

test('a narrower row closes up, then draws smaller, before it would ever wrap', () => {
  assert.equal(optionsFit(290, 6, 21).gap, 4);
  assert.deepEqual(optionsFit(264, 6, 21), { size: 44, gap: 0, icon: 21, rows: 1 });
  assert.deepEqual(optionsFit(240, 6, 21), { size: 40, gap: 0, icon: 19, rows: 1 });
  assert.deepEqual(optionsFit(216, 6, 21), { size: 36, gap: 0, icon: 17, rows: 1 });
});

test('only where even the smallest will not do is it two lines', () => {
  assert.equal(optionsFit(200, 6, 21).rows, 2);
});

test('the transport closes its gaps, then draws smaller, rather than being cut off at the ends', () => {
  assert.deepEqual(transportFit(344, 300, 18, 1), { gap: 18, scale: 1 });
  assert.deepEqual(transportFit(280, 300, 18, 1), { gap: 13, scale: 1 });
  assert.deepEqual(transportFit(200, 300, 18, 1), { gap: 0, scale: 1 });
  assert.deepEqual(transportFit(200, 228, 0, 1), { gap: 0, scale: 0.87 });
  assert.deepEqual(transportFit(100, 228, 0, 1), { gap: 0, scale: 0.6 });
  assert.deepEqual(transportFit(0, 300, 18, 1), { gap: 18, scale: 1 });
});
