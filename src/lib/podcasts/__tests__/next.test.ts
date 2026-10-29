import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { episodesAfter } from '../episodes.ts';

const episode = (guid: string, publishedAt: number | null) => ({ guid, title: guid, url: '', publishedAt, durationSec: null, image: null, summary: null });
const episodes = [episode('d', 40), episode('b', 20), episode('c', 30), episode('a', 10), episode('x', null)];
const guids = (list: { guid: string }[]) => list.map((one) => one.guid);

describe('the episodes after another', () => {
  it('are the ones that came out next, in that order, whatever order the feed lists them in', () => {
    assert.deepEqual(guids(episodesAfter(episodes, 'a', 1)), ['b']);
    assert.deepEqual(guids(episodesAfter(episodes, 'a', 2)), ['b', 'c']);
    assert.deepEqual(guids(episodesAfter(episodes, 'b', 5)), ['c', 'd']);
  });

  it('are none after the newest, an undated one or one not known', () => {
    assert.deepEqual(episodesAfter(episodes, 'd', 3), []);
    assert.deepEqual(episodesAfter(episodes, 'x', 3), []);
    assert.deepEqual(episodesAfter(episodes, 'nope', 3), []);
  });
});
