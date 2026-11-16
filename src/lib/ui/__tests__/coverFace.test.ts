import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ARM, armTurn, FIRST_GROOVE, LAST_GROOVE, PIVOT_X, PIVOT_Y, woundTo } from '../coverFace.ts';

describe('a cassette’s reels', () => {
  it('are their hubs with no tape on them, and full with it all', () => {
    assert.equal(woundTo(0, 0.4), 0.4);
    assert.equal(woundTo(1, 0.4), 1);
  });

  it('go out as the root of the tape on them, so that half the tape is more than half the way out', () => {
    const half = woundTo(0.5, 0.4);
    assert.ok(half > 0.7, "past the middle between hub and full");
    assert.ok(Math.abs(half - Math.sqrt(0.58)) < 1e-9);
  });

  it('keep to their ends for a share past them, or none known', () => {
    assert.equal(woundTo(-1, 0.4), 0.4);
    assert.equal(woundTo(2, 0.4), 1);
    assert.equal(woundTo(Number.NaN, 0.4), 0.4);
  });
});

describe('a record’s arm', () => {
  const needle = (turn: number, size: number) => {
    const angle = (turn * Math.PI) / 180;
    return Math.hypot(size * PIVOT_X - Math.sin(angle) * size * ARM - size / 2, size * PIVOT_Y + Math.cos(angle) * size * ARM - size / 2);
  };

  it('stands the needle where it is asked to, from the first groove to the last', () => {
    for (const from of [FIRST_GROOVE, 0.35, LAST_GROOVE]) {
      assert.ok(Math.abs(needle(armTurn(from * 300, 300), 300) - from * 300) < 0.5);
    }
  });

  it('turns further in as the side goes on', () => {
    assert.ok(armTurn(LAST_GROOVE * 300, 300) > armTurn(FIRST_GROOVE * 300, 300));
  });
});
