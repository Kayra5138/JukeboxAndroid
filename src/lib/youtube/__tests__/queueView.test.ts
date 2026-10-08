import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afterMove,
  dropOf,
  AUTOMATIC_REACH_MS,
  batchOf,
  canCancel,
  canMove,
  canRetry,
  historyOf,
  inOrder,
  listOf,
  namesOf,
  queueOf,
  RUN_GRACE_MS,
  RUN_LINGER_MS,
  sameJob,
  sourceOf,
  tallyOf,
} from '../queueView.ts';
import type { DownloadJob } from '../types.ts';

const MIN = 60_000;
const NOW = 1_800_000_000_000;

const job = (id: string, status: DownloadJob['status'], more: Partial<DownloadJob> = {}): DownloadJob => ({
  id,
  video: { id, title: id, url: '', channel: 'Channel', thumbnail: null, duration: null },
  trackId: null,
  status,
  format: 'mp3',
  folder: 'Music',
  progress: 0,
  error: null,
  described: false,
  ...more,
});
const ids = (jobs: DownloadJob[]) => jobs.map((entry) => entry.id);

test('the queue is what is under way, then what was asked for, then Discover’s own', () => {
  const all = [
    job('auto', 'queued', { automatic: true, discoverKey: 'k' }),
    job('b', 'queued'),
    job('done', 'done'),
    job('finding', 'finding'),
    job('c', 'queued'),
    job('a', 'downloading'),
    job('leaving', 'cancelling'),
  ];
  assert.deepEqual(ids(queueOf(all)), ['finding', 'a', 'leaving', 'b', 'c', 'auto']);
});

test('a build that says nothing of automatic jobs has none, and nothing breaks', () => {
  const all = [job('a', 'queued', { discoverKey: 'k' }), job('b', 'queued')];
  assert.deepEqual(ids(queueOf(all)), ['a', 'b']);
  assert.equal(canMove(all[0]!), true);
  assert.deepEqual(batchOf(all, NOW).waiting, 2);
});

test('history is newest first, the undated after the dated, the cleared not at all', () => {
  const all = [
    job('old', 'done'),
    job('early', 'failed', { finishedAt: NOW - 9 * MIN }),
    job('gone', 'done', { finishedAt: NOW, cleared: true }),
    job('late', 'cancelled', { finishedAt: NOW - MIN }),
    job('older', 'missing'),
    job('busy', 'downloading'),
  ];
  assert.deepEqual(ids(historyOf(all)), ['late', 'early', 'old', 'older']);
});

test('where a download came from', () => {
  const placement = { album: 'Blue', title: 'River', artist: 'Joni', track: 7, disc: null, year: null, genre: null };
  const video = job('x', 'queued').video;
  assert.deepEqual(sourceOf(job('a', 'queued')), { kind: 'search' });
  assert.deepEqual(sourceOf(job('a', 'queued', { video: { ...video, sourcePlaylist: { id: 'p', name: 'Mix' } } })), { kind: 'playlist', name: 'Mix' });
  assert.deepEqual(sourceOf(job('a', 'queued', { video: { ...video, placement, sourcePlaylist: { id: 'p', name: 'Mix' } } })), { kind: 'album', name: 'Blue' });
  assert.deepEqual(sourceOf(job('a', 'queued', { discoverKey: 'k', video: { ...video, placement } })), { kind: 'discover' });
  // An empty key is still Discover's; only null and absent are not.
  assert.deepEqual(sourceOf(job('a', 'queued', { discoverKey: null })), { kind: 'search' });
  // What comes back from the phone is not always what was sent.
  assert.deepEqual(sourceOf(job('a', 'queued', { video: { ...video, placement: { album: 5 } as never } })), { kind: 'search' });
});

test('a job is called what its file will be tagged as', () => {
  const video = job('x', 'queued').video;
  assert.deepEqual(namesOf(job('a', 'queued')), { title: 'a', artist: 'Channel' });
  assert.deepEqual(
    namesOf(job('a', 'queued', { video: { ...video, discoveryTitle: 'River', discoveryArtist: 'Joni Mitchell' } })),
    { title: 'River', artist: 'Joni Mitchell' }
  );
  assert.deepEqual(
    namesOf(job('a', 'queued', { video: { ...video, placement: { album: 'Blue', title: 'River', artist: null, track: 7, disc: null, year: null, genre: null } } })),
    { title: 'River', artist: 'Channel' }
  );
});

