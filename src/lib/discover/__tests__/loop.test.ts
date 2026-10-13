import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoop } from '../loop.ts';
import { EMPTY, initial, reduce, unwritten, type Effect, type Event, type Song, type State } from '../core.ts';
import { DEFAULT_SETTINGS } from '../policy.ts';

/*
  The handle the engine turns, with a store, a clock and things-to-do that
  are whatever each test says. The first half is the turning alone, on a
  state that is a number; the second is Discover's own deciding put through
  it, for what is written down and when.
*/

type Counted = { count: number };
type Step = { add: number } | { fail: true } | { again: number };

function counting(over: Partial<Parameters<typeof createLoop<Counted, Step, string>>[0]> = {}) {
  const written: number[] = [];
  const ran: string[] = [];
  const warned: unknown[] = [];
  const loop = createLoop<Counted, Step, string>({
    boot: () => ({ count: 0 }),
    reduce: (state, step) => {
      if ('fail' in step) throw new Error('could not be decided');
      if ('again' in step) return { state, effects: [`again:${step.again}`] };
      return step.add ? { state: { count: state.count + step.add }, effects: [`added:${step.add}`] } : { state, effects: [] };
    },
    persist: (state) => { written.push(state.count); },
    run: (effect) => { ran.push(effect); },
    now: () => 0,
    warn: (error) => { warned.push(error); },
    ...over,
  });
  return { loop, written, ran, warned };
}

test('an event that cannot be taken is dropped, and the ones after it are taken', () => {
  const { loop, warned } = counting();
  loop.dispatch({ add: 1 });
  loop.dispatch({ fail: true });
  assert.equal(warned.length, 1);
  // Not left as "an event is being taken", with everything after it put in a queue nobody reads.
  loop.dispatch({ add: 2 });
  assert.equal(loop.state().count, 3);
});

test('a watcher that throws does not keep the others from being told, or the things from being done', () => {
  const { loop, ran, warned } = counting();
  const told: string[] = [];
  loop.subscribe(() => { told.push('first'); });
  loop.subscribe(() => { throw new Error('a screen fell over'); });
  loop.subscribe(() => { told.push('third'); });
  loop.dispatch({ add: 1 });
  assert.deepEqual(told, ['first', 'third']);
  assert.deepEqual(ran, ['added:1']);
  assert.equal(warned.length, 1);
  loop.dispatch({ add: 1 });
  assert.deepEqual(told, ['first', 'third', 'first', 'third']);
  assert.equal(loop.state().count, 2);
});

test('an event sent from a watcher, or from a thing being done, waits its turn and is then taken', () => {
  const order: string[] = [];
  const { loop } = counting({
    run: (effect) => {
      order.push(effect);
      if (effect === 'added:1') loop.dispatch({ add: 10 });
    },
  });
  let sent = false;
  loop.subscribe(() => {
    order.push(`told:${loop.state().count}`);
    if (!sent) { sent = true; loop.dispatch({ add: 100 }); }
  });
  loop.dispatch({ add: 1 });
  assert.equal(loop.state().count, 111);
  assert.deepEqual(order, ['told:1', 'told:101', 'added:100', 'added:1', 'told:111', 'added:10']);
});

test('one thing that cannot be done does not keep the rest from being done', () => {
  const done: string[] = [];
  const { loop, warned } = counting({
    reduce: (state) => ({ state: { count: state.count + 1 }, effects: ['one', 'two', 'three'] }),
    run: (effect) => {
      if (effect === 'two') throw new Error('the phone said no');
      done.push(effect);
    },
  });
  loop.dispatch({ add: 1 });
  assert.deepEqual(done, ['one', 'three']);
  assert.equal(warned.length, 1);
});

