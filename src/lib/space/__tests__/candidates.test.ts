import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bytesFreed,
  dueForDeletion,
  dueToLook,
  freeUpCandidates,
  LARGE_BYTES,
  LARGEST_COUNT,
  monthsBefore,
  skipKind,
  skippedOften,
  tallySkips,
  type Listening,
  type Membership,
} from '../candidates.ts';

const DAY = 24 * 60 * 60 * 1000;
const MB = 1024 * 1024;
const now = new Date(2026, 9, 29, 12).getTime();
const monthsAgo = (months: number) => monthsBefore(now, months);
const heard = (over: Partial<Listening>): Listening => ({ plays: 0, completed: 0, skips: 0, lateSkips: 0, skippedAfter: null, lastPlayedAt: null, ...over });

describe('months before a day', () => {
  it('go by the calendar', () => {
    assert.equal(new Date(monthsBefore(new Date(2026, 9, 29).getTime(), 6)).getMonth(), 3);
    assert.equal(new Date(monthsBefore(new Date(2026, 1, 10).getTime(), 3)).getFullYear(), 2025);
  });

  it('stop at the end of a shorter month', () => {
    const back = new Date(monthsBefore(new Date(2026, 7, 31).getTime(), 6));
    assert.deepEqual([back.getMonth(), back.getDate()], [1, 28]);
  });
});

describe('a song skipped often', () => {
  it('is skipped three times at the least and three times as often as heard through', () => {
    assert.equal(skippedOften(heard({ skips: 2 })), false);
    assert.equal(skippedOften(heard({ skips: 3 })), true);
    assert.equal(skippedOften(heard({ skips: 3, completed: 1 })), true);
    assert.equal(skippedOften(heard({ skips: 5, completed: 2 })), false);
    assert.equal(skippedOften(heard({ skips: 6, completed: 2 })), true);
  });

  it('counts the skips once most of it was heard as listens to the end', () => {
    assert.equal(skippedOften(heard({ skips: 3, lateSkips: 1 })), true);
    assert.equal(skippedOften(heard({ skips: 5, lateSkips: 1, completed: 1 })), false);
  });
});

describe('what a skip says', () => {
  it('is nothing in the first few seconds', () => {
    assert.equal(skipKind(0, 200), 'flicked');
    assert.equal(skipKind(4.9, 200), 'flicked');
  });

  it('is a song turned down before a third of it, and a minute and a half at the most', () => {
    assert.equal(skipKind(5, 200), 'early');
    assert.equal(skipKind(66, 200), 'early');
    assert.equal(skipKind(67, 200), 'late');
    assert.equal(skipKind(89, 600), 'early');
    assert.equal(skipKind(90, 600), 'late');
  });

  it('goes by a minute where the length is not known', () => {
    assert.equal(skipKind(59, 0), 'early');
    assert.equal(skipKind(60, null), 'late');
  });

  it('is tallied by track, leaving out the skips in passing', () => {
    const tally = tallySkips([
      { trackId: 'a', secondsPlayed: 10, durationSec: 200 },
      { trackId: 'a', secondsPlayed: 20, durationSec: 200 },
      { trackId: 'a', secondsPlayed: 150, durationSec: 200 },
      { trackId: 'a', secondsPlayed: 1, durationSec: 200 },
      { trackId: 'b', secondsPlayed: 2, durationSec: 200 },
      { trackId: 'c', secondsPlayed: 180, durationSec: 200 },
    ]);
    assert.deepEqual(tally.get('a'), { skips: 2, lateSkips: 1, skippedAfter: 15 });
    assert.equal(tally.has('b'), false);
    assert.deepEqual(tally.get('c'), { skips: 0, lateSkips: 1, skippedAfter: null });
  });
});

