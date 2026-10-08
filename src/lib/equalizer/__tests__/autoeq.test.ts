import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { describeImport, nameFromFile, parseAutoEq } from '../autoeq.ts';
import { stringsFor } from '../../i18n/languages.ts';

/** A correction as AutoEQ writes one: a preamp and ten filters. */
const FILE = `Preamp: -6.2 dB
Filter 1: ON LSC Fc 105 Hz Gain 5.5 dB Q 0.70
Filter 2: ON PK Fc 105 Hz Gain -3.4 dB Q 0.70
Filter 3: ON PK Fc 190 Hz Gain -2.6 dB Q 0.52
Filter 4: ON PK Fc 1447 Hz Gain 2.1 dB Q 1.83
Filter 5: ON PK Fc 3312 Hz Gain -4.6 dB Q 3.12
Filter 6: ON PK Fc 5820 Hz Gain 4.0 dB Q 4.55
Filter 7: ON PK Fc 7523 Hz Gain -1.3 dB Q 5.20
Filter 8: ON PK Fc 8870 Hz Gain 1.9 dB Q 2.98
Filter 9: ON PK Fc 46 Hz Gain 0.6 dB Q 1.41
Filter 10: ON HSC Fc 10000 Hz Gain -2.1 dB Q 0.70
`;

describe('reading an AutoEQ file', () => {
  it('takes the preamp and every filter, in order', () => {
    const result = parseAutoEq(FILE);
    assert.equal(result.preampDb, -6.2);
    assert.equal(result.bands.length, 10);
    assert.deepEqual(result.bands[0], { type: 'lowShelf', frequencyHz: 105, gainDb: 5.5, q: 0.7 });
    assert.deepEqual(result.bands[1], { type: 'peak', frequencyHz: 105, gainDb: -3.4, q: 0.7 });
    assert.deepEqual(result.bands[9], { type: 'highShelf', frequencyHz: 10_000, gainDb: -2.1, q: 0.7 });
    assert.equal(result.unsupported + result.dropped + result.adjusted, 0);
    assert.equal(result.graphic, false);
  });

  it('reads the same file whatever it was saved by', () => {
    const plain = parseAutoEq(FILE);
    assert.deepEqual(parseAutoEq(FILE.replace(/\n/g, '\r\n')), plain);
    assert.deepEqual(parseAutoEq(FILE.replace(/\n/g, '\r')), plain);
    assert.deepEqual(parseAutoEq('﻿' + FILE), plain);
    assert.deepEqual(parseAutoEq(FILE.replace(/\n/g, '\n\n   \n')), plain);
    assert.deepEqual(parseAutoEq(FILE.replace(/ /g, '   ').replace(/^/gm, '\t')), plain);
    assert.deepEqual(parseAutoEq(FILE.toLowerCase()), plain);
  });

  it('takes a decimal comma for a decimal point', () => {
    const result = parseAutoEq(FILE.replace(/(\d)\.(\d)/g, '$1,$2'));
    assert.deepEqual(result, parseAutoEq(FILE));
  });

  it('knows every name the three kinds go by', () => {
    const kinds = (name: string) =>
      parseAutoEq(`Filter 1: ON ${name} Fc 100 Hz Gain 3 dB Q 0.7`).bands[0]?.type;
    assert.equal(kinds('PK'), 'peak');
    assert.equal(kinds('PEQ'), 'peak');
    assert.equal(kinds('LSC'), 'lowShelf');
    assert.equal(kinds('LS'), 'lowShelf');
    assert.equal(kinds('HSC'), 'highShelf');
    assert.equal(kinds('HS'), 'highShelf');
  });

  it('leaves out a filter that is switched off', () => {
    const result = parseAutoEq(
      'Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1\nFilter 2: OFF PK Fc 200 Hz Gain 9 dB Q 1\nFilter 3: ON PK Fc 300 Hz Gain -1 dB Q 1'
    );
    assert.deepEqual(result.bands.map((band) => band.frequencyHz), [100, 300]);
    assert.equal(result.unsupported, 0);
  });

  it('has no preamp where the file gives none', () => {
    const result = parseAutoEq('Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1');
    assert.equal(result.preampDb, null);
    assert.equal(result.bands.length, 1);
  });

  it('reads a preamp written without its unit, or with a plus', () => {
    assert.equal(parseAutoEq('Preamp: -4').preampDb, -4);
    assert.equal(parseAutoEq('Preamp:+1.5dB').preampDb, 1.5);
    assert.equal(parseAutoEq('preamp : −3,5 dB').preampDb, -3.5);
  });

  it('does without a filter number, and with whatever follows the Q', () => {
    const result = parseAutoEq('Filter: ON PK Fc 1.2 kHz Gain +2.5 dB Q 1.41   # mine');
    assert.deepEqual(result.bands, [{ type: 'peak', frequencyHz: 1_200, gainDb: 2.5, q: 1.41 }]);
  });

  it('turns a bandwidth in octaves into the width that means the same', () => {
    const [band] = parseAutoEq('Filter 1: ON PK Fc 1000 Hz Gain 3 dB BW Oct 1').bands;
    assert.ok(Math.abs(band.q - 1.4142) < 0.001);
  });

  it('gives a filter with no width the usual one for its kind', () => {
    const shelf = parseAutoEq('Filter 1: ON LS Fc 100 Hz Gain 3 dB').bands[0];
    assert.ok(Math.abs(shelf.q - 0.7071) < 0.001);
    assert.equal(parseAutoEq('Filter 1: ON PK Fc 100 Hz Gain 3 dB').bands[0].q, 1);
  });

  it('counts the kinds it has not got instead of guessing at them', () => {
    const result = parseAutoEq(
      [
        'Filter 1: ON HP Fc 30 Hz',
        'Filter 2: ON LPQ Fc 18000 Hz Q 0.7',
        'Filter 3: ON NO Fc 60 Hz',
        'Filter 4: ON NONE',
        'Filter 5: ON PK Fc 100 Hz Gain 3 dB Q 1',
      ].join('\n')
    );
    assert.equal(result.bands.length, 1);
    // The empty slot is not a filter that was lost.
    assert.equal(result.unsupported, 3);
  });

  it('counts a peak with half its numbers missing as one it could not use', () => {
    const result = parseAutoEq('Filter 1: ON PK Fc 100 Hz Q 1\nFilter 2: ON PK Gain 3 dB Q 1');
    assert.equal(result.bands.length, 0);
    assert.equal(result.unsupported, 2);
  });

  it('keeps the first twelve and says how many more there were', () => {
    const lines = Array.from(
      { length: 15 },
      (_, index) => `Filter ${index + 1}: ON PK Fc ${100 * (index + 1)} Hz Gain 1 dB Q 1`
    );
    const result = parseAutoEq(lines.join('\n'));
    assert.equal(result.bands.length, 12);
    assert.equal(result.bands[11].frequencyHz, 1_200);
    assert.equal(result.dropped, 3);
  });

  it('brings numbers from outside the limits inside them, and says so', () => {
    const result = parseAutoEq(
      'Filter 1: ON PK Fc 10 Hz Gain -30 dB Q 0.01\nFilter 2: ON PK Fc 100 Hz Gain 3 dB Q 1'
    );
    assert.deepEqual(result.bands[0], { type: 'peak', frequencyHz: 20, gainDb: -20, q: 0.1 });
    assert.equal(result.adjusted, 1);
  });

  it('finds nothing in text that is not a correction', () => {
    for (const text of ['', '   \n\n', 'Sennheiser HD 650', '# Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1']) {
      const result = parseAutoEq(text);
      assert.equal(result.bands.length, 0);
      assert.equal(result.preampDb, null);
    }
  });

  it('recognises the other file AutoEQ writes', () => {
    const result = parseAutoEq('GraphicEQ: 20 -0.5; 21 -0.5; 22 -0.5; 23 -0.5');
    assert.equal(result.graphic, true);
    assert.equal(result.bands.length, 0);
  });
});

