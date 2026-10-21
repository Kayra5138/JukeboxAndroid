import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ErrorEntry } from '../errorLog.ts';
import { issueLink, NEW_ISSUE_URL, phoneLine, reportText, stamp, type ReportFacts } from '../report.ts';

const facts: ReportFacts = {
  version: '0.33.1',
  built: '15 Oct 2026, 12:00',
  android: '14',
  maker: 'Google',
  model: 'Pixel 8',
  language: 'tr',
  theme: 'system → dark',
  tracks: 1234,
  downloads: true,
};

const entry = (i: number): ErrorEntry => ({
  at: Date.UTC(2026, 9, 15, 12, 0) + i * 60_000,
  version: '0.33.1',
  kind: 'download',
  message: `ERR_YOUTUBE_REFUSED number ${i} with some more words to make it long enough to matter`,
});

test('the phone is its maker, model and Android version', () => {
  assert.equal(phoneLine(facts), 'Google Pixel 8, Android 14');
  assert.equal(phoneLine({ maker: 'samsung', model: 'SM-S911B', android: '15' }), 'Samsung SM-S911B, Android 15');
  assert.equal(phoneLine({ maker: 'OnePlus', model: 'OnePlus 12', android: '14' }), 'OnePlus 12, Android 14');
  assert.equal(phoneLine({ maker: null, model: null, android: null }), 'Unknown');
});

test('times are written in UTC to the minute', () => {
  assert.equal(stamp(Date.UTC(2026, 9, 15, 14, 3, 59)), '2026-10-15 14:03Z');
});

test('the copied text has the version, the phone, the details and the errors', () => {
  const text = reportText(facts, [entry(0)]);
  assert.match(text, /^Version: 0\.33\.1\nPhone: Google Pixel 8, Android 14\n\n```\n/);
  assert.match(text, /Library: 1234 tracks/);
  assert.match(text, /2026-10-15 12:00Z 0\.33\.1 download: ERR_YOUTUBE_REFUSED number 0/);
  assert.match(text, /```$/);
  assert.doesNotMatch(reportText(facts, null), /Recent errors/);
  assert.match(reportText(facts, []), /Recent errors: none/);
});

test('the link fills in the form by its field ids', () => {
  const { url, left } = issueLink(facts, null);
  assert.equal(left, 0);
  assert.ok(url.startsWith(`${NEW_ISSUE_URL}?template=bug.yml&version=0.33.1&phone=Google%20Pixel%208%2C%20Android%2014&more=`));
  const more = decodeURIComponent(new URL(url).searchParams.get('more') ?? '');
  assert.match(more, /^```\nBuilt: /);
});

test('the oldest errors are left out until the link is short enough', () => {
  const errors = Array.from({ length: 50 }, (_, i) => entry(i));
  const { url, left } = issueLink(facts, errors, 3000);
  assert.ok(url.length <= 3000);
  assert.ok(left > 0);
  assert.ok(!url.includes(encodeURIComponent('number 0 ')));
  assert.ok(url.includes(encodeURIComponent('number 49 ')));
  // Under the real limit, fifty fit or nearly.
  assert.ok(issueLink(facts, errors).url.length <= 7000);
});
