import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  MAX_BANDS,
  autoPreampDb,
  curveSpan,
  describeCurve,
  formatDb,
  formatHz,
  formatQ,
  gainDb,
  heldBand,
  heldPreamp,
  hzAtPosition,
  nextBandHz,
  numberFrom,
  peakDb,
  positionOfHz,
  responseCurve,
  roundedHz,
  roundedQ,
  sameBands,
  section,
  type Band,
} from '../bands.ts';
import { stringsFor } from '../../i18n/languages.ts';

const near = (actual: number, expected: number, within: number) =>
  assert.ok(Math.abs(actual - expected) <= within, `${actual} is not within ${within} of ${expected}`);

const peak = (frequencyHz: number, gainDb: number, q = 1.4): Band => ({
  type: 'peak',
  frequencyHz,
  gainDb,
  q,
});

describe('what a set of bands does to a frequency', () => {
  it('is a peak\'s gain at its centre and nothing two octaves off', () => {
    const bands = [peak(1_000, 6)];
    near(gainDb(bands, 1_000), 6, 0.001);
    near(gainDb(bands, 250), 0, 0.5);
    near(gainDb(bands, 4_000), 0, 0.5);
  });

  it('is a shelf\'s gain on its own side, half at the corner, nothing on the other', () => {
    const low: Band[] = [{ type: 'lowShelf', frequencyHz: 200, gainDb: 8, q: 0.7 }];
    near(gainDb(low, 20), 8, 0.1);
    near(gainDb(low, 200), 4, 0.01);
    near(gainDb(low, 5_000), 0, 0.05);

    const high: Band[] = [{ type: 'highShelf', frequencyHz: 4_000, gainDb: -5, q: 0.7 }];
    near(gainDb(high, 100), 0, 0.05);
    near(gainDb(high, 4_000), -2.5, 0.01);
    near(gainDb(high, 20_000), -5, 0.1);
  });

  it('adds bands up in decibels', () => {
    const one = peak(500, 4, 1);
    const other: Band = { type: 'highShelf', frequencyHz: 3_000, gainDb: -3, q: 0.7 };
    for (const hz of [60, 500, 1_200, 3_000, 12_000]) {
      near(gainDb([one, other], hz), gainDb([one], hz) + gainDb([other], hz), 1e-9);
    }
  });

  it('says the same as the player does', () => {
    // The figures `Response.kt` is held to for this same curve at 48 kHz, in
    // its own tests. Two copies of one piece of arithmetic stay honest by
    // being held to the same numbers.
    const bands: Band[] = [
      { type: 'lowShelf', frequencyHz: 105, gainDb: 5.5, q: 0.7 },
      peak(2_400, 3, 2),
      peak(6_000, -4, 3),
    ];
    near(gainDb(bands, 50), 5.1942, 0.0001);
    near(gainDb(bands, 105), 2.7513, 0.0001);
    near(gainDb(bands, 2_400), 2.9101, 0.0001);
    near(gainDb(bands, 6_000), -3.8543, 0.0001);
    near(gainDb(bands, 15_000), -0.0322, 0.0001);
    near(autoPreampDb(bands), -5.4882, 0.0001);
  });

  it('counts a band at nought decibels as no filter', () => {
    assert.equal(section(peak(1_000, 0)), null);
    assert.equal(gainDb([peak(1_000, 0)], 1_000), 0);
  });

  it('leaves out a band the sample rate has no room for', () => {
    assert.equal(section(peak(12_000, 6), 16_000), null);
    near(gainDb([{ type: 'lowShelf', frequencyHz: 12_000, gainDb: 6, q: 0.7 }], 100, 16_000), 6, 1e-9);
  });
});

describe('the room a curve needs', () => {
  it('is its highest point, turned over', () => {
    near(autoPreampDb([peak(1_000, 6)]), -6, 0.001);
    // Two boosts that overlap need more than either.
    assert.ok(autoPreampDb([peak(1_000, 6, 1), peak(1_400, 6, 1)]) < -8);
  });

  it('does not step over the top of a narrow peak', () => {
    near(peakDb([peak(1_013, 12, 10)]), 12, 0.001);
  });

  it('is nothing for a curve that only cuts, or for none', () => {
    assert.equal(autoPreampDb([peak(3_000, -6)]), 0);
    assert.equal(autoPreampDb([]), 0);
  });
});

