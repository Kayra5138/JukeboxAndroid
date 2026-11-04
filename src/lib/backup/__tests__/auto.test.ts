import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_EVERY, DEFAULT_KEEP, everyOf, isDue, keepOf, lastOf } from '../due.ts';
import { carried, staysThroughReplace } from '../format.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 29, 21, 0);

describe('when an automatic backup is due', () => {
  it('is due at once when none has been made', () => {
    assert.equal(isDue(null, 'weekly', NOW), true);
    assert.equal(isDue(null, 'daily', NOW), true);
  });

  it('is due a day or a week after the last, a few hours early allowed', () => {
    assert.equal(isDue(NOW - DAY, 'daily', NOW), true);
    assert.equal(isDue(NOW - 21 * HOUR, 'daily', NOW), true);
    assert.equal(isDue(NOW - 19 * HOUR, 'daily', NOW), false);
    assert.equal(isDue(NOW - DAY, 'weekly', NOW), false);
    assert.equal(isDue(NOW - 6 * DAY, 'weekly', NOW), false);
    assert.equal(isDue(NOW - 7 * DAY + 3 * HOUR, 'weekly', NOW), true);
    assert.equal(isDue(NOW - 30 * DAY, 'weekly', NOW), true);
  });

  it('is due when the last is later than now, the clock having been put back', () => {
    assert.equal(isDue(NOW + DAY, 'weekly', NOW), true);
  });
});

describe('what automatic backup’s settings are read as', () => {
  it('reads how often, weekly where nothing usable is stored', () => {
    assert.equal(everyOf('daily'), 'daily');
    assert.equal(everyOf('weekly'), 'weekly');
    assert.equal(DEFAULT_EVERY, 'weekly');
    assert.equal(everyOf(null), 'weekly');
    assert.equal(everyOf('monthly'), 'weekly');
  });

  it('reads how many to keep, five where nothing usable is stored', () => {
    assert.equal(DEFAULT_KEEP, 5);
    assert.equal(keepOf('12'), 12);
    assert.equal(keepOf(null), 5);
    assert.equal(keepOf('0'), 5);
    assert.equal(keepOf('2.5'), 5);
    assert.equal(keepOf('many'), 5);
  });

  it('reads when the last was made, and none from what is not a time', () => {
    assert.equal(lastOf(String(NOW)), NOW);
    assert.equal(lastOf(null), null);
    assert.equal(lastOf(''), null);
    assert.equal(lastOf('soon'), null);
    assert.equal(lastOf('-5'), null);
  });
});

describe('automatic backup’s settings in a backup', () => {
  it('leaves this phone’s folder, switch and record behind, and keeps them through a replace', () => {
    for (const key of ['backup:folder', 'backup:auto', 'backup:last', 'backup:trouble']) {
      assert.equal(carried(key), false, key);
      assert.equal(staysThroughReplace(key), true, key);
    }
  });

  it('carries how often and how many to keep, which are preferences', () => {
    for (const key of ['backup:every', 'backup:keep']) {
      assert.equal(carried(key), true, key);
      assert.equal(staysThroughReplace(key), false, key);
    }
  });
});
