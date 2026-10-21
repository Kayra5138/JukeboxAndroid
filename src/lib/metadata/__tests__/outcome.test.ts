import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeOutcome } from '../outcome.ts';
import { en } from '../../i18n/en/index.ts';
import type { EnrichResult } from '../pipeline.ts';

const ran = (changes: Partial<EnrichResult> = {}): { result: EnrichResult } => ({
  result: { coversSaved: 0, matched: 0, missed: 0, cancelled: false, ...changes },
});

describe('how a run is said to have ended', () => {
  it('says a run for covers found none, and an ordinary lookup does not', () => {
    assert.equal(describeOutcome('covers', ran(), en), en.details.selection.coversNone);
    assert.equal(describeOutcome('details', ran(), en), null);
    // Stopped by hand, it found nothing because it was stopped.
    assert.equal(describeOutcome('covers', ran({ cancelled: true }), en), null);
  });

  it('counts covers whichever run found them', () => {
    assert.equal(describeOutcome('covers', ran({ coversSaved: 3 }), en), en.details.library.coversSaved(3));
  });

  it('says how many tracks lyrics were found for, of those that had none', () => {
    const lyrics = { found: 2, wanted: 5, had: 1, chosen: 0, cancelled: false };
    assert.equal(describeOutcome('lyrics', { lyrics }, en), 'Lyrics found for 2 of 5. 1 already had them.');
    assert.equal(
      describeOutcome('lyrics', { lyrics: { ...lyrics, stopped: 'offline' } }, en),
      en.details.selection.lyricsOffline
    );
  });
});
