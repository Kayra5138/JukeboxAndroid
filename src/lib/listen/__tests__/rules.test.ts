import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DownloadJob } from '../../youtube/types.ts';
import { isListened, listenDue, listenJobOf } from '../rules.ts';

const JOB = '0f8c7a52-2d7e-4a0b-9a6e-3c1f0d9b8e21';
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

const job = (id: string, extra: Partial<DownloadJob> & { listen?: boolean } = {}): DownloadJob =>
  ({
    id,
    status: 'done',
    progress: 100,
    trackId: `listen:${id}`,
    format: 'original',
    finishedAt: NOW - 10 * DAY,
    discoverKey: '11111111-2222-3333-4444-555555555555',
    video: { id: 'v', url: 'https://www.youtube.com/watch?v=v', title: 't', channel: 'c', thumbnail: null, duration: 100, listen: extra.listen ?? true },
    ...extra,
  }) as DownloadJob;

describe('a song listened to without keeping it', () => {
  it('is known by its job', () => {
    assert.equal(isListened(`listen:${JOB}`), true);
    assert.equal(isListened(`discover:${JOB}`), false);
    assert.equal(isListened('123'), false);
    assert.equal(listenJobOf(`listen:${JOB}`), JOB);
    assert.equal(listenJobOf('listen:../../etc'), null);
    assert.equal(listenJobOf('123'), null);
  });

  it('is let go of once it has stayed its days, and only once it came in', () => {
    const jobs = [
      job('old'),
      job('new', { finishedAt: NOW - 2 * DAY }),
      job('coming', { status: 'downloading', finishedAt: null }),
      job('failed', { status: 'failed' }),
      job('discovers', { listen: false }),
    ];
    assert.deepEqual(listenDue(jobs, 7, NOW), ['old']);
    assert.deepEqual(listenDue(jobs, 1, NOW), ['old', 'new']);
  });
});
