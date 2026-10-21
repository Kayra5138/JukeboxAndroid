import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { pause, scheduleWith, sleep, type Scheduler } from '../http.ts';

/**
 * Every wait goes through the scheduler the app hands over, so that a wait
 * kept natively goes on behind the screen; and nothing is left waiting on it
 * once the caller has stopped.
 */

/** A scheduler that runs nothing until told, and writes down what it was asked. */
function byHand() {
  const asked: { ms: number; then: () => void; cancelled: boolean }[] = [];
  const scheduler: Scheduler = (ms, then) => {
    const entry = { ms, then, cancelled: false };
    asked.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  return { asked, scheduler };
}

afterEach(() => scheduleWith(null));

test('a sleep and a pause wait on the scheduler handed over', async () => {
  const { asked, scheduler } = byHand();
  scheduleWith(scheduler);
  let slept = false;
  const sleeping = sleep(1_400).then(() => {
    slept = true;
  });
  const pausing = pause(60_000);
  assert.deepEqual(asked.map((entry) => entry.ms), [1_400, 60_000]);
  await Promise.resolve();
  assert.equal(slept, false);
  for (const entry of asked) entry.then();
  await sleeping;
  await pausing;
  assert.equal(slept, true);
});

test('a wait that is stopped calls its scheduled end off', async () => {
  const { asked, scheduler } = byHand();
  scheduleWith(scheduler);
  const halt = new AbortController();
  const sleeping = sleep(1_000, halt.signal);
  const pausing = pause(1_000, halt.signal);
  halt.abort();
  await assert.rejects(sleeping, { name: 'AbortError' });
  await pausing;
  assert.deepEqual(asked.map((entry) => entry.cancelled), [true, true]);
});

test('without one, the waits are timers again', async () => {
  const { asked, scheduler } = byHand();
  scheduleWith(scheduler);
  scheduleWith(null);
  await sleep(1);
  assert.equal(asked.length, 0);
});
