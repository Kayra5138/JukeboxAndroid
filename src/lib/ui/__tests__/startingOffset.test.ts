import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { startingOffset } from '../startingOffset.ts';

describe('where a list starts', () => {
  it('stays what it was while the list stands, wherever the list has got to', () => {
    const first = startingOffset(null, 1, false, () => 120);
    const later = startingOffset(first, 1, true, () => 900);
    assert.equal(later, first);
    assert.equal(later.offset.y, 120);
  });

  it('is read again for a list built anew by its key', () => {
    const first = startingOffset(null, 1, true, () => 120);
    assert.equal(startingOffset(first, 2, true, () => 900).offset.y, 900);
  });

  it('is read again for a list that was taken down', () => {
    const first = startingOffset(null, 1, true, () => 120);
    assert.equal(startingOffset(first, 1, false, () => 900).offset.y, 900);
  });
});
