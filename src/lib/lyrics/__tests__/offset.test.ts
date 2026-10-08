import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { stringsFor } from '../../i18n/languages.ts';
import { formatOffset, MAX_OFFSET_MS, parseOffsetMs } from '../offset.ts';

describe('parseOffsetMs', () => {
  it('reads whole and fractional seconds', () => {
    assert.equal(parseOffsetMs('2'), 2_000);
    assert.equal(parseOffsetMs('1.5'), 1_500);
    assert.equal(parseOffsetMs('0.25'), 250);
    assert.equal(parseOffsetMs('.5'), 500);
  });

  it('reads a shift in either direction', () => {
    assert.equal(parseOffsetMs('-1.5'), -1_500);
    assert.equal(parseOffsetMs('+1.5'), 1_500);
  });

  it('takes a comma as a decimal point', () => {
    // Half the world writes it that way, and the keyboard offers whichever the
    // phone's locale prefers.
    assert.equal(parseOffsetMs('1,5'), 1_500);
    assert.equal(parseOffsetMs('-0,75'), -750);
  });

  it('ignores space around it', () => {
    assert.equal(parseOffsetMs('  1.5  '), 1_500);
  });

  it('refuses what is not a number', () => {
    for (const text of ['', '   ', 'abc', '1.2.3', '1s', '--1', '+', '.']) {
      assert.equal(parseOffsetMs(text), null, `expected null for ${JSON.stringify(text)}`);
    }
  });

  it('refuses the things Number() would have accepted', () => {
    // Number('0x10') is 16 and Number('') is 0; neither is a shift anybody
    // typed, and both would be stored without complaint.
    for (const text of ['0x10', '1e3', 'Infinity', '-Infinity', 'NaN']) {
      assert.equal(parseOffsetMs(text), null, `expected null for ${text}`);
    }
  });

  it('holds a shift inside what could still be the same song', () => {
    assert.equal(parseOffsetMs('600'), MAX_OFFSET_MS);
    assert.equal(parseOffsetMs('-600'), -MAX_OFFSET_MS);
  });

  it('rounds to something finer than anyone can hear', () => {
    assert.equal(parseOffsetMs('1.2345'), 1_230);
    assert.equal(parseOffsetMs('0.004'), 0);
  });
});

describe('formatOffset', () => {
  it('says which way and how far', () => {
    assert.equal(formatOffset(1_500), '+1.5s');
    assert.equal(formatOffset(-250), '−0.25s');
  });

  it('has a word for nothing rather than a zero', () => {
    assert.equal(formatOffset(0), 'no shift');
  });

  it('drops trailing zeroes', () => {
    assert.equal(formatOffset(2_000), '+2s');
    assert.equal(formatOffset(-1_000), '−1s');
  });

  it('is written the Turkish way when that is the language', () => {
    const tr = stringsFor('tr');
    assert.equal(formatOffset(1_500, tr), '+1,5 sn');
    assert.equal(formatOffset(-250, tr), '−0,25 sn');
    assert.equal(formatOffset(2_000, tr), '+2 sn');
    assert.equal(formatOffset(0, tr), 'kaydırma yok');
  });
});
