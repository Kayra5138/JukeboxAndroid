import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asLyrics, stampOf } from '../transcript.ts';

describe('a tape’s captions as words to follow', () => {
  it('are stamped the way timed lyrics are, minutes running past an hour', () => {
    assert.equal(stampOf(0.16), '[00:00.16]');
    assert.equal(stampOf(83.5), '[01:23.50]');
    assert.equal(stampOf(3725.04), '[62:05.04]');
  });

  it('are timed text and plain text, without the empty lines; nothing for none', () => {
    assert.deepEqual(asLyrics([{ startSec: 1, text: 'Merhaba' }, { startSec: 2, text: ' ' }, { startSec: 3.25, text: 'Nasılsın' }]), {
      synced: '[00:01.00]Merhaba\n[00:03.25]Nasılsın',
      plain: 'Merhaba\nNasılsın',
    });
    assert.equal(asLyrics([]), null);
  });
});
