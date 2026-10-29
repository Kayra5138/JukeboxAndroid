import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deleteDaysFrom, playedLongAgo } from '../played.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;
const place = (finished: boolean, daysAgo: number) => ({ positionSec: 60, durationSec: 60, at: now - daysAgo * DAY, finished });

describe('episodes heard long enough ago', () => {
  const tapes = [
    { id: 'old', folder: 'Music/Tapes/Show/' },
    { id: 'recent', folder: 'Music/Tapes/Show/' },
    { id: 'unheard', folder: 'Music/Tapes/Show/' },
    { id: 'book', folder: 'Music/Tapes/A Book/' },
  ];
  const places = new Map([
    ['old', place(true, 10)],
    ['recent', place(true, 2)],
    ['unheard', place(false, 10)],
    ['book', place(true, 10)],
  ]);
  const series = new Set(['music/tapes/show']);

  it('are those of a followed show heard to the end more than the days ago, and nothing else', () => {
    assert.deepEqual(playedLongAgo(tapes, places, series, 7, now).map((tape) => tape.id), ['old']);
    assert.deepEqual(playedLongAgo(tapes, places, series, 1, now).map((tape) => tape.id), ['old', 'recent']);
  });

  it('wait for a setting of days, and never for anything else', () => {
    assert.equal(deleteDaysFrom('7'), 7);
    assert.equal(deleteDaysFrom(null), null);
    assert.equal(deleteDaysFrom('0'), null);
    assert.equal(deleteDaysFrom('soon'), null);
  });
});
