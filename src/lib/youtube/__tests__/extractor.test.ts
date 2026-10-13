import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adviceOf,
  CHECK_EVERY_MS,
  daysSince,
  isDue,
  isNewer,
  isStale,
  NOTHING_KNOWN,
  offerFor,
  readKnown,
  smellOf,
  troubleOf,
  TRY_AGAIN_MS,
  type Known,
} from '../extractor.ts';

const NOW = Date.UTC(2026, 9, 13, 12);
const HOUR = 60 * 60 * 1000;
const known = (latest: string | null, checkedAgo: number | null, triedAgo: number | null = checkedAgo): Known => ({
  latest,
  checkedAt: checkedAgo == null ? null : NOW - checkedAgo,
  triedAt: triedAgo == null ? null : NOW - triedAgo,
});
const failed = (errorCode: string | null, error: string | null = null) => ({ status: 'failed' as const, errorCode, error });

describe('which release is newer', () => {
  it('goes by the numbers', () => {
    assert.equal(isNewer('2026.10.01', '2026.08.19'), true);
    assert.equal(isNewer('2027.01.02', '2026.12.30'), true);
    assert.equal(isNewer('2026.9.1', '2026.08.19'), true);
    assert.equal(isNewer('2026.08.19', '2026.08.19'), false);
    assert.equal(isNewer('2026.08.19', '2026.10.01'), false);
  });
  it('knows the second release of a day from the first', () => {
    assert.equal(isNewer('2026.08.19.1', '2026.08.19'), true);
    assert.equal(isNewer('2026.08.19', '2026.08.19.1'), false);
    assert.equal(isNewer('2026.08.19.0', '2026.08.19'), false);
  });
  it('offers nothing on the strength of a word that is not a version', () => {
    for (const odd of [null, undefined, '', 'latest', 'v2026.08.19', '2026.08', '2026.08.19-beta']) {
      assert.equal(isNewer(odd, '2026.08.19'), false);
      assert.equal(isNewer('2026.08.19', odd), false);
    }
  });
});

describe('when the look is made by itself', () => {
  it('is due before the first, and a day after the last', () => {
    assert.equal(isDue(NOTHING_KNOWN, NOW, true), true);
    assert.equal(isDue(known('2026.08.19', CHECK_EVERY_MS - 1), NOW, true), false);
    assert.equal(isDue(known('2026.08.19', CHECK_EVERY_MS), NOW, true), true);
  });
  it('is never due with the switch off', () => {
    assert.equal(isDue(NOTHING_KNOWN, NOW, false), false);
    assert.equal(isDue(known('2026.08.19', 30 * CHECK_EVERY_MS), NOW, false), false);
  });
  it('waits an hour after one that could not be made', () => {
    assert.equal(isDue(known(null, null, 5 * 60 * 1000), NOW, true), false);
    assert.equal(isDue(known('2026.08.19', 3 * CHECK_EVERY_MS, TRY_AGAIN_MS - 1), NOW, true), false);
    assert.equal(isDue(known('2026.08.19', 3 * CHECK_EVERY_MS, TRY_AGAIN_MS), NOW, true), true);
  });
  it('takes a time still to come for a clock put back, and asks', () => {
    assert.equal(isDue(known('2026.08.19', -5 * HOUR), NOW, true), true);
    assert.equal(isStale(known('2026.08.19', -5 * HOUR), NOW), true);
  });
  it('counts whole days since the last answer', () => {
    assert.equal(daysSince(NOTHING_KNOWN, NOW), null);
    assert.equal(daysSince(known('2026.08.19', HOUR), NOW), 0);
    assert.equal(daysSince(known('2026.08.19', 25 * HOUR), NOW), 1);
    assert.equal(daysSince(known('2026.08.19', 72 * HOUR), NOW), 3);
  });
});

describe('what was written down', () => {
  it('is read back as it was written', () => {
    const kept = known('2026.10.01', HOUR);
    assert.deepEqual(readKnown(JSON.stringify(kept)), kept);
  });
  it('is nothing where it is nothing that can be read', () => {
    for (const odd of [null, undefined, '', 'not json', 'null', '[]', '7']) assert.deepEqual(readKnown(odd), NOTHING_KNOWN);
  });
  it('drops whatever in it is not what it should be', () => {
    assert.deepEqual(readKnown('{"latest":"; rm -rf","checkedAt":"yesterday","triedAt":-4}'), NOTHING_KNOWN);
    assert.deepEqual(readKnown('{"latest":"2026.10.01","checkedAt":12}'), { latest: '2026.10.01', checkedAt: 12, triedAt: null });
  });
});

