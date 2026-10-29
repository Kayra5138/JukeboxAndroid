import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clampTo, wholeIn } from '../range.ts';

describe('a number chosen from a range', () => {
  it('is any whole number from the least to the most, as it was stored or typed', () => {
    assert.equal(wholeIn(7, { min: 1, max: 10 }), 7);
    assert.equal(wholeIn('10', { min: 1, max: 10 }), 10);
    assert.equal(wholeIn('0', { min: 0, max: 30 }), 0);
  });

  it('is nothing outside it, in part, or not a number at all', () => {
    assert.equal(wholeIn(11, { min: 1, max: 10 }), null);
    assert.equal(wholeIn(2.5, { min: 1, max: 10 }), null);
    assert.equal(wholeIn('', { min: 0, max: 10 }), null);
    assert.equal(wholeIn('soon', { min: 0, max: 10 }), null);
    assert.equal(wholeIn(null, { min: 0, max: 10 }), null);
  });

  it('stops at either end when stepped past it', () => {
    assert.equal(clampTo(12, { min: 1, max: 10 }), 10);
    assert.equal(clampTo(-1, { min: 0, max: 10 }), 0);
  });
});
