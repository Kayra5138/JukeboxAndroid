import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stringsFor } from '../../i18n/languages.ts';
import { durationLabel, isActive, jobForVideo, statusLabel, type DownloadJob } from '../types.ts';

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

describe('what a download is doing, in words', () => {
  it('is said in English', () => {
    assert.equal(statusLabel({ ...job('downloading'), progress: 42 }), 'Downloading · 42%');
    assert.equal(statusLabel(job('done')), 'In library');
    assert.equal(statusLabel(job('missing')), 'File removed');
  });
  it('is said in Turkish when that is the language', () => {
    const tr = stringsFor('tr');
    assert.equal(statusLabel({ ...job('downloading'), progress: 42 }, tr), 'İndiriliyor · %42');
    assert.equal(statusLabel(job('done'), tr), 'Kütüphanede');
  });
});