describe('what an import is said to have done', () => {
  it('counts the bands', () => {
    assert.deepEqual(describeImport(parseAutoEq(FILE)), { ok: true, message: '10 bands imported.' });
    assert.equal(
      describeImport(parseAutoEq('Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1')).message,
      '1 band imported.'
    );
  });

  it('mentions what was left behind', () => {
    const lines = Array.from(
      { length: 13 },
      (_, index) => `Filter ${index + 1}: ON PK Fc ${100 * (index + 1)} Hz Gain 1 dB Q 1`
    );
    const said = describeImport(parseAutoEq([...lines, 'Filter 14: ON HP Fc 20 Hz'].join('\n')));
    assert.ok(said.ok);
    assert.match(said.message, /^12 bands imported\. 1 more was left out/);
    assert.match(said.message, /1 filter was of a kind/);
  });

  it('says why there was nothing to import', () => {
    assert.match(describeImport(parseAutoEq('hello')).message, /No filters were found/);
    assert.match(describeImport(parseAutoEq('GraphicEQ: 20 0; 30 1')).message, /ParametricEQ\.txt/);
    assert.match(describeImport(parseAutoEq('Filter 1: ON HP Fc 30 Hz')).message, /None of the filters/);
    assert.equal(describeImport(parseAutoEq('')).ok, false);
  });

  it('says it in Turkish', () => {
    const tr = stringsFor('tr');
    assert.deepEqual(describeImport(parseAutoEq(FILE), tr), {
      ok: true,
      message: '10 bant içe aktarıldı.',
    });
    assert.match(describeImport(parseAutoEq('hello'), tr).message, /filtre bulunamadı/);
  });
});

describe('a name from the name of the file', () => {
  it('is the headphone, which is what AutoEQ calls its files', () => {
    assert.equal(nameFromFile('Sennheiser HD 650 ParametricEQ.txt'), 'Sennheiser HD 650');
    assert.equal(nameFromFile('Sony_WH-1000XM4_ParametricEQ.txt'), 'Sony WH-1000XM4');
    assert.equal(nameFromFile('my curve.txt'), 'my curve');
  });

  it('is nothing where there was no name to go on', () => {
    assert.equal(nameFromFile(null), '');
    assert.equal(nameFromFile(''), '');
    assert.equal(nameFromFile('ParametricEQ.txt'), '');
  });
});
