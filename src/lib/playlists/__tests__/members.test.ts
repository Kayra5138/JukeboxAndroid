import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moveOnto, present } from '../members.ts';

describe('present', () => {
  it('keeps the list order and leaves out what the library does not hold', () => {
    const library = new Set(['a', 'c', 'd']);
    assert.deepEqual(present(['d', 'b', 'a', 'c'], (id) => library.has(id)), ['d', 'a', 'c']);
  });

  it('is empty, not an error, when nothing is here', () => {
    assert.deepEqual(present(['a', 'b'], () => false), []);
  });
});

describe('moveOnto', () => {
  it('moves down past the target', () => {
    assert.deepEqual(moveOnto(['a', 'b', 'c', 'd'], 'a', 'c'), ['b', 'c', 'a', 'd']);
  });

  it('moves up ahead of the target', () => {
    assert.deepEqual(moveOnto(['a', 'b', 'c', 'd'], 'd', 'b'), ['a', 'd', 'b', 'c']);
  });

  it('shows the same order as the drag did when members are hidden', () => {
    // `x` and `y` are in the list and not in the library. On screen the list
    // is a b c, and the drag put a where c was: b c a.
    const stored = ['x', 'a', 'b', 'y', 'c'];
    const library = new Set(['a', 'b', 'c']);
    const after = moveOnto(stored, 'a', 'c');

    assert.ok(after);
    assert.deepEqual(present(after, (id) => library.has(id)), ['b', 'c', 'a']);
  });

  it('keeps every member, hidden ones included', () => {
    const stored = ['x', 'a', 'b', 'y', 'c'];
    const after = moveOnto(stored, 'c', 'a');

    assert.ok(after);
    assert.deepEqual([...after].sort(), [...stored].sort());
    assert.deepEqual(after, ['x', 'c', 'a', 'b', 'y']);
  });

  it('has nothing to do for a track dropped where it was', () => {
    assert.equal(moveOnto(['a', 'b'], 'a', 'a'), null);
  });

  it('has nothing to do for a track the list does not hold', () => {
    assert.equal(moveOnto(['a', 'b'], 'z', 'a'), null);
    assert.equal(moveOnto(['a', 'b'], 'a', 'z'), null);
  });
});
