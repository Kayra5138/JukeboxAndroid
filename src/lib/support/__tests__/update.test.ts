import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHECK_EVERY_MS, isDue, isNewer, NOTHING_KNOWN, offerOf, parseVersion, readKnown, releaseOf } from '../update.ts';

const PAGE = 'https://github.com/Kayra5138/JukeboxAndroid/releases/tag/v0.34.0';

test('versions are read with or without their v, and pre-releases are not versions', () => {
  assert.deepEqual(parseVersion('v0.34.0'), [0, 34, 0]);
  assert.deepEqual(parseVersion('0.34.1'), [0, 34, 1]);
  assert.deepEqual(parseVersion('1.2'), [1, 2, 0]);
  assert.equal(parseVersion('v0.34.0-beta.1'), null);
  assert.equal(parseVersion('latest'), null);
  assert.equal(parseVersion(undefined), null);
});

test('newer is by the numbers, not the letters', () => {
  assert.equal(isNewer('v0.34.0', '0.33.1'), true);
  assert.equal(isNewer('0.10.0', '0.9.9'), true);
  assert.equal(isNewer('1.0.0', '0.99.99'), true);
  assert.equal(isNewer('0.33.1', '0.33.1'), false);
  assert.equal(isNewer('v0.33.0', '0.33.1'), false);
  assert.equal(isNewer('0.34.0', null), false);
  assert.equal(isNewer('nonsense', '0.1.0'), false);
});

test('a check is due once a day, never with the switch off, and after a clock put back', () => {
  const now = Date.UTC(2026, 9, 15);
  assert.equal(isDue(NOTHING_KNOWN, now, true), true);
  assert.equal(isDue(NOTHING_KNOWN, now, false), false);
  const tried = { ...NOTHING_KNOWN, triedAt: now - CHECK_EVERY_MS + 1 };
  assert.equal(isDue(tried, now, true), false);
  assert.equal(isDue(tried, now + 1, true), true);
  assert.equal(isDue({ ...NOTHING_KNOWN, triedAt: now + 60_000 }, now, true), true);
});

test("GitHub's answer is believed only for this project's releases", () => {
  assert.deepEqual(releaseOf({ tag_name: 'v0.34.0', html_url: PAGE, draft: false, prerelease: false }), { version: '0.34.0', url: PAGE });
  assert.equal(releaseOf({ tag_name: 'v0.34.0', html_url: PAGE, prerelease: true }), null);
  assert.equal(releaseOf({ tag_name: 'v0.34.0', html_url: PAGE, draft: true }), null);
  assert.equal(releaseOf({ tag_name: 'v0.34.0', html_url: 'https://evil.example/releases/x' }), null);
  assert.equal(releaseOf({ tag_name: 'nightly', html_url: PAGE }), null);
  assert.equal(releaseOf(null), null);
});

test('what was kept is read back, and anything else is nothing known', () => {
  const kept = { latest: '0.34.0', url: PAGE, triedAt: 1000 };
  assert.deepEqual(readKnown(JSON.stringify(kept)), kept);
  assert.deepEqual(readKnown('{'), NOTHING_KNOWN);
  assert.deepEqual(readKnown(JSON.stringify({ latest: '0.34.0', url: 'https://example.com', triedAt: 5 })), { ...NOTHING_KNOWN, triedAt: 5 });
});

test('the update is offered while it is newer and the switch is on, and goes once installed', () => {
  const known = { latest: '0.34.0', url: PAGE, triedAt: 1 };
  assert.deepEqual(offerOf(known, '0.33.1', true), { version: '0.34.0', url: PAGE });
  assert.equal(offerOf(known, '0.33.1', false), null);
  assert.equal(offerOf(known, '0.34.0', true), null);
  assert.equal(offerOf(known, '0.35.0', true), null);
  assert.equal(offerOf(NOTHING_KNOWN, '0.33.1', true), null);
});