describe('what is advised', () => {
  it('is the update where a newer release is known of', () => {
    assert.equal(adviceOf('2026.08.19', known('2026.10.01', HOUR), NOW), 'update');
    // However long ago it was learnt: it is still newer.
    assert.equal(adviceOf('2026.08.19', known('2026.10.01', 9 * CHECK_EVERY_MS), NOW), 'update');
  });
  it('is a look where nobody has looked lately', () => {
    assert.equal(adviceOf('2026.08.19', NOTHING_KNOWN, NOW), 'check');
    assert.equal(adviceOf('2026.08.19', known('2026.08.19', 2 * CHECK_EVERY_MS), NOW), 'check');
  });
  it('is nothing where the phone has the latest as of today', () => {
    assert.equal(adviceOf('2026.08.19', known('2026.08.19', HOUR), NOW), 'none');
    assert.equal(adviceOf('2026.10.01', known('2026.08.19', HOUR), NOW), 'none');
  });
  it('is nothing on a build that cannot say what it has', () => {
    assert.equal(adviceOf(null, known('2026.10.01', HOUR), NOW), 'none');
  });
});

describe('which failures smell of an old extractor', () => {
  it('believes the phone where the phone said so', () => {
    assert.equal(smellOf(failed('ERR_YOUTUBE_OUTDATED')), 'surely');
  });
  it('suspects a refusal, and the extractor finding nothing to fetch', () => {
    assert.equal(smellOf(failed('ERR_YOUTUBE_REFUSED')), 'maybe');
    assert.equal(smellOf(failed('ERR_YOUTUBE_VERIFICATION')), 'maybe');
    for (const line of [
      'ERROR: [youtube] BaW_jenozKc: Requested format is not available. Use --list-formats for a list of available formats',
      'ERROR: [youtube] BaW_jenozKc: Only images are available for download',
      'WARNING: [youtube] BaW_jenozKc: nsig extraction failed: Some formats may be missing',
      'ERROR: unable to download video data: HTTP Error 403: Forbidden',
    ]) assert.equal(smellOf(failed('ERR_DOWNLOAD_FAILED', line)), 'maybe', line);
  });
  it('suspects nothing else', () => {
    for (const code of ['ERR_YOUTUBE_UNAVAILABLE', 'ERR_YOUTUBE_NETWORK', 'ERR_YOUTUBE_TIMED_OUT', 'ERR_YOUTUBE_LIVE', 'ERR_YOUTUBE_NO_AUDIO',
      'ERR_YOUTUBE_ENGINE', 'ERR_DOWNLOAD_NO_MATCH', 'ERR_DOWNLOAD_INTERRUPTED', 'ERR_DOWNLOAD_FOLDER']) {
      assert.equal(smellOf(failed(code, 'nsig')), null, code);
    }
    assert.equal(smellOf(failed('ERR_DOWNLOAD_FAILED', 'ERROR: Postprocessing: audio conversion failed')), null);
    assert.equal(smellOf(failed('ERR_DOWNLOAD_FAILED', null)), null);
    // A build from before there were codes says nothing that can be gone by.
    assert.equal(smellOf(failed(null, 'YouTube has changed. Update Jukebox.')), null);
    assert.equal(smellOf({ status: 'cancelled', errorCode: 'ERR_YOUTUBE_OUTDATED', error: null }), null);
    assert.equal(smellOf({ status: 'done', errorCode: null, error: null }), null);
  });
});

describe('what a failed row offers in place of Retry', () => {
  it('offers the update or the look for a failure that is surely the extractor', () => {
    assert.equal(offerFor(failed('ERR_YOUTUBE_OUTDATED'), 'update'), 'update');
    assert.equal(offerFor(failed('ERR_YOUTUBE_OUTDATED'), 'check'), 'check');
    assert.equal(offerFor(failed('ERR_YOUTUBE_OUTDATED'), 'none'), null);
  });
  it('offers the update for one that only might be, and never sends anybody looking for it', () => {
    assert.equal(offerFor(failed('ERR_YOUTUBE_REFUSED'), 'update'), 'update');
    assert.equal(offerFor(failed('ERR_YOUTUBE_REFUSED'), 'check'), null);
    assert.equal(offerFor(failed('ERR_YOUTUBE_REFUSED'), 'none'), null);
  });
  it('leaves every other failure with Retry', () => {
    assert.equal(offerFor(failed('ERR_YOUTUBE_NETWORK'), 'update'), null);
    assert.equal(offerFor(failed('ERR_YOUTUBE_UNAVAILABLE'), 'check'), null);
  });
});

describe('why it did not come off', () => {
  it('is read off the code the phone gave', () => {
    assert.equal(troubleOf({ code: 'ERR_EXTRACTOR_NETWORK' }), 'network');
    assert.equal(troubleOf({ code: 'ERR_EXTRACTOR_ANSWER' }), 'answer');
    assert.equal(troubleOf({ code: 'ERR_EXTRACTOR_CHECKSUM' }), 'checksum');
    assert.equal(troubleOf({ code: 'ERR_EXTRACTOR_BROKEN' }), 'broken');
    assert.equal(troubleOf({ code: 'ERR_EXTRACTOR_FAILED' }), 'failed');
    assert.equal(troubleOf(new Error('anything')), 'failed');
    assert.equal(troubleOf(null), 'failed');
  });
});
