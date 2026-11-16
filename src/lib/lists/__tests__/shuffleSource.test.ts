import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { labelOfSetting, sourceKey, sourceOfKey } from '../shuffleKinds.ts';

describe('what the shuffle button plays and says', () => {
  it('keeps what it plays as a word, and reads back only what it can be', () => {
    for (const source of [{ kind: 'all' }, { kind: 'list', id: 12 }, { kind: 'auto', id: 'mostPlayed' }] as const) {
      assert.deepEqual(sourceOfKey(sourceKey(source)), source);
    }
    assert.deepEqual(sourceOfKey(null), { kind: 'all' });
    assert.deepEqual(sourceOfKey('list:x'), { kind: 'all' });
    assert.deepEqual(sourceOfKey('auto:nothing'), { kind: 'all' });
  });

  it('says the name of what it plays unless told words of the user’s, or nothing', () => {
    assert.deepEqual(labelOfSetting(null), { mode: 'name' });
    assert.deepEqual(labelOfSetting('{"mode":"icon"}'), { mode: 'icon' });
    assert.deepEqual(labelOfSetting('{"mode":"words","words":"  Karıştır  "}'), { mode: 'words', words: 'Karıştır' });
    assert.deepEqual(labelOfSetting('{"mode":"words","words":"  "}'), { mode: 'name' });
    assert.deepEqual(labelOfSetting('not json'), { mode: 'name' });
  });
});
