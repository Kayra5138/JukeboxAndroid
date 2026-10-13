import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobsNow, publishJobs, readOnChange, readerPresent, standAsReader, watchJobs } from '../watch.ts';

test('whoever watches is told of each reading, and the last one is there for whoever comes late', () => {
  const seen: number[] = [];
  const stop = watchJobs((reading) => seen.push(reading.jobs.length));
  publishJobs({ jobs: [], paused: false });
  publishJobs({ jobs: [{} as never], paused: true });
  assert.deepEqual(seen, [0, 1]);
  assert.equal(jobsNow()?.paused, true);
  stop();
  publishJobs({ jobs: [], paused: false });
  assert.deepEqual(seen, [0, 1]);
});

test('somebody is reading for as long as anybody stands as the reader, and standing down twice is once', () => {
  assert.equal(readerPresent(), false);
  const first = standAsReader();
  const second = standAsReader();
  first(); first();
  assert.equal(readerPresent(), true);
  second();
  assert.equal(readerPresent(), false);
});

test('changes that come while the queue is being read are answered by one more reading, after it', async () => {
  let reads = 0;
  let release: (() => void)[] = [];
  const heard = readOnChange(() => new Promise<void>((resolve) => { reads += 1; release.push(resolve); }));
  heard(); heard(); heard();
  assert.equal(reads, 1);
  release.shift()!();
  await new Promise((resolve) => setImmediate(resolve));
  // Three changes, two readings: the one under way, and one that began after the last of them.
  assert.equal(reads, 2);
  release.shift()!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 2);
  // Quiet again, the next change is read for at once. A reading that fails does not stop the ones after it.
  const failing = readOnChange(() => { reads += 1; return Promise.reject(new Error('no phone')); });
  failing();
  await new Promise((resolve) => setImmediate(resolve));
  failing();
  assert.equal(reads, 4);
});
