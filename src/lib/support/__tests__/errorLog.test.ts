import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describeThrown,
  DOWNLOADS_WITHIN_MS,
  EMPTY_LOG,
  KEEP,
  readLog,
  REPEAT_MS,
  withEntry,
  withFailedDownloads,
  type ErrorLog,
} from '../errorLog.ts';

const at = Date.UTC(2026, 9, 15, 12, 0);

test('an entry is scrubbed before it is kept', () => {
  const log = withEntry(EMPTY_LOG, { at, version: '0.33.1', kind: 'search', message: 'No results for "Song Title"' });
  assert.deepEqual(log.entries, [{ at, version: '0.33.1', kind: 'search', message: 'No results for <…>' }]);
});

test('only the last fifty are kept, oldest first', () => {
  let log: ErrorLog = EMPTY_LOG;
  for (let i = 0; i < KEEP + 10; i += 1) log = withEntry(log, { at: at + i * REPEAT_MS, version: '1.0.0', kind: 'js', message: `failure ${i}` });
  assert.equal(log.entries.length, KEEP);
  assert.equal(log.entries[0].message, 'failure 10');
  assert.equal(log.entries[KEEP - 1].message, `failure ${KEEP + 9}`);
});

test('the same failure again within a minute is written once', () => {
  let log = withEntry(EMPTY_LOG, { at, version: '1.0.0', kind: 'render', message: 'boom' });
  log = withEntry(log, { at: at + 1000, version: '1.0.0', kind: 'render', message: 'boom' });
  assert.equal(log.entries.length, 1);
  log = withEntry(log, { at: at + REPEAT_MS, version: '1.0.0', kind: 'render', message: 'boom' });
  assert.equal(log.entries.length, 2);
});

test('nothing left once scrubbed is nothing written', () => {
  assert.equal(withEntry(EMPTY_LOG, { at, version: '1', kind: 'js', message: '   ' }), EMPTY_LOG);
});

test('what was written down is read back, and anything else is an empty log', () => {
  const log = withEntry(EMPTY_LOG, { at, version: '1.0.0', kind: 'lookup', message: 'MusicBrainz responded 503' });
  assert.deepEqual(readLog(JSON.stringify(log)), log);
  assert.deepEqual(readLog(null), EMPTY_LOG);
  assert.deepEqual(readLog('not json'), EMPTY_LOG);
  assert.deepEqual(readLog(JSON.stringify({ entries: [{ at, version: '1', kind: 'nonsense', message: 'x' }, 5] })).entries, []);
});

test('failed downloads are written once each, with their code', () => {
  const jobs = [
    { status: 'failed', finishedAt: at - 2000, errorCode: 'ERR_YOUTUBE_REFUSED', error: 'HTTP Error 403: Forbidden' },
    { status: 'done', finishedAt: at - 1500 },
    { status: 'failed', finishedAt: at - 1000, errorCode: 'ERR_YOUTUBE_NETWORK', discoverKey: 'some artist|some song' },
    { status: 'failed', finishedAt: at - 500, errorCode: 'ERR_DISCOVER_NO_MATCH', hold: true },
  ];
  const once = withFailedDownloads(EMPTY_LOG, jobs, '0.33.1', at);
  assert.deepEqual(
    once.entries.map((entry) => [entry.kind, entry.message]),
    [
      ['download', 'ERR_YOUTUBE_REFUSED — HTTP Error 403: <…>'],
      ['discover', 'ERR_YOUTUBE_NETWORK'],
    ]
  );
  assert.equal(once.downloadsTo, at - 1000);
  // Read again with the queue, they are not written again.
  assert.equal(withFailedDownloads(once, jobs, '0.33.1', at + 5000), once);
});

test('a download that failed long ago is not news', () => {
  const jobs = [{ status: 'failed', finishedAt: at - DOWNLOADS_WITHIN_MS - 1, errorCode: 'ERR_YOUTUBE_REFUSED' }];
  assert.equal(withFailedDownloads(EMPTY_LOG, jobs, '1', at), EMPTY_LOG);
});

test('a thrown thing is its kind and its message, without its stack', () => {
  const error = new TypeError('undefined is not a function');
  assert.equal(describeThrown(error), 'TypeError — undefined is not a function');
  assert.equal(describeThrown(new Error('plain')), 'plain');
  assert.equal(describeThrown(Object.assign(new Error('refused'), { code: 'ERR_YOUTUBE_REFUSED' })), 'ERR_YOUTUBE_REFUSED — refused');
  assert.equal(describeThrown(Object.assign(new Error('ERR_X happened'), { code: 'ERR_X' })), 'ERR_X happened');
  assert.equal(describeThrown('a string'), 'a string');
  assert.equal(describeThrown({ code: 5 }), '{"code":5}');
});
