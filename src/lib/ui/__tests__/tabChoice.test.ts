import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hiddenFrom, storedHidden } from '../tabChoice.ts';

test('the tabs left off are read back as written, and nothing else is taken', () => {
  assert.deepEqual([...hiddenFrom(storedHidden(new Set(['stats', 'search'])))], ['search', 'stats']);
  assert.deepEqual([...hiddenFrom('["settings","index","lists"]')], ['lists']);
  assert.equal(hiddenFrom(null).size, 0);
  assert.equal(hiddenFrom('not json').size, 0);
  assert.equal(hiddenFrom('{"a":1}').size, 0);
});
