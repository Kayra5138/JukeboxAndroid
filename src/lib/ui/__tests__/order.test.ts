import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { moved, orderFrom } from '../orderOf.ts';

const ALL = ['library', 'lists', 'search', 'stats', 'settings'] as const;

describe('an order somebody chose', () => {
  it('is the order things came in until one is chosen', () => {
    assert.deepEqual(orderFrom(null, ALL), [...ALL]);
    assert.deepEqual(orderFrom('', ALL), [...ALL]);
  });

  it('is read back as it was written', () => {
    assert.deepEqual(orderFrom('settings,search,library,stats,lists', ALL), ['settings', 'search', 'library', 'stats', 'lists']);
  });

  it('passes over what is not one of them, and anything named twice counts once', () => {
    assert.deepEqual(orderFrom('stats,nonsense,stats,library', ALL), ['stats', 'library', 'lists', 'search', 'settings']);
  });

  it('puts what it does not name at the end, in its own order: a tab added later turns up', () => {
    assert.deepEqual(orderFrom('search,library', ALL), ['search', 'library', 'lists', 'stats', 'settings']);
  });

  it('moves one a place either way, and not past either end', () => {
    assert.deepEqual(moved(ALL, 'search', -1), ['library', 'search', 'lists', 'stats', 'settings']);
    assert.deepEqual(moved(ALL, 'search', 1), ['library', 'lists', 'stats', 'search', 'settings']);
    assert.deepEqual(moved(ALL, 'library', -1), [...ALL]);
    assert.deepEqual(moved(ALL, 'settings', 1), [...ALL]);
    assert.deepEqual(moved(ALL, 'missing' as never, 1), [...ALL]);
  });
});
