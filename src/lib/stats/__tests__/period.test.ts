import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bucketsOf,
  busiestHour,
  changeBetween,
  columnHolding,
  formatDuration,
  longestStreak,
  previousRange,
  rangeOf,
  tally,
  type Listen,
  type PeriodId,
} from '../period.ts';

/*
  Every clock here is built with the local `Date` constructor rather than from a
  UTC string, because that is what the code under test does: a day is the day
  the phone is having, and a test pinned to UTC would pass or fail depending on
  where it ran.
*/
const at = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
) => +new Date(year, month - 1, day, hour, minute);

const listen = (when: number, seconds = 60): Listen => ({
  at: when,
  seconds,
  completed: 1,
});

describe('rangeOf', () => {
  it('takes a day from midnight to midnight', () => {
    const range = rangeOf('day', at(2026, 9, 24, 14, 32));
    assert.equal(range.since, at(2026, 9, 24));
    assert.equal(range.until, at(2026, 9, 25));
  });

  it('begins a week on Monday', () => {
    // 24 September 2026 is a Thursday.
    const range = rangeOf('week', at(2026, 9, 24, 14, 32));
    assert.equal(range.since, at(2026, 9, 21));
    assert.equal(range.until, at(2026, 9, 28));
  });

  it('counts Sunday as the end of a week rather than the start of one', () => {
    // 27 September 2026 is a Sunday, and belongs to the week before it.
    const range = rangeOf('week', at(2026, 9, 27, 23, 59));
    assert.equal(range.since, at(2026, 9, 21));
  });

  it('takes a month and a year from their own calendars', () => {
    assert.deepEqual(rangeOf('month', at(2026, 2, 14)), {
      since: at(2026, 2, 1),
      until: at(2026, 3, 1),
    });
    assert.deepEqual(rangeOf('year', at(2026, 7, 4)), {
      since: at(2026, 1, 1),
      until: at(2027, 1, 1),
    });
  });

  it('lets all time reach anything ever recorded', () => {
    const range = rangeOf('all', at(2026, 9, 24));
    assert.equal(range.since, 0);
    assert.ok(range.until > at(2400, 1, 1));
  });
});

describe('previousRange', () => {
  it('steps back a whole period', () => {
    assert.deepEqual(previousRange('day', at(2026, 9, 24, 9)), {
      since: at(2026, 9, 23),
      until: at(2026, 9, 24),
    });
    assert.deepEqual(previousRange('week', at(2026, 9, 24)), {
      since: at(2026, 9, 14),
      until: at(2026, 9, 21),
    });
  });

  it('gives the month before its own length rather than this one', () => {
    // March has 31 days and February 28; the comparison is against February as
    // it actually was, not against the last 31 days.
    assert.deepEqual(previousRange('month', at(2026, 3, 15)), {
      since: at(2026, 2, 1),
      until: at(2026, 3, 1),
    });
  });

  it('crosses the new year backwards', () => {
    assert.deepEqual(previousRange('day', at(2026, 1, 1, 10)), {
      since: at(2025, 12, 31),
      until: at(2026, 1, 1),
    });
    assert.deepEqual(previousRange('year', at(2026, 5, 5)), {
      since: at(2025, 1, 1),
      until: at(2026, 1, 1),
    });
  });

  it('has nothing to compare all time against', () => {
    assert.equal(previousRange('all', at(2026, 9, 24)), null);
  });
});

