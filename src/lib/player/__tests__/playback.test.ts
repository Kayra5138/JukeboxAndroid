import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PITCH,
  SPEED,
  formatSemitones,
  formatSpeed,
  multiplierOf,
  semitonesOf,
  snap,
} from '../playback.ts';
import { stringsFor } from '../../i18n/languages.ts';

describe('snap', () => {
  it('lands on the grid between the ends', () => {
    assert.equal(snap(1.23, SPEED), 1.25);
    assert.equal(snap(1.71, SPEED), 1.7);
    assert.equal(snap(0.62, SPEED), 0.6);
  });

  it('counts up by a fraction without drifting off it', () => {
    // Twenty hops of 0.05 from 0.5 reach 1.0000000000000002 unaided, and a
    // speed that is not quite one would not read as normal anywhere.
    assert.equal(snap(0.9999, SPEED), 1);
    assert.equal(snap(1.4501, SPEED), 1.45);
    assert.equal(Number.isInteger(snap(1.9999, SPEED) * 100), true);
  });

  it('goes no further than the control does', () => {
    assert.equal(snap(9, SPEED), SPEED.max);
    assert.equal(snap(0.01, SPEED), SPEED.min);
    assert.equal(snap(40, PITCH), PITCH.max);
    assert.equal(snap(-40, PITCH), PITCH.min);
  });

  it('pulls a near miss all the way home', () => {
    // The point of the detent: the way back to normal is the widest target on
    // the track, not the narrowest.
    assert.equal(snap(0.97, SPEED), 1);
    assert.equal(snap(1.03, SPEED), 1);
    assert.equal(snap(0.4, PITCH), 0);
    assert.equal(snap(-0.6, PITCH), 0);
  });

  it('leaves the values either side of normal reachable', () => {
    // A detent that swallowed its neighbours would be a control that cannot be
    // set to 0.95, which is a worse fault than the one it fixes.
    assert.equal(snap(0.94, SPEED), 0.95);
    assert.equal(snap(1.06, SPEED), 1.05);
    assert.equal(snap(0.9, PITCH), 1);
    assert.equal(snap(-1.2, PITCH), -1);
  });

  it('answers with normal rather than a number that is not one', () => {
    assert.equal(snap(Number.NaN, SPEED), SPEED.normal);
    assert.equal(snap(Number.POSITIVE_INFINITY, PITCH), PITCH.normal);
  });

  it('is settled once it has been asked', () => {
    // Snapping runs on every frame of a drag and again on release, so it has
    // to agree with itself or a value would creep while being held still.
    for (const raw of [0.5, 0.73, 1, 1.38, 2]) {
      const once = snap(raw, SPEED);
      assert.equal(snap(once, SPEED), once);
    }
  });
});

describe('formatSpeed', () => {
  it('writes the shortest true form of each value', () => {
    assert.equal(formatSpeed(1), '1×');
    assert.equal(formatSpeed(1.5), '1.5×');
    assert.equal(formatSpeed(1.25), '1.25×');
    assert.equal(formatSpeed(0.5), '0.5×');
    assert.equal(formatSpeed(2), '2×');
  });

  it('never reads as a different speed from the one that is set', () => {
    assert.equal(formatSpeed(0.95), '0.95×');
    assert.equal(formatSpeed(1.05), '1.05×');
  });

  it('writes it with a comma in Turkish', () => {
    const tr = stringsFor('tr');
    assert.equal(formatSpeed(1, tr), '1×');
    assert.equal(formatSpeed(1.5, tr), '1,5×');
    assert.equal(formatSpeed(0.95, tr), '0,95×');
  });
});

describe('formatSemitones', () => {
  it('names the resting value instead of numbering it', () => {
    assert.equal(formatSemitones(0), 'Normal');
  });

  it('says which way a shift goes', () => {
    assert.equal(formatSemitones(2), '+2');
    assert.equal(formatSemitones(-2), '-2');
    assert.equal(formatSemitones(PITCH.max), '+7');
  });

  it('names the resting value in Turkish', () => {
    assert.equal(formatSemitones(0, stringsFor('tr')), 'Normal');
    assert.equal(formatSemitones(-2, stringsFor('tr')), '-2');
  });
});

describe('semitones and multipliers', () => {
  it('leaves the player alone at normal', () => {
    assert.equal(multiplierOf(0), 1);
    assert.equal(semitonesOf(1), 0);
  });

  it('puts an octave at twice the frequency', () => {
    // Not reachable on the control any more, but the conversion is the
    // definition of a semitone and has to hold wherever it is asked.
    assert.ok(Math.abs(2 ** (12 / 12) - 2) < 1e-12);
    assert.ok(Math.abs(multiplierOf(7) - 2 ** (7 / 12)) < 1e-12);
  });

  it('reads back whatever it was set to', () => {
    for (let semitones = PITCH.min; semitones <= PITCH.max; semitones += 1) {
      assert.equal(semitonesOf(multiplierOf(semitones)), semitones);
    }
  });

  it('brings a shift from an older build back within reach', () => {
    // The control used to offer a full octave. A player still holding one has
    // to show at the end of the slider rather than off it.
    assert.equal(semitonesOf(2), PITCH.max);
    assert.equal(semitonesOf(0.5), PITCH.min);
  });

  it('answers with normal for a multiplier that cannot be one', () => {
    assert.equal(semitonesOf(0), PITCH.normal);
    assert.equal(semitonesOf(-1), PITCH.normal);
    assert.equal(semitonesOf(Number.NaN), PITCH.normal);
  });
});
