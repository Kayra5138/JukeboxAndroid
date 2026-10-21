import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTips, decideTips, parseTips, USED_AFTER, type TipsDeps } from '../tips.ts';

/** A settings row, and a history of [listened] plays and skips. */
const place = (listened: number | (() => number), words: string | null = null) => {
  const kept = { words, writes: 0 };
  const deps: TipsDeps = {
    read: () => kept.words,
    write: (next) => {
      kept.words = next;
      kept.writes += 1;
    },
    listened: typeof listened === 'function' ? listened : () => listened,
  };
  return { kept, tips: createTips(deps) };
};

test('a new install, with nothing heard, is shown every tip', () => {
  const { tips } = place(0);
  assert.ok(tips.shows('library') && tips.shows('player') && tips.shows('discover'));
});

test('somebody who has listened to more than a handful is shown none', () => {
  assert.equal(decideTips(() => USED_AFTER).on, false);
  assert.equal(decideTips(() => USED_AFTER - 1).on, true);
  const { tips } = place(250);
  assert.ok(!tips.shows('library') && !tips.shows('player') && !tips.shows('discover'));
});

test('a history that cannot be read is taken for somebody who has used the app', () => {
  const { tips } = place(() => {
    throw new Error('no database');
  });
  assert.equal(tips.shows('library'), false);
});

test('the decision is made once, so a newcomer playing a few songs keeps the tips not yet read', () => {
  let heard = 0;
  const { kept } = place(() => heard);
  const first = createTips({ read: () => kept.words, write: (w) => (kept.words = w), listened: () => heard });
  assert.equal(first.shows('player'), true);
  heard = 40;
  // The next start of the app reads what was written, and does not count again.
  const next = createTips({ read: () => kept.words, write: (w) => (kept.words = w), listened: () => heard });
  assert.equal(next.shows('player'), true);
});

test('a tip put away stays away, and the others are left alone', () => {
  const { tips, kept } = place(0);
  tips.dismiss('library');
  assert.equal(tips.shows('library'), false);
  assert.equal(tips.shows('player'), true);
  const again = createTips({ read: () => kept.words, write: () => {}, listened: () => 0 });
  assert.equal(again.shows('library'), false);
});

test('showing the tips again brings every one back, even for somebody who was never shown them', () => {
  const { tips } = place(500);
  let told = 0;
  tips.subscribe(() => (told += 1));
  tips.again();
  assert.ok(tips.shows('library') && tips.shows('discover'));
  assert.equal(told, 1);
});

test('words that cannot be read are decided afresh, and tips nobody knows of are dropped', () => {
  assert.equal(parseTips('not json'), null);
  assert.equal(parseTips('{"seen":[]}'), null);
  assert.deepEqual(parseTips('{"on":true,"seen":["library","gone"]}'), { on: true, seen: ['library'] });
  const { tips } = place(0, '{{{');
  assert.equal(tips.shows('library'), true);
});
