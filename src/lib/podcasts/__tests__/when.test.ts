import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { episodesWhen, yearsOf } from '../when.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 29, 12);
const at = (daysAgo: number | null, guid: string) => ({ guid, publishedAt: daysAgo == null ? null : now - daysAgo * DAY });
const episodes = [at(2, 'a'), at(20, 'b'), at(60, 'c'), at(400, 'd'), at(null, 'e')];
const ids = (list: { guid: string }[]) => list.map((episode) => episode.guid);

describe('the episodes of a time', () => {
  it('are all of them, newest first, the undated last', () => {
    assert.deepEqual(ids(episodesWhen(episodes, 'all', 'newest', now)), ['a', 'b', 'c', 'd', 'e']);
  });

  it('are the latest week, month or three months, and none undated', () => {
    assert.deepEqual(ids(episodesWhen(episodes, 'week', 'newest', now)), ['a']);
    assert.deepEqual(ids(episodesWhen(episodes, 'month', 'newest', now)), ['a', 'b']);
    assert.deepEqual(ids(episodesWhen(episodes, 'quarter', 'newest', now)), ['a', 'b', 'c']);
  });

  it('are one year of them', () => {
    assert.deepEqual(ids(episodesWhen(episodes, 'year:2025', 'newest', now)), ['d']);
    assert.deepEqual(ids(episodesWhen(episodes, 'year:2026', 'oldest', now)), ['c', 'b', 'a']);
  });

  it('can run oldest first', () => {
    assert.deepEqual(ids(episodesWhen(episodes, 'all', 'oldest', now)).slice(0, 4), ['d', 'c', 'b', 'a']);
  });

  it('names the years there are, latest first, once each', () => {
    assert.deepEqual(yearsOf(episodes), [2026, 2025]);
  });
});
