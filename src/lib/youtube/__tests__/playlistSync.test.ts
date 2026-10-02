import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePlaylist } from '../playlistSync.ts';
import type { DownloadJob } from '../types.ts';
const job = (id: string, trackId: string | null, status: DownloadJob['status'] = 'done'): DownloadJob => ({
  id, video: { id, title: id, url: '', channel: '', thumbnail: null, duration: null },
  trackId, status, format: 'mp3', folder: 'Music', progress: 100, error: null, described: false,
});
test('completed downloads and existing files enter in source order', () => {
  const result = reconcilePlaylist([{ videoId: 'a' }, { videoId: 'b' }], [], [job('b', '2'), job('a', '1')]);
  assert.deepEqual(result.order, ['1', '2']);
});
test('late completions go before already downloaded later songs', () => {
  const initial = reconcilePlaylist([{ videoId: 'a' }, { videoId: 'b' }], [], [job('a', null, 'downloading'), job('b', '2')]);
  const next = reconcilePlaylist(initial.receipts, initial.order, [job('a', '1'), job('b', '2')]);
  assert.deepEqual(next.order, ['1', '2']);
});
test('polling and reopening do not duplicate songs or undo manual removals', () => {
  const initial = reconcilePlaylist([{ videoId: 'a' }], [], [job('a', '1')]);
  assert.equal(reconcilePlaylist(initial.receipts, initial.order, [job('a', '1')]).changed, false);
  assert.deepEqual(reconcilePlaylist(initial.receipts, [], [job('a', '1')]).order, []);
});
test('failed/cancelled jobs wait for successful retry and existing membership is reused', () => {
  const initial = reconcilePlaylist([{ videoId: 'a' }, { videoId: 'b' }], ['manual', '1'], [job('a', '1'), job('b', null, 'failed')]);
  assert.deepEqual(initial.order, ['manual', '1']);
  const next = reconcilePlaylist(initial.receipts, initial.order, [job('a', '1'), job('b', '2')]);
  assert.deepEqual(next.order, ['manual', '1', '2']);
});