describe('the curve as it is drawn', () => {
  it('runs from 20 Hz to 20 kHz along a log axis', () => {
    near(hzAtPosition(0), 20, 1e-9);
    near(hzAtPosition(1), 20_000, 1e-6);
    near(hzAtPosition(1 / 3), 200, 1e-6);
    near(positionOfHz(2_000), 2 / 3, 1e-9);
    assert.equal(positionOfHz(5), 0);
    assert.equal(positionOfHz(90_000), 1);
  });

  it('is one point for each place across, each the gain there', () => {
    const bands = [peak(632.5, 6)];
    const points = responseCurve(bands, 61);
    assert.equal(points.length, 61);
    near(points[0], gainDb(bands, 20), 1e-9);
    near(points[60], gainDb(bands, 20_000), 1e-6);
    // Half way along a log axis from 20 to 20,000 is their geometric mean.
    near(points[30], 6, 0.001);
    assert.deepEqual(responseCurve([], 4), [0, 0, 0, 0]);
  });

  it('shows twelve decibels either way unless the curve goes further', () => {
    assert.equal(curveSpan([0, 3, -4]), 12);
    assert.equal(curveSpan([0, 12, -12]), 12);
    assert.equal(curveSpan([0, 12.5]), 18);
    assert.equal(curveSpan([-19, 2]), 24);
    assert.equal(curveSpan([]), 12);
  });
});

describe('the curve said in words', () => {
  it('names its highest and lowest points and where they are', () => {
    const points = responseCurve(
      [peak(100, 6, 2), { type: 'highShelf', frequencyHz: 8_000, gainDb: -4, q: 0.7 }],
      121
    );
    assert.match(describeCurve(points), /^Highest \+6 dB near 100 Hz, lowest −4 dB near 20 kHz\.$/);
  });

  it('leaves out the half there is none of', () => {
    assert.equal(describeCurve(responseCurve([peak(1_000, -3)], 121)), 'Lowest −3 dB near 1 kHz.');
    assert.match(describeCurve(responseCurve([peak(1_000, 3)], 121)), /^Highest \+3 dB near 1 kHz\.$/);
  });

  it('says flat when it is', () => {
    assert.equal(describeCurve(responseCurve([], 61)), 'Flat: nothing is turned up or down.');
    assert.equal(describeCurve([]), 'Flat: nothing is turned up or down.');
  });

  it('says it in Turkish, with Turkish decimals', () => {
    const tr = stringsFor('tr');
    assert.equal(describeCurve([], tr), 'Düz: hiçbir şey yükseltilmiyor ya da kısılmıyor.');
    assert.equal(
      describeCurve(responseCurve([peak(1_000, -3.5)], 121), tr),
      'En düşük nokta 1 kHz civarında, −3,5 dB.'
    );
    assert.equal(formatHz(1_450, tr), '1,45 kHz');
    assert.equal(formatHz(105, tr), '105 Hz');
    assert.equal(formatDb(5.5, tr), '+5,5 dB');
    assert.equal(formatDb(0, tr), '0 dB');
    assert.equal(formatQ(0.7, tr), '0,7');
    assert.equal(formatQ(10, tr), '10');
  });
});

describe('a band from anything', () => {
  it('is held inside the limits', () => {
    assert.deepEqual(heldBand({ type: 'peak', frequencyHz: 5, gainDb: 90, q: 400 }), {
      type: 'peak',
      frequencyHz: 20,
      gainDb: 20,
      q: 10,
    });
    assert.deepEqual(heldBand({ type: 'highShelf', frequencyHz: 90_000, gainDb: -90, q: 0 }), {
      type: 'highShelf',
      frequencyHz: 20_000,
      gainDb: -20,
      q: 0.1,
    });
  });

  it('is a flat peak at 1 kHz where nothing usable was given', () => {
    const flat = { type: 'peak', frequencyHz: 1_000, gainDb: 0, q: 1 };
    assert.deepEqual(heldBand(null), flat);
    assert.deepEqual(heldBand({ type: 'notch' as never, frequencyHz: NaN, gainDb: Infinity }), flat);
  });

  it('has a preamp that is a number inside its limits, or automatic', () => {
    assert.equal(heldPreamp(null), null);
    assert.equal(heldPreamp(undefined), null);
    assert.equal(heldPreamp(NaN), null);
    assert.equal(heldPreamp(-6.2), -6.2);
    assert.equal(heldPreamp(-99), -30);
    assert.equal(heldPreamp(99), 12);
  });

  it('is the same as another only if every number is', () => {
    assert.ok(sameBands([peak(100, 3)], [peak(100, 3)]));
    assert.ok(!sameBands([peak(100, 3)], [peak(100, 3.5)]));
    assert.ok(!sameBands([peak(100, 3)], [peak(100, 3), peak(200, 1)]));
    assert.ok(!sameBands([peak(100, 3)], [{ ...peak(100, 3), type: 'lowShelf' }]));
    assert.ok(sameBands([], []));
  });
});