describe('bucketsOf', () => {
  it('gives a day twenty-four hours and a week seven days', () => {
    assert.equal(bucketsOf('day', at(2026, 9, 24, 14)).length, 24);
    const week = bucketsOf('week', at(2026, 9, 24));
    assert.equal(week.length, 7);
    assert.equal(week[0].label, 'Mon');
    assert.equal(week[6].label, 'Sun');
  });

  it('gives each month its own number of days', () => {
    assert.equal(bucketsOf('month', at(2026, 2, 10)).length, 28);
    assert.equal(bucketsOf('month', at(2024, 2, 10)).length, 29);
    assert.equal(bucketsOf('month', at(2026, 4, 10)).length, 30);
    assert.equal(bucketsOf('month', at(2026, 7, 10)).length, 31);
  });

  it('covers a period end to end with no gaps', () => {
    const month = bucketsOf('month', at(2026, 3, 10));
    for (let index = 1; index < month.length; index += 1) {
      assert.equal(month[index - 1].end, month[index].start);
    }
    assert.equal(month[0].start, at(2026, 3, 1));
    assert.equal(month[month.length - 1].end, at(2026, 4, 1));
  });

  it('gives a still-running period its whole width', () => {
    // Asked on a Thursday, the chart still has Friday, Saturday and Sunday in
    // it: a week that grows a column a day says less than one that fills in.
    const week = bucketsOf('week', at(2026, 9, 24));
    assert.equal(week[6].end, at(2026, 9, 28));
  });

  it('runs all time from the first listen to now, a month at a time', () => {
    const buckets = bucketsOf('all', at(2026, 9, 24), at(2026, 6, 15));
    assert.equal(buckets.length, 4);
    assert.equal(buckets[0].start, at(2026, 6, 1));
    assert.equal(buckets[3].end, at(2026, 10, 1));
  });

  it('redraws a long history a year at a time', () => {
    const buckets = bucketsOf('all', at(2026, 9, 24), at(2016, 1, 5));
    assert.equal(buckets.length, 11);
    assert.equal(buckets[0].label, '2016');
    assert.equal(buckets[10].end, at(2027, 1, 1));
  });

  it('falls back to this month when nothing has been listened to', () => {
    const buckets = bucketsOf('all', at(2026, 9, 24), null);
    assert.equal(buckets.length, 1);
    assert.equal(buckets[0].start, at(2026, 9, 1));
  });
});

describe('tally', () => {
  const buckets = bucketsOf('week', at(2026, 9, 24));

  it('adds each listen into the day it fell on', () => {
    const totals = tally(
      [
        listen(at(2026, 9, 21, 9), 120),
        listen(at(2026, 9, 21, 22), 60),
        listen(at(2026, 9, 24, 14), 30),
      ],
      buckets
    );

    assert.deepEqual(totals[0], { plays: 2, seconds: 180 });
    assert.deepEqual(totals[3], { plays: 1, seconds: 30 });
    assert.deepEqual(totals[6], { plays: 0, seconds: 0 });
  });

  it('drops anything outside the period rather than folding it into an end', () => {
    const totals = tally(
      [listen(at(2026, 9, 20, 23)), listen(at(2026, 9, 28, 1))],
      buckets
    );
    assert.equal(
      totals.reduce((sum, entry) => sum + entry.plays, 0),
      0
    );
  });

  it('puts a listen on a boundary in the column that begins there', () => {
    const totals = tally([listen(at(2026, 9, 22))], buckets);
    assert.equal(totals[1].plays, 1);
    assert.equal(totals[0].plays, 0);
  });
});

