import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { arrivedSignature, filingKey, jobsSignature } from '../signature.ts';
import type { DownloadJob } from '../types.ts';

const job = (id: string, more: Partial<DownloadJob> = {}): DownloadJob => ({
  id,
  video: { id: `video-${id}`, url: '', title: `Song ${id}`, channel: 'Somebody', thumbnail: null, duration: 100 },
  format: 'mp3', folder: 'Music', status: 'queued', progress: 0, trackId: null, error: null, described: false,
  ...more,
});
const place = { album: 'Meteora', title: 'Faint', artist: 'Linkin Park', track: 7, disc: null, year: 2003, genre: null };

describe('whether two readings of the queue are the same to look at', () => {
  const a = job('a');
  const b = job('b');

  it('is the same word for the same jobs read again', () => {
    assert.equal(jobsSignature([a, b], false), jobsSignature([{ ...a, video: { ...a.video } }, { ...b }], false));
  });

  it('is another word for anything a screen shows or goes by', () => {
    const before = jobsSignature([a, b], false);
    const differs = (jobs: DownloadJob[], paused = false) => assert.notEqual(jobsSignature(jobs, paused), before);
    differs([b, a]);
    differs([a]);
    differs([a, b], true);
    differs([{ ...a, status: 'downloading' }, b]);
    differs([{ ...a, progress: 1 }, b]);
    differs([{ ...a, status: 'done', trackId: '9' }, b]);
    differs([{ ...a, described: true }, b]);
    differs([{ ...a, cleared: true }, b]);
    differs([{ ...a, automatic: true }, b]);
    differs([{ ...a, startedAt: 5 }, b]);
    differs([{ ...a, finishedAt: 5 }, b]);
    differs([{ ...a, error: 'x', errorCode: 'ERR_YOUTUBE_NETWORK' }, b]);
    differs([{ ...a, error: 'x', errorText: 'y' }, b]);
    differs([{ ...a, video: { ...a.video, id: 'other' } }, b]);
    differs([{ ...a, video: { ...a.video, placement: place } }, b]);
    differs([{ ...a, video: { ...a.video, find: { query: 'q', artist: '', title: 't', durationSec: null } } }, b]);
  });
});

describe('what has arrived', () => {
  it('changes when a download lands, and not while one only moves', () => {
    const waiting = job('a');
    const done = job('b', { status: 'done', trackId: '4' });
    const before = arrivedSignature([waiting, done]);
    assert.equal(arrivedSignature([{ ...waiting, status: 'downloading', progress: 60 }, done]), before);
    assert.equal(arrivedSignature([{ ...done, cleared: true }, waiting]), before);
    assert.notEqual(arrivedSignature([{ ...waiting, status: 'done', trackId: '5' }, done]), before);
    assert.notEqual(arrivedSignature([waiting, { ...done, status: 'missing', trackId: null }]), before);
  });
});

describe('what a filed job is remembered by', () => {
  it('is not the same once the job has been handed a place on a record', () => {
    const had = job('a', { status: 'done', trackId: '4' });
    const placed = { ...had, video: { ...had.video, placement: place } };
    assert.notEqual(filingKey(placed), filingKey(had));
    assert.equal(filingKey(placed), filingKey({ ...placed, progress: 100, video: { ...placed.video } }));
    assert.notEqual(filingKey(placed), filingKey({ ...placed, id: 'b' }));
  });
});