describe('where a new band starts out', () => {
  it('is the middle of the range when there are none', () => {
    near(nextBandHz([]), 632, 5);
  });

  it('is the middle of the widest stretch nothing is in', () => {
    // One in the middle leaves a half either side, and they are filled in turn.
    const second = nextBandHz([peak(632, 0)]);
    const third = nextBandHz([peak(632, 0), peak(second, 0)]);
    const [low, high] = [second, third].sort((a, b) => a - b);
    near(low, 112, 2);
    near(high, 3_550, 50);
    // Everything crowded at the bottom leaves the top.
    assert.ok(nextBandHz([peak(30, 0), peak(60, 0), peak(120, 0)]) > 1_000);
  });

  it('is somewhere a band may be, however many there are', () => {
    const bands: Band[] = [];
    for (let count = 0; count < MAX_BANDS; count++) {
      const hz = nextBandHz(bands);
      assert.ok(hz >= 20 && hz <= 20_000);
      bands.push(peak(hz, 0));
    }
    assert.equal(new Set(bands.map((band) => band.frequencyHz)).size, MAX_BANDS);
  });
});

describe('numbers, typed and shown', () => {
  it('reads what somebody would type', () => {
    assert.equal(numberFrom('105'), 105);
    assert.equal(numberFrom(' -3.4 '), -3.4);
    assert.equal(numberFrom('−3,4'), -3.4);
    assert.equal(numberFrom('+2'), 2);
    assert.equal(numberFrom('.7'), 0.7);
    assert.equal(numberFrom('1.2k'), 1_200);
    assert.equal(numberFrom('12 kHz'), 12_000);
    assert.equal(numberFrom('105 Hz'), 105);
    assert.equal(numberFrom('-6 dB'), -6);
  });

  it('says so when it is not a number', () => {
    assert.equal(numberFrom(''), null);
    assert.equal(numberFrom('loud'), null);
    assert.equal(numberFrom('1.2.3'), null);
    assert.equal(numberFrom('-'), null);
  });

  it('rounds a frequency to what a slider can honestly be placed at', () => {
    assert.equal(roundedHz(31.4), 31);
    assert.equal(roundedHz(103), 105);
    assert.equal(roundedHz(1_472), 1_450);
    assert.equal(roundedHz(12_340), 12_300);
    assert.equal(roundedHz(3), 20);
    assert.equal(roundedHz(30_000), 20_000);
  });

  it('rounds a width to two figures', () => {
    assert.equal(roundedQ(0.7071), 0.71);
    assert.equal(roundedQ(1.4142), 1.4);
    assert.equal(roundedQ(0.01), 0.1);
    assert.equal(roundedQ(40), 10);
  });

  it('says them shortly', () => {
    assert.equal(formatHz(105), '105 Hz');
    assert.equal(formatHz(31.5), '31.5 Hz');
    assert.equal(formatHz(1_450), '1.45 kHz');
    assert.equal(formatHz(10_000), '10 kHz');
    assert.equal(formatDb(5.5), '+5.5 dB');
    assert.equal(formatDb(-3.4), '−3.4 dB');
    assert.equal(formatDb(0), '0 dB');
    assert.equal(formatDb(-0.04), '0 dB');
    assert.equal(formatQ(0.7), '0.7');
    assert.equal(formatQ(1.41421), '1.41');
  });
});
