import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_HAPTICS, feels, HAPTIC_GROUPS, hapticsFrom } from '../hapticsPlan.ts';

test('everything is felt as the app comes, and nothing when switched off', () => {
  for (const group of HAPTIC_GROUPS) {
    assert.equal(feels(DEFAULT_HAPTICS, group), true);
    assert.equal(feels({ ...DEFAULT_HAPTICS, mode: 'off' }, group), false);
  }
});

test('the essential few are holds, results and the game', () => {
  const essential = { ...DEFAULT_HAPTICS, mode: 'essential' as const };
  assert.deepEqual(
    HAPTIC_GROUPS.filter((group) => feels(essential, group)),
    ['holds', 'results', 'fun']
  );
});

test('custom goes by each group', () => {
  const custom = { ...DEFAULT_HAPTICS, mode: 'custom' as const, groups: { ...DEFAULT_HAPTICS.groups, player: false } };
  assert.equal(feels(custom, 'player'), false);
  assert.equal(feels(custom, 'choices'), true);
});

test('a stored setting is read back, and anything wrong in it is as the app comes', () => {
  assert.deepEqual(hapticsFrom(null), DEFAULT_HAPTICS);
  assert.deepEqual(hapticsFrom('not json'), DEFAULT_HAPTICS);
  const read = hapticsFrom(JSON.stringify({ mode: 'custom', groups: { fun: false, holds: 'yes' }, strength: 7 }));
  assert.equal(read.mode, 'custom');
  assert.equal(read.groups.fun, false);
  assert.equal(read.groups.holds, true);
  assert.equal(read.strength, 1);
  assert.equal(hapticsFrom(JSON.stringify({ mode: 'loud' })).mode, 'all');
});
