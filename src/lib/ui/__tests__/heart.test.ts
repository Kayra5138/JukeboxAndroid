import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flightsOf, GLORY_AT, moodOf, NO_RUN, pressed, RUN_GAP_MS, type Run } from '../heart.ts';

const run = (presses: number, gap = 100): Run => {
  let made = NO_RUN;
  for (let index = 0; index < presses; index += 1) made = pressed(made, 1_000 + index * gap);
  return made;
};
const half = () => 0.5;

test('presses close together are one run, and a pause begins another', () => {
  assert.equal(run(5).count, 5);
  assert.equal(pressed(run(5), run(5).at + RUN_GAP_MS).count, 6);
  assert.equal(pressed(run(5), run(5).at + RUN_GAP_MS + 1).count, 1);
  assert.equal(run(5, RUN_GAP_MS + 1).count, 1);
});

test('a run earns more the longer it goes on', () => {
  assert.deepEqual([1, 3, 4, 8, 9, 15, 16, 29].map((count) => moodOf(run(count))), [
    'one', 'one', 'flurry', 'flurry', 'storm', 'storm', 'frenzy', 'frenzy',
  ]);
  const counts = [1, 4, 9, 17].map((count) => flightsOf(run(count), half).length);
  assert.deepEqual(counts, [1, 3, 6, 9]);
});

test('one press is one heart, nearly straight up', () => {
  const [only] = flightsOf(run(1), () => 1);
  assert.ok(Math.abs(only.drift) <= 0.18 && Math.abs(only.turn) <= 18 && only.wait === 0 && !only.swell);
});

test('at its height every fourth press adds a heart that swells where it is', () => {
  assert.ok(flightsOf(run(16), half).some((flight) => flight.swell));
  assert.ok(!flightsOf(run(17), half).some((flight) => flight.swell));
  assert.ok(!flightsOf(run(12), half).some((flight) => flight.swell));
});

test('no two hearts share a key, within a press or across a run', () => {
  const keys = [run(15), run(16), run(17)].flatMap((made) => flightsOf(made, half).map((flight) => flight.key));
  assert.equal(new Set(keys).size, keys.length);
});

test('kept up for some seconds, it is the whole screen: a shower at the press that gets there, and more at each after', () => {
  assert.equal(moodOf(run(GLORY_AT - 1)), 'frenzy');
  assert.equal(moodOf(run(GLORY_AT)), 'glory');
  const first = flightsOf(run(GLORY_AT), Math.random);
  const next = flightsOf(run(GLORY_AT + 1), Math.random);
  const anywhere = (flights: typeof first) => flights.filter((flight) => flight.at != null);
  assert.ok(anywhere(first).length >= 60);
  assert.ok(anywhere(next).length >= 10 && anywhere(next).length < anywhere(first).length);
  assert.ok(anywhere(first).some((flight) => flight.spark) && anywhere(first).some((flight) => !flight.spark));
  for (const flight of anywhere(first)) assert.ok(flight.at!.x >= 0 && flight.at!.x <= 1 && flight.at!.y >= 0 && flight.at!.y <= 1);
  // The button still sends its own up, and nothing below this height is placed by the screen.
  assert.ok(first.some((flight) => flight.at == null && !flight.swell));
  assert.ok(!anywhere(flightsOf(run(GLORY_AT - 1), Math.random)).length);
  // A heart wears the mood it was let go in.
  assert.ok(first.every((flight) => flight.mood === 'glory'));
});
