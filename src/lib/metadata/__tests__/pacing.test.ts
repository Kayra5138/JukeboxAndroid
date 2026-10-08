import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pacer } from '../http.ts';
import { fakeClock } from './support.ts';

describe('pacer', () => {
  it('lets the first caller straight through', async () => {
    const clock = fakeClock();
    const turn = pacer(1_000, clock);

    await clock.run(turn());

    assert.equal(clock.now(), 0);
  });

  it('keeps callers that arrive together a full interval apart', async () => {
    // Reading the clock and then sleeping let all of these go at once: each
    // saw the same wait. A moment has to be reserved before it is waited for.
    const clock = fakeClock();
    const turn = pacer(1_000, clock);
    const went: number[] = [];

    await clock.run(
      Promise.all([1, 2, 3, 4].map(() => turn().then(() => void went.push(clock.now()))))
    );

    assert.deepEqual(went, [0, 1_000, 2_000, 3_000]);
  });

  it('does not make a caller wait for time that has already gone by', async () => {
    const clock = fakeClock();
    const turn = pacer(1_000, clock);

    await clock.run(
      (async () => {
        await turn();
        await clock.sleep(5_000);
        await turn();
      })()
    );

    assert.equal(clock.now(), 5_000);
  });

  it('keeps the interval after a timer that fired late', async () => {
    // Three in line, and the phone was away while the second waited: it wakes
    // at five seconds instead of at 1.4. The third is not owed the moment it
    // was first due, which is long past, but a full interval after the second.
    const clock = fakeClock();
    const turn = pacer(1_400, clock);
    const went: number[] = [];
    clock.wakeLate(3_600);

    await clock.run(
      Promise.all([1, 2, 3].map(() => turn().then(() => void went.push(clock.now()))))
    );

    assert.deepEqual(went, [0, 5_000, 6_400]);
  });

  it('charges the next caller nothing for one who was stopped while waiting', async () => {
    const clock = fakeClock();
    const turn = pacer(1_000, clock);
    const stopped = new AbortController();
    const went: number[] = [];

    await clock.run(
      (async () => {
        await turn();
        const given = turn(stopped.signal).then(
          () => 'went',
          (error: Error) => error.name
        );
        const behind = turn().then(() => void went.push(clock.now()));
        stopped.abort();
        assert.equal(await given, 'AbortError');
        await behind;
      })()
    );

    // One interval after the first, not two: the place in between was given up.
    assert.deepEqual(went, [1_000]);
  });

  it('tells a stopped caller at once, wherever it stood in the line', async () => {
    const clock = fakeClock();
    const turn = pacer(1_000, clock);
    const stopped = new AbortController();

    await clock.run(
      (async () => {
        await turn();
        const ahead = turn();
        const last = turn(stopped.signal);
        stopped.abort();
        await assert.rejects(last, { name: 'AbortError' });
        // Told before the one ahead of it had even been let go.
        assert.equal(clock.now(), 0);
        await ahead;
      })()
    );
  });

  it('counts each service’s interval on its own', async () => {
    const clock = fakeClock();
    const slow = pacer(3_500, clock);
    const fast = pacer(1_400, clock);
    const went: [string, number][] = [];
    const ask = (name: string, turn: () => Promise<void>) =>
      turn().then(() => void went.push([name, clock.now()]));

    await clock.run(
      Promise.all([ask('slow', slow), ask('fast', fast), ask('slow', slow), ask('fast', fast)])
    );

    assert.deepEqual(
      went.sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0])),
      [['fast', 0], ['slow', 0], ['fast', 1_400], ['slow', 3_500]]
    );
  });
});
