import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  indexAfterInsert,
  indexAfterMove,
  indexAfterRemove,
  insertPlan,
  playNextPosition,
  rowShift,
} from '../queue.ts';

describe('rowShift', () => {
  it('leaves the dragged row alone', () => {
    assert.equal(rowShift(2, 2, 5), 0);
  });

  it('pulls the rows a downward drag passes up one place', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => rowShift(i, 1, 3)), [0, 0, -1, -1, 0]);
  });

  it('pushes the rows an upward drag passes down one place', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map((i) => rowShift(i, 3, 1)), [0, 1, 1, 0, 0]);
  });

  it('shifts nothing when the row is dropped where it started', () => {
    assert.deepEqual([0, 1, 2].map((i) => rowShift(i, 1, 1)), [0, 0, 0]);
  });
});

describe('indexAfterMove', () => {
  it('follows the row that was dragged', () => {
    assert.equal(indexAfterMove(1, 1, 4), 4);
  });

  it('steps back when a row is lifted from above and dropped below', () => {
    assert.equal(indexAfterMove(3, 1, 5), 2);
  });

  it('steps forward when a row is lifted from below and dropped above', () => {
    assert.equal(indexAfterMove(3, 5, 1), 4);
  });

  it('stays put when the move happens entirely elsewhere', () => {
    assert.equal(indexAfterMove(0, 3, 5), 0);
    assert.equal(indexAfterMove(6, 3, 5), 6);
  });

  it('agrees with actually reordering the list', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    for (let from = 0; from < list.length; from += 1) {
      for (let to = 0; to < list.length; to += 1) {
        const moved = [...list];
        const [row] = moved.splice(from, 1);
        moved.splice(to, 0, row!);
        for (let current = 0; current < list.length; current += 1) {
          assert.equal(
            moved[indexAfterMove(current, from, to)],
            list[current],
            `from ${from} to ${to}, watching ${list[current]}`
          );
        }
      }
    }
  });
});

describe('indexAfterInsert', () => {
  it('steps forward when the new row lands at or above it', () => {
    assert.equal(indexAfterInsert(2, 0), 3);
    assert.equal(indexAfterInsert(2, 2), 3);
  });

  it('stays put when the new row lands below it', () => {
    assert.equal(indexAfterInsert(2, 3), 2);
  });
});

describe('indexAfterRemove', () => {
  it('steps back when a row above it goes', () => {
    assert.equal(indexAfterRemove(3, 0), 2);
    assert.equal(indexAfterRemove(3, 2), 2);
  });

  it('stays put when a row below it goes', () => {
    assert.equal(indexAfterRemove(3, 4), 3);
  });

  it('stays put when it is the row that goes, where its successor now sits', () => {
    assert.equal(indexAfterRemove(3, 3), 3);
  });

  it('agrees with actually removing from the list', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    for (let at = 0; at < list.length; at += 1) {
      const shorter = list.filter((_row, index) => index !== at);
      for (let current = 0; current < list.length; current += 1) {
        if (current === at) continue;
        assert.equal(
          shorter[indexAfterRemove(current, at)],
          list[current],
          `removing ${at}, watching ${list[current]}`
        );
      }
    }
  });
});

describe('playNextPosition', () => {
  it('goes straight after the row playing now', () => {
    assert.equal(playNextPosition(0), 1);
    assert.equal(playNextPosition(4), 5);
  });

  it('falls back on the end of the queue when no row is playing', () => {
    // Which is where `insertPlan` reads a negative position as, so the track
    // lands behind the queue rather than in front of it.
    assert.equal(playNextPosition(-1), -1);
    assert.deepEqual(insertPlan(3, playNextPosition(-1)), { replace: false, index: 3 });
  });

  it('still replaces an empty queue', () => {
    assert.deepEqual(insertPlan(0, playNextPosition(-1)), { replace: true });
  });
});

describe('insertPlan', () => {
  it('replaces the queue rather than adding to an empty one', () => {
    // Adding to an unprepared player produces no audio and no current track,
    // so "play next" and "add to queue" appeared to do nothing at all.
    assert.deepEqual(insertPlan(0, -1), { replace: true });
    assert.deepEqual(insertPlan(0, 0), { replace: true });
    assert.deepEqual(insertPlan(0, 5), { replace: true });
  });

  it('appends when asked for the end', () => {
    assert.deepEqual(insertPlan(3, -1), { replace: false, index: 3 });
  });

  it('inserts where it was asked to', () => {
    assert.deepEqual(insertPlan(3, 1), { replace: false, index: 1 });
  });

  it('clamps a position past the end of the queue', () => {
    // `playNext` asks for the position after the current one, and the current
    // one can be the last.
    assert.deepEqual(insertPlan(3, 9), { replace: false, index: 3 });
  });
});
