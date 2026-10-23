import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  apart,
  BATCH,
  batchFor,
  DEFAULT_SIZES,
  sizesFrom,
  interleave,
  isFreshId,
  modeFrom,
  sectionKind,
  topUp,
  type QueueStanding,
} from '../autoplay/plan.ts';

const standing = (more: Partial<QueueStanding> = {}): QueueStanding => ({
  mode: 'library',
  repeat: 'off',
  dismissed: false,
  onLoan: false,
  length: 10,
  currentIndex: 0,
  ended: false,
  nextIsPicked: false,
  ...more,
});

describe('modeFrom', () => {
  it('reads the four choices and takes anything else as off', () => {
    assert.equal(modeFrom('library'), 'library');
    assert.equal(modeFrom('fresh'), 'fresh');
    assert.equal(modeFrom('mixed'), 'mixed');
    assert.equal(modeFrom('off'), 'off');
    assert.equal(modeFrom(null), 'off');
    assert.equal(modeFrom('new'), 'off');
  });
});

describe('topUp', () => {
  it('does nothing while there is plenty left', () => {
    assert.deepEqual(topUp(standing({ currentIndex: 5 })), { kind: 'none' });
  });

  it('adds library songs with two left after the one playing', () => {
    assert.deepEqual(topUp(standing({ currentIndex: 6 })), { kind: 'none' });
    assert.deepEqual(topUp(standing({ currentIndex: 7 })), { kind: 'add', urgent: false });
  });

  it('adds new songs a song earlier, and asks for them to be got ready before that', () => {
    assert.deepEqual(topUp(standing({ mode: 'fresh', currentIndex: 6 })), { kind: 'add', urgent: false });
    assert.deepEqual(topUp(standing({ mode: 'mixed', currentIndex: 3 })), { kind: 'prepare' });
    assert.deepEqual(topUp(standing({ mode: 'fresh', currentIndex: 2 })), { kind: 'none' });
  });

  it('is urgent with the last song playing or one after it', () => {
    assert.deepEqual(topUp(standing({ currentIndex: 8 })), { kind: 'add', urgent: true });
    assert.deepEqual(topUp(standing({ currentIndex: 9 })), { kind: 'add', urgent: true });
  });

  it('adds at once to a queue that has ended, and plays on where picks went in after the end', () => {
    assert.deepEqual(topUp(standing({ currentIndex: 9, ended: true })), { kind: 'add', urgent: true });
    assert.deepEqual(topUp(standing({ currentIndex: 7, ended: true, nextIsPicked: true })), { kind: 'resume', index: 8 });
  });

  it('leaves a song somebody queued onto a stopped player for them to start', () => {
    assert.deepEqual(topUp(standing({ currentIndex: 7, ended: true, nextIsPicked: false })), { kind: 'none' });
  });

  it('does nothing while off, with repeat on, once dismissed, on loan to the game, or with nothing played', () => {
    const end = { currentIndex: 9 };
    assert.equal(topUp(standing({ ...end, mode: 'off' })).kind, 'none');
    assert.equal(topUp(standing({ ...end, repeat: 'all' })).kind, 'none');
    assert.equal(topUp(standing({ ...end, repeat: 'one' })).kind, 'none');
    assert.equal(topUp(standing({ ...end, dismissed: true })).kind, 'none');
    assert.equal(topUp(standing({ ...end, onLoan: true })).kind, 'none');
    assert.equal(topUp(standing({ length: 0, currentIndex: -1 })).kind, 'none');
    assert.equal(topUp(standing({ currentIndex: -1 })).kind, 'none');
  });

  it('starts a radio from one song', () => {
    assert.deepEqual(topUp(standing({ length: 1, currentIndex: 0 })), { kind: 'add', urgent: true });
  });
});

describe('interleave', () => {
  it('lays two familiar songs to one new', () => {
    assert.deepEqual(interleave(['a', 'b', 'c', 'd', 'e', 'f'], ['X', 'Y', 'Z']), ['a', 'b', 'X', 'c', 'd', 'Y', 'e', 'f', 'Z']);
  });

  it('fills the places of new songs that were not ready with familiar ones, and the other way about', () => {
    assert.deepEqual(interleave(['a', 'b', 'c', 'd', 'e', 'f', 'g'], ['X']), ['a', 'b', 'X', 'c', 'd', 'e', 'f', 'g']);
    assert.deepEqual(interleave(['a'], ['X', 'Y', 'Z']), ['a', 'X', 'Y', 'Z']);
    assert.deepEqual(interleave([], ['X', 'Y']), ['X', 'Y']);
  });

  it('is the size of a mixed batch when both kinds are there in full', () => {
    const familiar = Array.from({ length: BATCH.mixed.library }, (_, n) => `l${n}`);
    const fresh = Array.from({ length: BATCH.mixed.fresh }, (_, n) => `n${n}`);
    const laid = interleave(familiar, fresh);
    assert.equal(laid.length, 9);
    // Never two new songs together.
    laid.forEach((id, at) => {
      if (id.startsWith('n') && at > 0) assert.ok(laid[at - 1]!.startsWith('l'));
    });
  });
});

describe('apart', () => {
  const by = (song: string) => song[0]!;

  it('keeps an artist from following themself where there is anybody else', () => {
    assert.deepEqual(apart(['a1', 'a2', 'b1', 'b2'], by), ['a1', 'b1', 'a2', 'b2']);
  });

  it('counts the song the batch follows', () => {
    assert.deepEqual(apart(['a1', 'b1'], by, 'a'), ['b1', 'a1']);
  });

  it('drops nothing where it cannot be helped', () => {
    assert.deepEqual(apart(['a1', 'a2', 'a3'], by), ['a1', 'a2', 'a3']);
  });
});

describe('sectionKind', () => {
  it('names the heading by what the songs are', () => {
    assert.equal(sectionKind(['1', '2']), 'library');
    assert.equal(sectionKind(['discover:a', 'discover:b']), 'fresh');
    assert.equal(sectionKind(['1', 'discover:a']), 'mixed');
    assert.ok(isFreshId('discover:job-1'));
    assert.ok(!isFreshId('1234'));
  });
});

describe('how many a top-up adds', () => {
  it('is what was chosen, and the batches as they always were by default', () => {
    assert.deepEqual(batchFor('library', DEFAULT_SIZES), BATCH.library);
    assert.deepEqual(batchFor('fresh', DEFAULT_SIZES), BATCH.fresh);
    assert.deepEqual(batchFor('mixed', DEFAULT_SIZES), BATCH.mixed);
    assert.deepEqual(batchFor('library', { library: 20, fresh: 10 }), { library: 20, fresh: 0 });
    assert.deepEqual(batchFor('fresh', { library: 20, fresh: 10 }), { library: 0, fresh: 10 });
    // Three quarters of each, and never none of either.
    assert.deepEqual(batchFor('mixed', { library: 20, fresh: 10 }), { library: 15, fresh: 8 });
    assert.deepEqual(batchFor('mixed', { library: 4, fresh: 2 }), { library: 3, fresh: 2 });
  });

  it('reads only the choices offered, and the defaults for anything else', () => {
    assert.deepEqual(sizesFrom('12,6'), { library: 12, fresh: 6 });
    assert.deepEqual(sizesFrom('13,6'), { library: 8, fresh: 6 });
    assert.deepEqual(sizesFrom('12'), { library: 12, fresh: 4 });
    assert.deepEqual(sizesFrom(null), DEFAULT_SIZES);
    assert.deepEqual(sizesFrom('nonsense'), DEFAULT_SIZES);
  });
});
