import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { DEFAULT_JUMP, jumpTo, stepFrom } from '../jump.ts';

describe('which step a stored setting means', () => {
  it('takes one that is offered', () => {
    assert.equal(stepFrom('30'), 30);
  });

  it('falls back to ten for anything it cannot use', () => {
    assert.equal(stepFrom(null), DEFAULT_JUMP);
    assert.equal(stepFrom(''), DEFAULT_JUMP);
    assert.equal(stepFrom('nonsense'), DEFAULT_JUMP);
    // A step that was once offered and no longer is, so the row of buttons
    // would have nothing lit and the player would move by a figure that
    // cannot be read anywhere.
    assert.equal(stepFrom('20'), DEFAULT_JUMP);
  });
});

describe('where a jump lands', () => {
  it('moves by what it was asked for, in the middle of a track', () => {
    assert.equal(jumpTo(60, 10, 240), 70);
    assert.equal(jumpTo(60, -10, 240), 50);
  });

  it('stops at the start rather than going behind it', () => {
    // Pressing back twice at the opening of a song, which is how this is found.
    assert.equal(jumpTo(4, -10, 240), 0);
    assert.equal(jumpTo(0, -30, 240), 0);
  });

  it('stops at the end rather than falling into the next track', () => {
    assert.equal(jumpTo(236, 10, 240), 240);
  });

  it('holds only the near end while the track has no known length', () => {
    // Nothing to clamp against before the player has prepared the file.
    assert.equal(jumpTo(5, 30, 0), 35);
    assert.equal(jumpTo(5, -30, 0), 0);
  });
});
