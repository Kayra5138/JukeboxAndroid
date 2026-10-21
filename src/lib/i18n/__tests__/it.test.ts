import assert from 'node:assert/strict';
import { describe, it as test } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import { en } from '../en/index.ts';
import { it as italian } from '../it/index.ts';

/** Every line in a table, by where it is. A list counts as one line. */
function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

describe('the Italian table', () => {
  test('has every line of the English one, as the same kind of thing, none of them empty', () => {
    const english = new Map(lines(en));
    const theirs = new Map(lines(italian));
    assert.deepEqual([...theirs.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of theirs) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  test('can name every language the translator knows', () => {
    const names: Record<string, string> = italian.languages;
    for (const tag of Object.values(LANGUAGE_OF_GUESS)) assert.ok(names[tag], tag);
  });

  test('tells one from many, with nought as many', () => {
    const { common } = italian;
    assert.equal(common.tracks(0), '0 brani');
    assert.equal(common.tracks(1), '1 brano');
    assert.equal(common.tracks(12345), '12.345 brani');
    assert.equal(common.albums(1), '1 album');
    assert.equal(italian.player.sheet.back(1), 'Indietro di 1 secondo');
    assert.equal(italian.player.sheet.back(10), 'Indietro di 10 secondi');
  });

  test('writes numbers and dates the Italian way', () => {
    const { format } = italian;
    const when = new Date(2026, 8, 23, 14, 5);
    assert.equal(format.number(1234567), '1.234.567');
    assert.equal(format.decimal(1234.56), '1.234,6');
    assert.equal(format.decimal(-0.04), '0,0');
    assert.equal(format.date(when), '23/09/2026');
    assert.equal(format.dateTime(when), '23/09/2026 14:05');
    assert.equal(format.monthsShort.length, 12);
    assert.equal(format.weekdaysShort.length, 7);
    assert.equal(format.upper('perché città'), 'PERCHÉ CITTÀ');
    assert.equal(italian.stats.chart.day(new Date(2026, 8, 24)), 'Giovedì 24 settembre');
  });

  test('keeps every number and name it is given', () => {
    const counts = [0, 1, 2, 5, 21, 100];
    for (const n of counts) {
      assert.match(italian.lists.picker.added(n, 'Estate'), new RegExp(`${n}.*Estate`));
      assert.match(italian.details.write.heading(n), new RegExp(`${n} file`));
      assert.match(italian.discover.status.preparing(n, n + 1), new RegExp(`${n} di ${n + 1}`));
    }
    assert.equal(italian.backup.songs(0, 0), 'Non contiene nessuna canzone.');
    assert.match(italian.backup.songs(0, 1), /^L’unica canzone che contiene non è su questo telefono\. I suoi/);
    assert.match(italian.backup.songs(0, 5), /^Nessuna delle 5 canzoni/);
    assert.equal(italian.backup.songs(5, 5), 'Tutte le 5 canzoni che contiene sono nella tua libreria.');
    assert.match(italian.backup.songs(1, 21), /^1 delle 21 canzoni che contiene è nella tua libreria\. Le altre 20 non sono/);
    assert.match(italian.backup.songs(20, 21), /^20 delle 21 canzoni che contiene sono nella tua libreria\. L’altra non è/);
    assert.equal(
      italian.details.write.written(['title', 'artist', 'cover']),
      'Campi scritti: titolo, artista e copertina.'
    );
    assert.equal(italian.stats.report.clockLead('01:00'), 'Hai ascoltato di più intorno all’01:00');
    assert.equal(italian.stats.report.clockLead('21:00'), 'Hai ascoltato di più intorno alle 21:00');
  });
});