test('the state is written when it is a different state, and a write that fails is made again with the next', () => {
  let refuse = true;
  const pairs: [number, number][] = [];
  const { loop, warned } = counting({
    persist: (state, was) => {
      if (refuse) throw new Error('disk full');
      pairs.push([state.count, was.count]);
    },
  });
  let told = 0;
  loop.subscribe(() => { told += 1; });
  loop.dispatch({ add: 0 });
  loop.dispatch({ again: 1 });
  // Nothing changed: nothing written, nobody told.
  assert.equal(warned.length, 0);
  assert.equal(told, 0);
  loop.dispatch({ add: 1 });
  assert.equal(warned.length, 1);
  assert.equal(told, 1);
  refuse = false;
  loop.dispatch({ add: 1 });
  // Compared with what was last written, which is still the start: nothing of the first change is lost.
  assert.deepEqual(pairs, [[2, 0]]);
  loop.dispatch({ add: 1 });
  assert.deepEqual(pairs, [[2, 0], [3, 2]]);
});

test('a start that fails leaves nothing waiting, and is tried again the next time', () => {
  let fail = true;
  const { loop, warned } = counting({
    boot: () => {
      if (fail) throw new Error('no database yet');
      return { count: 5 };
    },
  });
  loop.dispatch({ add: 1 });
  assert.equal(warned.length, 1);
  assert.equal(loop.peek(), null);
  fail = false;
  loop.dispatch({ add: 1 });
  assert.equal(loop.state().count, 6);
});

test('what was so before anything was asked is taken first', () => {
  const { loop } = counting({ first: () => [{ add: 40 }] });
  const seen: number[] = [];
  loop.subscribe(() => { seen.push(loop.state().count); });
  loop.dispatch({ add: 2 });
  assert.equal(loop.state().count, 42);
});

const song = (n: number): Song => ({
  recordingMbid: `recording-${n}`, title: `Song ${n}`, artist: `Artist ${n}`, artistMbid: `artist-${n}`, release: null,
  coverUrl: null, because: 'Seed', familiar: n % 2 === 0, score: 100 - n,
});

test('Discover writes its list when the list changes, its pool when the catalogue answers, and nothing for a percentage', () => {
  let now = 1_000_000_000_000;
  const wrote: string[] = [];
  const pool = Array.from({ length: 30 }, (_, n) => song(n));
  const loop = createLoop<State, Event, Effect>({
    boot: () => initial({ ...EMPTY, attemptAt: now }, { ...DEFAULT_SETTINGS, count: 6, ready: 0 }),
    reduce,
    persist: (state, was) => {
      const changed = unwritten(state, was);
      for (const piece of ['list', 'pool', 'settings'] as const) if (changed[piece]) wrote.push(piece);
    },
    run: () => {},
    now: () => now,
  });
  const written = () => wrote.splice(0).sort();

  loop.dispatch({ type: 'jobs', jobs: [], paused: false });
  assert.deepEqual(written(), []);
  loop.dispatch({ type: 'built', refresh: false, pool });
  assert.deepEqual(written(), ['list', 'pool']);

  const a = loop.state().list[0].id;
  loop.dispatch({ type: 'play', id: a });
  // Tapped: the row is a person's now, which is part of the list. The pool is not touched again.
  assert.deepEqual(written(), ['list']);
  loop.dispatch({ type: 'asked', id: a, jobId: 'job-a' });
  assert.deepEqual(written(), ['list']);
  const job = (progress: number) => ({
    id: 'job-a', discoverKey: a, status: 'downloading' as const, progress, trackId: null, error: null, described: false,
    format: 'original' as const, folder: 'Music', video: { id: 'v', url: '', title: '', channel: '', thumbnail: null, duration: null },
  });
  let told = 0;
  loop.subscribe(() => { told += 1; });
  for (let percent = 1; percent <= 60; percent++) {
    now += 1_000;
    loop.dispatch({ type: 'jobs', jobs: [job(percent)], paused: false });
  }
  // A minute of a download: the screen was told sixty times and the database not once.
  assert.equal(told, 60);
  assert.deepEqual(written(), []);
  loop.dispatch({ type: 'jobs', jobs: [job(60)], paused: false });
  assert.equal(told, 60);
  loop.dispatch({ type: 'settings', value: { ...loop.state().settings, refreshDays: 7 } });
  assert.deepEqual(written(), ['settings']);
});