describe('the songs that could go', () => {
  const tracks = [
    { id: 'kept', size: 5 * MB, addedAt: monthsAgo(12) },
    { id: 'copy', size: 6 * MB, addedAt: monthsAgo(1) },
    { id: 'skipped', size: 4 * MB, addedAt: monthsAgo(1) },
    { id: 'never', size: 3 * MB, addedAt: monthsAgo(7) },
    { id: 'new', size: 3 * MB, addedAt: monthsAgo(2) },
    { id: 'forgotten', size: 7 * MB, addedAt: monthsAgo(20) },
    { id: 'recent', size: 30 * MB, addedAt: monthsAgo(20) },
    { id: 'small', size: 2 * MB, addedAt: monthsAgo(20) },
    { id: 'unsized', size: null, addedAt: null },
  ];
  const listening = new Map<string, Listening>([
    ['kept', heard({ plays: 4, completed: 4, lastPlayedAt: now - DAY })],
    ['copy', heard({ plays: 1, completed: 1, lastPlayedAt: now - DAY })],
    ['skipped', heard({ plays: 1, completed: 1, skips: 4, lastPlayedAt: now - DAY })],
    ['forgotten', heard({ plays: 3, completed: 3, lastPlayedAt: monthsAgo(8) })],
    ['recent', heard({ plays: 9, completed: 9, lastPlayedAt: now - DAY })],
    ['small', heard({ plays: 9, completed: 9, lastPlayedAt: now - DAY })],
  ]);
  const copies = [{ keep: 'kept', ids: ['kept', 'copy'] }];

  it('are grouped by why, each song in the first group it fits', () => {
    const groups = freeUpCandidates(tracks, listening, copies, now);
    assert.deepEqual(
      groups.map((group) => [group.reason, group.candidates.map((candidate) => candidate.id)]),
      [
        ['copy', ['copy']],
        ['skipped', ['skipped']],
        ['neverPlayed', ['never']],
        ['forgotten', ['forgotten']],
        ['large', ['recent']],
      ]
    );
    assert.equal(groups[0]!.candidates[0]!.keep, 'kept');
    assert.equal(groups[4]!.bytes, 30 * MB);
  });

  it('wait as many months as they are told', () => {
    const groups = freeUpCandidates(tracks, listening, copies, now, 1);
    const never = groups.find((group) => group.reason === 'neverPlayed')!;
    assert.deepEqual(never.candidates.map((candidate) => candidate.id), ['never', 'new']);
  });

  it('never offer a copy whose kept copy is not on the phone', () => {
    const groups = freeUpCandidates(tracks, listening, [{ keep: 'gone', ids: ['gone', 'copy'] }], now);
    assert.equal(groups.some((group) => group.reason === 'copy'), false);
  });

  it('offer only so many large files, and none under the size of a large one', () => {
    const many = Array.from({ length: LARGEST_COUNT + 5 }, (_, at) => ({ id: `big${at}`, size: LARGE_BYTES + at, addedAt: now }));
    const groups = freeUpCandidates([...many, { id: 'small', size: LARGE_BYTES - 1, addedAt: now }], new Map(), [], now);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.candidates.length, LARGEST_COUNT);
    assert.equal(groups[0]!.candidates[0]!.id, `big${LARGEST_COUNT + 4}`);
  });

  it('are none in a library with nothing to give', () => {
    assert.deepEqual(freeUpCandidates([{ id: 'a', size: MB, addedAt: now }], new Map(), [], now), []);
  });

  it('add up what the ticked ones free, each once', () => {
    const groups = freeUpCandidates(tracks, listening, copies, now);
    assert.equal(bytesFreed(groups, new Set(['copy', 'never', 'nothing'])), 9 * MB);
  });
});

describe('the songs due to be deleted by themselves', () => {
  const tracks = [
    { id: 'old', addedAt: monthsAgo(10) },
    { id: 'heardLong', addedAt: monthsAgo(20) },
    { id: 'heardLately', addedAt: monthsAgo(20) },
    { id: 'fresh', addedAt: monthsAgo(1) },
    { id: 'notOurs', addedAt: monthsAgo(20) },
    { id: 'playing', addedAt: monthsAgo(20) },
    { id: 'loved', addedAt: monthsAgo(20) },
    { id: 'listed', addedAt: monthsAgo(20) },
    { id: 'unknown', addedAt: null },
  ];
  const own = new Set(tracks.filter((track) => track.id !== 'notOurs').map((track) => track.id));
  const listening = new Map<string, Listening>([
    ['heardLong', heard({ plays: 2, lastPlayedAt: monthsAgo(8) })],
    ['heardLately', heard({ plays: 2, lastPlayedAt: monthsAgo(2) })],
  ]);
  const membership = new Map<string, Membership>([
    ['loved', { favorite: true, lists: 0 }],
    ['listed', { favorite: false, lists: 2 }],
  ]);
  const settings = { months: 6, favorites: false, lists: false };
  const ids = (found: { id: string }[]) => found.map((track) => track.id);

  it('are the app’s own, unheard for the months, and not the one playing', () => {
    assert.deepEqual(ids(dueForDeletion(tracks, listening, own, membership, settings, 'playing', now)), ['old', 'heardLong']);
  });

  it('a song downloaded lately is kept though its last listen, brought in from elsewhere, was long ago', () => {
    const lately = [{ id: 'imported', addedAt: monthsAgo(1) }];
    const before = new Map<string, Listening>([['imported', heard({ plays: 5, lastPlayedAt: monthsAgo(40) })]]);
    assert.deepEqual(ids(dueForDeletion(lately, before, new Set(['imported']), new Map(), settings, null, now)), []);
  });

  it('take in Favorites and the lists only where told to', () => {
    assert.deepEqual(
      ids(dueForDeletion(tracks, listening, own, membership, { ...settings, favorites: true }, 'playing', now)),
      ['old', 'heardLong', 'loved']
    );
    assert.deepEqual(
      ids(dueForDeletion(tracks, listening, own, membership, { ...settings, lists: true }, 'playing', now)),
      ['old', 'heardLong', 'listed']
    );
  });

  it('a song in Favorites and a list as well goes only where both may', () => {
    const both = new Map<string, Membership>([['old', { favorite: true, lists: 1 }]]);
    assert.deepEqual(ids(dueForDeletion(tracks, listening, own, both, { ...settings, favorites: true }, null, now)).includes('old'), false);
    assert.deepEqual(
      ids(dueForDeletion(tracks, listening, own, both, { ...settings, favorites: true, lists: true }, null, now)).includes('old'),
      true
    );
  });

  it('wait as many months as they are set to', () => {
    // Nothing is playing here, so the one that was is due like any other.
    assert.deepEqual(ids(dueForDeletion(tracks, listening, own, membership, { ...settings, months: 12 }, null, now)), ['playing']);
  });
});

describe('the daily look', () => {
  it('is due a day after the last, at once the first time, and after a clock put back', () => {
    assert.equal(dueToLook(null, now), true);
    assert.equal(dueToLook(now - DAY + 1, now), false);
    assert.equal(dueToLook(now - DAY, now), true);
    assert.equal(dueToLook(now + DAY, now), true);
  });
});
