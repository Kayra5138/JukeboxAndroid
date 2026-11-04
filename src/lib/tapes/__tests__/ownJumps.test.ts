import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { jumpsFor, ownJumpsFrom, withOwnJump } from '../ownJumps.ts';

const range = { min: 1, max: 120 };
const general = { back: 15, forward: 30 };

describe('the jumps of a book or a show', () => {
  it('are the general ones for one given none of its own', () => {
    assert.deepEqual(jumpsFor({}, 'Music/Tapes/Dune', general, range), { ...general, ownBack: false, ownForward: false });
  });

  it('are its own where it was given them, each by itself', () => {
    const own = { 'Music/Tapes/Dune': { back: 10, forward: 60 }, 'Music/Tapes/Show': { forward: 45 } };
    assert.deepEqual(jumpsFor(own, 'Music/Tapes/Dune', general, range), { back: 10, forward: 60, ownBack: true, ownForward: true });
    assert.deepEqual(jumpsFor(own, 'Music/Tapes/Show', general, range), { back: 15, forward: 45, ownBack: false, ownForward: true });
  });

  it('pass over a figure that makes no sense', () => {
    const own = ownJumpsFrom('{"k":{"back":0,"forward":"far"}}');
    assert.deepEqual(jumpsFor(own, 'k', general, range), { ...general, ownBack: false, ownForward: false });
  });

  it('are read from nothing, or from what is not a map, as none', () => {
    assert.deepEqual(ownJumpsFrom(null), {});
    assert.deepEqual(ownJumpsFrom(''), {});
    assert.deepEqual(ownJumpsFrom('not json'), {});
    assert.deepEqual(ownJumpsFrom('[1,2]'), {});
  });

  it('are set one at a time, and given back to the general ones one at a time', () => {
    let own = withOwnJump({}, 'k', 'back', 20);
    assert.deepEqual(own, { k: { back: 20 } });
    own = withOwnJump(own, 'k', 'forward', 90);
    assert.deepEqual(own, { k: { back: 20, forward: 90 } });
    own = withOwnJump(own, 'k', 'back', null);
    assert.deepEqual(own, { k: { forward: 90 } });
    // With neither of its own left, the book is gone from the map.
    own = withOwnJump(own, 'k', 'forward', null);
    assert.deepEqual(own, {});
  });

  it('leave the other books alone', () => {
    const before = { a: { back: 5 } };
    const after = withOwnJump(before, 'b', 'forward', 40);
    assert.deepEqual(after, { a: { back: 5 }, b: { forward: 40 } });
    assert.deepEqual(before, { a: { back: 5 } });
  });
});
