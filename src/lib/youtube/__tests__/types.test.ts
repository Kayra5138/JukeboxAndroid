import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { durationLabel, isActive, jobForVideo, type DownloadJob } from '../types.ts';

function job(status: DownloadJob['status'], id = 'job'): DownloadJob {
  return { id, status, video: { id: 'BaW_jenozKc', title: 'Track', channel: 'Channel', url: 'https://www.youtube.com/watch?v=BaW_jenozKc', duration: null, thumbnail: null }, format: 'mp3', folder: 'Music', progress: 0, trackId: null, error: null, described: false };
}

describe('YouTube download receipts', () => {
  it('keeps completed and active downloads locked even when another attempt failed', () => {
    const done = job('done', 'done');
    const downloading = job('downloading', 'active');
    assert.equal(jobForVideo([job('failed'), done], 'BaW_jenozKc'), done);
    assert.equal(jobForVideo([job('cancelled'), downloading], 'BaW_jenozKc'), downloading);
  });
  it('allows retry for a deleted file and does not confuse different videos', () => {
    assert.equal(isActive(job('missing')), false);
    assert.equal(jobForVideo([job('done')], 'different'), undefined);
  });
  it('keeps polling through conversion, publication and cancellation', () => {
    for (const state of ['queued', 'preparing', 'downloading', 'converting', 'saving', 'cancelling'] as const) assert.equal(isActive(job(state)), true);
    for (const state of ['done', 'failed', 'cancelled', 'missing'] as const) assert.equal(isActive(job(state)), false);
  });
});

describe('YouTube durations', () => {
  it('handles missing values and hour-long recordings', () => {
    assert.equal(durationLabel(null), '');
    assert.equal(durationLabel(NaN), '');
    assert.equal(durationLabel(241.8), '4:01');
    assert.equal(durationLabel(3661), '1:01:01');
  });
});