describe('columnHolding', () => {
  const now = at(2026, 9, 24, 14);

  it('names the column a moment falls in', () => {
    const week = bucketsOf('week', now);
    assert.equal(columnHolding(at(2026, 9, 24, 9), week), 3);
    assert.equal(columnHolding(at(2026, 9, 21), week), 0);
  });

  it('has no column for a moment the chart does not reach', () => {
    const week = bucketsOf('week', now);
    assert.equal(columnHolding(at(2026, 9, 20, 23), week), null);
    assert.equal(columnHolding(at(2026, 9, 28), week), null);
  });

  it('has nothing to name when nothing is pinned', () => {
    assert.equal(columnHolding(null, bucketsOf('week', now)), null);
    assert.equal(columnHolding(at(2026, 9, 24), []), null);
  });

  it('carries a day picked in a month over to the month it is in', () => {
    // The crash: pick the 25th on the monthly chart, then switch to Year. The
    // 25th is column 24 of 30, and a year has twelve — kept as a position the
    // pin pointed past the end of the chart and the labels went looking for a
    // column that did not exist.
    const month = bucketsOf('month', now);
    const twentyFifth = month[24];
    assert.equal(twentyFifth.label, '25');

    const year = bucketsOf('year', now);
    assert.equal(year[month.indexOf(twentyFifth)], undefined);

    const column = columnHolding(twentyFifth.start, year);
    assert.equal(column, 8);
    assert.equal(year[column!].label, 'S');
  });

  it('drops a month picked in a year that a day has no room for', () => {
    // The same move the other way round. Last January is nowhere in today's
    // twenty-four hours, so the pin is let go of rather than carried over.
    const january = bucketsOf('year', now)[0];
    assert.equal(columnHolding(january.start, bucketsOf('day', now)), null);
  });

  it('never names a column outside the chart, whichever period follows which', () => {
    const periods: PeriodId[] = ['day', 'week', 'month', 'year', 'all'];
    const first = at(2024, 3, 9);

    for (const from of periods) {
      for (const to of periods) {
        const before = bucketsOf(from, now, first);
        const after = bucketsOf(to, now, first);
        // Every column of the old chart, not merely the last: the one that
        // overruns depends on which pair of periods it is.
        for (const column of before) {
          const index = columnHolding(column.start, after);
          if (index == null) continue;
          assert.ok(
            after[index] !== undefined,
            `${from} column at ${new Date(column.start).toISOString()} landed outside ${to}`
          );
          assert.ok(column.start >= after[index].start && column.start < after[index].end);
        }
      }
    }
  });
});

describe('busiestHour', () => {
  it('answers with the hour the most was listened in', () => {
    assert.equal(
      busiestHour([
        listen(at(2026, 9, 21, 9), 100),
        listen(at(2026, 9, 22, 23), 400),
        listen(at(2026, 9, 23, 23), 10),
      ]),
      23
    );
  });

  it('has no answer for a history with nothing in it', () => {
    assert.equal(busiestHour([]), null);
  });
});

describe('longestStreak', () => {
  it('counts consecutive days rather than listens', () => {
    assert.equal(
      longestStreak([
        listen(at(2026, 9, 21, 8)),
        listen(at(2026, 9, 21, 20)),
        listen(at(2026, 9, 22, 11)),
        listen(at(2026, 9, 23, 11)),
      ]),
      3
    );
  });

  it('breaks the run on a missed day', () => {
    assert.equal(
      longestStreak([
        listen(at(2026, 9, 21)),
        listen(at(2026, 9, 22)),
        listen(at(2026, 9, 25)),
        listen(at(2026, 9, 26)),
        listen(at(2026, 9, 27)),
      ]),
      3
    );
  });

  it('joins days across the end of a month', () => {
    assert.equal(
      longestStreak([listen(at(2026, 8, 31, 23)), listen(at(2026, 9, 1, 1))]),
      2
    );
  });

  it('is nothing for a history with nothing in it', () => {
    assert.equal(longestStreak([]), 0);
  });
});

describe('formatDuration', () => {
  it('says seconds, then minutes, then hours', () => {
    assert.equal(formatDuration(45), '45s');
    assert.equal(formatDuration(60), '1m');
    assert.equal(formatDuration(38 * 60), '38m');
    assert.equal(formatDuration(4 * 3600 + 12 * 60), '4h 12m');
  });

  it('leaves off a zero remainder', () => {
    assert.equal(formatDuration(2 * 3600), '2h');
  });

  it('has something to say about nothing', () => {
    assert.equal(formatDuration(0), '0s');
  });
});

describe('changeBetween', () => {
  it('reports the change as a percentage', () => {
    assert.equal(changeBetween(120, 100), 20);
    assert.equal(changeBetween(50, 100), -50);
  });

  it('refuses to divide by a period with nothing in it', () => {
    assert.equal(changeBetween(120, 0), null);
  });
});
