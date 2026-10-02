import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nextPosition } from '../tagPositions.ts';

/**
 * The ordering rule rather than the statements that apply it: `tags.ts` reaches
 * the database through `db()`, and importing that pulls in expo-sqlite, which
 * only resolves inside the app. What is worth checking is the arithmetic, and
 * it is here for that reason — the SQL around it does nothing but write the
 * number down.
 */
describe('nextPosition', () => {
  it('starts a track with no tags at the front', () => {
    assert.equal(nextPosition([]), 0);
  });

  it('goes on the end of a list that was never disturbed', () => {
    assert.equal(nextPosition([0, 1, 2]), 3);
  });

  it('clears a gappy list rather than landing in it', () => {
    // What a track looks like once a lookup has deleted the rows between two
    // tags the user kept. Counting them gives 2, which is both in the middle
    // of the list and, four tags later, on top of the one at 5.
    assert.equal(nextPosition([0, 5]), 6);
  });

  it('does not care what order it is handed them in', () => {
    assert.equal(nextPosition([5, 0, 3]), 6);
  });

  it('gives every tag of a run its own position', () => {
    // A lookup answers with several tags at once, and each is written at the
    // position after the last, so the run has to stay clear of the list it
    // started above as well as of itself.
    const taken = [0, 5];
    let position = nextPosition(taken);
    for (const _tag of ['gothic', 'metal', 'japanese']) {
      assert.ok(!taken.includes(position), `${position} is already taken`);
      taken.push(position);
      position += 1;
    }

    assert.deepEqual(taken, [0, 5, 6, 7, 8]);
    assert.equal(new Set(taken).size, taken.length);
  });
});