test('what can be done to a job follows from where it has got to', () => {
  assert.equal(canMove(job('a', 'queued')), true);
  assert.equal(canMove(job('a', 'queued', { automatic: true })), false);
  assert.equal(canMove(job('a', 'finding')), false);
  assert.equal(canMove(job('a', 'downloading')), false);
  assert.equal(canRetry(job('a', 'failed')), true);
  assert.equal(canRetry(job('a', 'cancelled')), true);
  assert.equal(canRetry(job('a', 'missing')), false);
  assert.equal(canRetry(job('a', 'done')), false);
  assert.equal(canCancel(job('a', 'queued')), true);
  assert.equal(canCancel(job('a', 'finding')), true);
  assert.equal(canCancel(job('a', 'saving')), false);
  assert.equal(canCancel(job('a', 'cancelling')), false);
  assert.equal(canCancel(job('a', 'done')), false);
});

test('the tally counts the automatic ones among the waiting', () => {
  const all = [job('a', 'downloading'), job('b', 'queued'), job('c', 'queued', { automatic: true }), job('d', 'done')];
  assert.deepEqual(tallyOf(all), { underWay: 1, waiting: 2, automatic: 1 });
});

test('no jobs, no run', () => {
  assert.equal(batchOf([], NOW).total, 0);
  assert.equal(batchOf([], NOW).current, null);
});

test('a run is everything asked for since the queue last stood empty', () => {
  const all = [
    // This morning: over long ago.
    job('m1', 'done', { createdAt: NOW - 300 * MIN, finishedAt: NOW - 298 * MIN }),
    job('m2', 'failed', { createdAt: NOW - 299 * MIN, finishedAt: NOW - 297 * MIN }),
    // Now: three asked for together, one done, one failed, one going, and one added since.
    job('a', 'done', { createdAt: NOW - 6 * MIN, finishedAt: NOW - 4 * MIN }),
    job('b', 'failed', { createdAt: NOW - 6 * MIN, finishedAt: NOW - 3 * MIN }),
    job('c', 'downloading', { createdAt: NOW - 6 * MIN, progress: 40 }),
    job('d', 'queued', { createdAt: NOW - MIN }),
  ];
  const batch = batchOf(all, NOW);
  assert.equal(batch.current?.id, 'c');
  assert.deepEqual(
    { underWay: batch.underWay, waiting: batch.waiting, done: batch.done, failed: batch.failed, total: batch.total, endedAt: batch.endedAt },
    { underWay: 1, waiting: 1, done: 1, failed: 1, total: 4, endedAt: null }
  );
});

test('jobs that adjoin within the grace are one run, and beyond it two', () => {
  const first = job('a', 'done', { createdAt: NOW - 10 * MIN, finishedAt: NOW - 8 * MIN });
  const near = job('b', 'done', { createdAt: NOW - 8 * MIN + RUN_GRACE_MS, finishedAt: NOW - MIN });
  const far = job('b', 'done', { createdAt: NOW - 8 * MIN + RUN_GRACE_MS + 1, finishedAt: NOW - MIN });
  assert.equal(batchOf([first, near], NOW).done, 2);
  assert.equal(batchOf([first, far], NOW).done, 1);
});

test('a run that has ended is spoken of for a few minutes and then not', () => {
  const all = [
    job('a', 'done', { createdAt: NOW - 20 * MIN, finishedAt: NOW - 19 * MIN }),
    job('b', 'cancelled', { createdAt: NOW - 20 * MIN, finishedAt: NOW - 18 * MIN }),
  ];
  const ended = NOW - 18 * MIN;
  const fresh = batchOf(all, ended + RUN_LINGER_MS);
  assert.deepEqual({ done: fresh.done, total: fresh.total, endedAt: fresh.endedAt, current: fresh.current }, { done: 1, total: 2, endedAt: ended, current: null });
  assert.equal(batchOf(all, ended + RUN_LINGER_MS + 1).total, 0);
});

test('a job with no times counts while it is going and not once it is finished', () => {
  const all = [job('old', 'done'), job('older', 'failed'), job('going', 'converting')];
  const batch = batchOf(all, NOW);
  assert.deepEqual({ total: batch.total, done: batch.done, failed: batch.failed, current: batch.current?.id }, { total: 1, done: 0, failed: 0, current: 'going' });
  assert.equal(batchOf([job('old', 'done'), job('older', 'failed')], NOW).total, 0);
});

test('what has been cleared is no longer counted', () => {
  const all = [
    job('a', 'done', { createdAt: NOW - 3 * MIN, finishedAt: NOW - 2 * MIN, cleared: true }),
    job('b', 'done', { createdAt: NOW - 3 * MIN, finishedAt: NOW - MIN }),
  ];
  assert.equal(batchOf(all, NOW).done, 1);
});

