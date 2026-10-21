import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import { en } from '../en/index.ts';
import { es } from '../es/index.ts';

/*
  The Spanish table, checked on its own so that it holds whether or not it is
  in the list of languages yet.
*/

function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

describe('the Spanish table', () => {
  it('has every line of the English one, as the same kind of thing, and none empty', () => {
    const english = new Map(lines(en));
    const spanish = new Map(lines(es));
    assert.deepEqual([...spanish.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of spanish) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  it('can name every language the translator knows', () => {
    const names: Record<string, string> = es.languages;
    for (const tag of Object.values(LANGUAGE_OF_GUESS)) assert.ok(names[tag], tag);
  });
});

describe('numbers and dates in Spanish', () => {
  const when = new Date(2026, 8, 23, 14, 5);

  it('mark the thousands with a full stop from five figures up, and the decimals with a comma', () => {
    const { format } = es;
    assert.equal(format.number(1234567), '1.234.567');
    assert.equal(format.number(12345), '12.345');
    assert.equal(format.number(1234), '1234');
    assert.equal(format.number(-1200), '-1200');
    assert.equal(format.number(-12000), '-12.000');
    assert.equal(format.decimal(1234.56), '1234,6');
    assert.equal(format.decimal(12345.67), '12.345,7');
    assert.equal(format.decimal(0.5, 2), '0,50');
    assert.equal(format.decimal(-0.04), '0,0');
    assert.equal(format.decimal(-3.5), '-3,5');
  });

  it('write the date day first', () => {
    assert.equal(es.format.date(when), '23/09/2026');
    assert.equal(es.format.dateTime(when), '23/09/2026 14:05');
    assert.equal(es.stats.chart.day(when), 'Miércoles, 23 de septiembre');
    assert.equal(es.stats.chart.month(when), 'Septiembre de 2026');
    assert.equal(es.stats.period.monthOf(when), 'Sept 2026');
  });

  it('keep their accents in capitals', () => {
    assert.equal(es.format.upper('Ecualización'), 'ECUALIZACIÓN');
    assert.equal(es.format.upper('año'), 'AÑO');
  });

  it('put a non-breaking space before the per cent sign', () => {
    assert.equal(es.stats.percent(12), '12 %');
    assert.equal(es.stats.screen.changeFigure(-7), '↓ 7 %');
  });
});

describe('what a count does to a Spanish sentence', () => {
  it('tells one from many, and zero is many', () => {
    assert.equal(es.common.tracks(0), '0 pistas');
    assert.equal(es.common.tracks(1), '1 pista');
    assert.equal(es.common.tracks(2), '2 pistas');
    assert.equal(es.common.tracks(21), '21 pistas');
    assert.equal(es.common.songs(1), '1 canción');
    assert.equal(es.common.songs(100), '100 canciones');
    assert.equal(es.common.albums(1), '1 álbum');
    assert.equal(es.common.albums(5), '5 álbumes');
    assert.equal(es.common.tracks(12345), '12.345 pistas');
  });

  it('makes the verb and the participle agree', () => {
    assert.equal(es.details.write.skipping(1, false), 'Se omitirá 1 archivo de otro tipo.');
    assert.equal(es.details.write.skipping(3, false), 'Se omitirán 3 archivos de otro tipo.');
    assert.equal(
      es.details.write.summary({ written: 1, unchanged: 2, skipped: 0, failed: 1 }),
      'Se ha escrito 1 archivo. 2 archivos ya coincidían. 1 archivo ha fallado.'
    );
    assert.equal(es.lists.picker.added(1, 'Rock'), '1 pista añadida a Rock');
    assert.equal(es.lists.picker.added(5, 'Rock'), '5 pistas añadidas a Rock');
  });

  it('says how much of a backup is here in every case', () => {
    assert.equal(es.backup.songs(0, 0), 'No incluye ninguna canción.');
    assert.equal(es.backup.songs(1, 1), 'La canción que contiene está en tu biblioteca.');
    assert.match(es.backup.songs(0, 1), /^La canción que contiene no está en este teléfono\. /);
    assert.match(es.backup.songs(0, 3), /^Ninguna de las 3 canciones que contiene está en este teléfono\. /);
    assert.equal(es.backup.songs(4, 4), 'Las 4 canciones que contiene están en tu biblioteca.');
    assert.match(es.backup.songs(1, 2), /^1 de las 2 canciones que contiene está en tu biblioteca\. La otra no está /);
    assert.match(es.backup.songs(2, 5), /^2 de las 5 canciones que contiene están en tu biblioteca\. Las otras 3 no están /);
  });
});

describe('the smaller grammar of Spanish', () => {
  it('says "e" for "and" before a word that sounds like i', () => {
    assert.equal(es.details.general.found(['MusicBrainz', 'iTunes'], false).startsWith('Encontrado en MusicBrainz e iTunes.'), true);
    assert.equal(es.details.general.found(['MusicBrainz', 'Deezer'], true).startsWith('Encontrado en MusicBrainz y Deezer, con portada.'), true);
    assert.equal(es.details.write.written(['title', 'artist', 'cover']), 'Escrito: título, artista y portada.');
  });

  it('says one o’clock in the singular', () => {
    assert.equal(es.stats.report.clockLead('01:00'), 'Escuchas sobre todo hacia la 01:00');
    assert.equal(es.stats.report.clockLead('14:00'), 'Escuchas sobre todo hacia las 14:00');
  });

  it('has a phrase for every period, in every place', () => {
    for (const period of ['day', 'week', 'month', 'year'] as const) {
      for (const which of ['last', 'this', 'rolling'] as const) {
        for (const line of [
          es.stats.report.tracksLead(period, which),
          es.stats.report.artistsLead(period, which),
          es.stats.report.genresLead(period, which),
          es.stats.period.versus(period, which),
        ]) {
          assert.doesNotMatch(line, /undefined|  |de el /, `${period} ${which}: ${line}`);
        }
      }
    }
    assert.equal(es.stats.report.tracksLead('all', 'this'), 'Lo más escuchado hasta ahora');
    assert.equal(es.stats.report.artistsLead('month', 'last'), 'Tu compañía del mes pasado');
    assert.equal(es.stats.period.versus('all', 'this'), '');
  });
});

describe('the native Spanish strings', () => {
  const res = new URL('../../../../modules/jukebox-audio/android/src/main/res/', import.meta.url);
  const read = (file: string) => readFileSync(new URL(file, res), 'utf8');
  /** Every translatable name with the placeholders in it. */
  const table = (xml: string) => {
    const found = new Map<string, string[]>();
    for (const [, name, attributes, body] of xml.matchAll(/<string name="([^"]+)"([^>]*)>([\s\S]*?)<\/string>/g)) {
      if (attributes!.includes('translatable="false"')) continue;
      found.set(name!, (body!.match(/%\d\$[sd]|%[sd]/g) ?? []).sort());
    }
    for (const [, name, body] of xml.matchAll(/<plurals name="([^"]+)">([\s\S]*?)<\/plurals>/g)) {
      found.set(name!, (body!.match(/%\d\$[sd]|%[sd]/g) ?? []).sort());
    }
    return found;
  };

  it('has every translatable English name, with the same placeholders', () => {
    const english = table(read('values/strings.xml') + read('values/jukebox_widget_strings.xml'));
    const spanish = table(read('values-es/strings.xml'));
    assert.deepEqual([...spanish.keys()].sort(), [...english.keys()].sort());
    for (const [name, placeholders] of english) {
      const theirs = spanish.get(name)!;
      assert.deepEqual([...new Set(theirs)], [...new Set(placeholders)], name);
    }
  });

  it('escapes every apostrophe', () => {
    assert.doesNotMatch(read('values-es/strings.xml'), /[^\\]'/);
  });
});
