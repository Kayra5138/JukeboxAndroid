import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDate, formatDateTime } from '../date.ts';

describe('formatDate', () => {
  it('writes the day before the month', () => {
    assert.equal(formatDate(new Date(2026, 8, 23)), '23/09/2026');
  });

  it('pads a single-digit day and month', () => {
    assert.equal(formatDate(new Date(2026, 0, 5)), '05/01/2026');
  });

  it('is never ambiguous about which number is which', () => {
    // The pair that reads as two different dates depending on the convention.
    assert.equal(formatDate(new Date(2026, 8, 10)), '10/09/2026');
    assert.equal(formatDate(new Date(2026, 9, 9)), '09/10/2026');
  });
});

describe('formatDateTime', () => {
  it('follows the date with the time of day', () => {
    assert.equal(formatDateTime(new Date(2026, 8, 23, 14, 5)), '23/09/2026 14:05');
  });

  it('pads the hour before noon', () => {
    assert.equal(formatDateTime(new Date(2026, 8, 23, 9, 0)), '23/09/2026 09:00');
  });

  it('keeps midnight at 00 rather than 24', () => {
    assert.equal(formatDateTime(new Date(2026, 8, 23, 0, 0)), '23/09/2026 00:00');
  });
});