test('one of Discover’s own that has waited for days does not join those days into a run', () => {
  const days = 3 * 24 * 60 * MIN;
  const all = [
    job('monday', 'done', { createdAt: NOW - days + MIN, finishedAt: NOW - days + 2 * MIN }),
    job('waited', 'done', { automatic: true, createdAt: NOW - days, finishedAt: NOW - MIN }),
    job('going', 'downloading', { automatic: true, createdAt: NOW - days }),
    job('waiting', 'queued', { automatic: true, createdAt: NOW - days }),
  ];
  const batch = batchOf(all, NOW);
  assert.deepEqual({ total: batch.total, done: batch.done, waiting: batch.waiting, current: batch.current?.id }, { total: 3, done: 1, waiting: 1, current: 'going' });
  // And one made a moment ago is counted from when it was made, not from before.
  const recent = job('new', 'done', { automatic: true, createdAt: NOW - MIN, finishedAt: NOW });
  const before = job('before', 'done', { createdAt: NOW - AUTOMATIC_REACH_MS, finishedAt: NOW - AUTOMATIC_REACH_MS + MIN });
  assert.equal(batchOf([before, recent], NOW).total, 1);
});

test('only an automatic job waiting is a run of that one job', () => {
  const all = [
    job('a', 'done', { createdAt: NOW - 60 * MIN, finishedAt: NOW - 59 * MIN }),
    job('auto', 'queued', { automatic: true, createdAt: NOW - 60 * MIN }),
  ];
  const batch = batchOf(all, NOW);
  assert.deepEqual({ total: batch.total, waiting: batch.waiting, done: batch.done }, { total: 1, waiting: 1, done: 0 });
});

test('the screen is one list, with a heading only over what is there', () => {
  assert.deepEqual(listOf([]).items, []);
  const all = [
    job('h', 'done', { finishedAt: NOW }),
    job('auto', 'queued', { automatic: true }),
    job('b', 'queued'),
    job('a', 'downloading'),
    job('c', 'queued'),
  ];
  const { items, movable } = listOf(all);
  assert.deepEqual(items.map((item) => item.key), ['heading:now', 'now:a', 'heading:next', 'b', 'c', 'auto', 'heading:history', 'h']);
  assert.deepEqual(movable, { first: 3, count: 2 });
  assert.deepEqual(items.filter((item) => item.kind === 'waiting').map((item) => item.kind === 'waiting' && item.next), [true, false, false]);
  // Nothing under way and nothing by hand: the automatic one is next, and nothing can be dragged.
  const idle = listOf([job('auto', 'queued', { automatic: true })]);
  assert.deepEqual(idle.items.map((item) => item.key), ['heading:next', 'auto']);
  assert.deepEqual(idle.movable, { first: 1, count: 0 });
});

test('a drag is shown at once, and a job asked for since goes after', () => {
  const all = [job('a', 'queued'), job('b', 'queued'), job('c', 'queued'), job('new', 'queued')];
  const order = afterMove(['a', 'b', 'c'], 2, 0);
  assert.deepEqual(order, ['c', 'a', 'b']);
  assert.deepEqual(listOf(all, order).items.map((item) => item.key), ['heading:next', 'c', 'a', 'b', 'new']);
  assert.deepEqual(ids(inOrder(all, ['gone', 'b'])), ['b', 'a', 'c', 'new']);
  assert.deepEqual(afterMove(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(afterMove(['a', 'b', 'c'], 5, 0), ['a', 'b', 'c']);
});

test('a job read again is the same job until something it shows has changed', () => {
  const a = job('a', 'downloading', { progress: 10 });
  assert.equal(sameJob(a, { ...a, video: { ...a.video } }), true);
  assert.equal(sameJob(a, { ...a, progress: 11 }), false);
  assert.equal(sameJob(a, { ...a, status: 'converting' }), false);
  assert.equal(sameJob(a, { ...a, errorText: 'No connection' }), false);
  assert.equal(sameJob(a, { ...a, video: { ...a.video, thumbnail: 'https://i/1.jpg' } }), false);
});

test('a drop is told to the phone as the job it now stands before', () => {
  const ids = ['a', 'b', 'c', 'd'];
  // Up: before the one whose place it took.
  assert.deepEqual(dropOf(ids, 2, 0), { id: 'c', beforeId: 'a', order: ['c', 'a', 'b', 'd'] });
  // Down: before the one after where it landed, which is not the one that was there.
  assert.deepEqual(dropOf(ids, 0, 2), { id: 'a', beforeId: 'd', order: ['b', 'c', 'a', 'd'] });
  assert.deepEqual(dropOf(ids, 1, 2), { id: 'b', beforeId: 'd', order: ['a', 'c', 'b', 'd'] });
  // Last: the end, which the phone takes to be the end of what was asked for.
  assert.deepEqual(dropOf(ids, 0, 3), { id: 'a', beforeId: null, order: ['b', 'c', 'd', 'a'] });
});

test('a row put back where it was, or dropped nowhere, tells the phone nothing', () => {
  const ids = ['a', 'b', 'c'];
  assert.equal(dropOf(ids, 1, 1), null);
  assert.equal(dropOf(ids, 1, -1), null);
  assert.equal(dropOf(ids, 1, 3), null);
  assert.equal(dropOf(ids, 7, 0), null);
  assert.equal(dropOf([], 0, 0), null);
});
