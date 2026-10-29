import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flyingOf, joinFlying, linesOf, wordsOf } from '../playerFun.ts';

test('the words are the song’s own, each once, and its name where it has none', () => {
  const lyrics = { plain: null, synced: '[00:01.00] Hello hello, world!\n[00:02.00]\n[00:03.00] World of words' };
  assert.deepEqual(linesOf(lyrics), ['Hello hello, world!', 'World of words']);
  assert.deepEqual(wordsOf(lyrics, 'Song', 'Artist'), ['Hello', 'world', 'of', 'words']);
  assert.deepEqual(wordsOf(null, 'Washing Machine Heart', 'Mitski'), ['Washing', 'Machine', 'Heart', 'Mitski']);
});

test('nothing flies from a press by itself, words from a run, and lines fall at its height', () => {
  const run = (count: number) => ({ count, at: 1000 });
  const half = () => 0.5;
  assert.equal(flyingOf(run(1), 'one', false, ['a'], ['line'], half).length, 0);
  assert.ok(flyingOf(run(10), 'flurry', false, ['a'], ['line'], half).every((one) => one.kind === 'rise'));
  const first = flyingOf(run(50), 'glory', true, ['a'], ['line'], half);
  const after = flyingOf(run(51), 'glory', false, ['a'], ['line'], half);
  assert.ok(first.filter((one) => one.kind === 'fall').length > after.filter((one) => one.kind === 'fall').length);
});

test('words on their way are kept when the screen is full, and the new ones let go', () => {
  const run = (count: number) => ({ count, at: 1000 });
  const half = () => 0.5;
  const now = flyingOf(run(50), 'glory', true, ['a'], ['line'], half);
  const more = flyingOf(run(51), 'glory', false, ['a'], ['line'], half);
  const joined = joinFlying(now, more, now.length + 2);
  assert.deepEqual(joined.slice(0, now.length), now);
  assert.equal(joined.length, now.length + 2);
  assert.deepEqual(joinFlying(now, more, now.length), now);
});
