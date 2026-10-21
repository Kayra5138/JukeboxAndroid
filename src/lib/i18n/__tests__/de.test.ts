import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import { de } from '../de/index.ts';
import { en } from '../en/index.ts';

/** Every line in a table, by where it is. A list counts as one line. */
function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

/** The narrow no-break space German puts between a figure and its unit. */
const _ = ' ';

describe('the German table', () => {
  it('has every line of the English one, as the same kind of thing, none of them empty', () => {
    const english = new Map(lines(en));
    const theirs = new Map(lines(de));
    assert.deepEqual([...theirs.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of theirs) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  it('can name every language the translator knows', () => {
    const names: Record<string, string> = de.languages;
    for (const tag of Object.values(LANGUAGE_OF_GUESS)) assert.ok(names[tag], tag);
  });

  it('tells one from many, with nought as many, and leaves alone the nouns that do not change', () => {
    const { common } = de;
    assert.equal(common.tracks(1), '1 Titel');
    assert.equal(common.tracks(12345), '12.345 Titel');
    assert.equal(common.songs(0), '0 Songs');
    assert.equal(common.songs(1), '1 Song');
    assert.equal(common.albums(1), '1 Album');
    assert.equal(common.albums(2), '2 Alben');
    assert.equal(common.files(1), '1 Datei');
    assert.equal(common.files(21), '21 Dateien');
    assert.equal(de.player.sheet.back(1), '1 Sekunde zurück');
    assert.equal(de.player.sheet.back(10), '10 Sekunden zurück');
  });

  it('makes the verb agree with the count', () => {
    assert.equal(de.downloads.short(1, 1, false), '1 läuft, 1 wartet');
    assert.equal(de.downloads.short(2, 3, false), '2 laufen, 3 warten');
    assert.equal(de.details.write.body(1).startsWith('1 Datei wird geändert'), true);
    assert.equal(de.details.write.body(5).startsWith('5 Dateien werden geändert'), true);
    assert.equal(de.details.tagPrompt.heading(5), 'Tag zu 5 Titeln hinzufügen');
    assert.equal(de.discover.gathering.artists(2, 12), '2 von 12 Künstlern');
    assert.equal(de.discover.gathering.artists(1, 1), '1 von 1 Künstler');
  });

  it('writes numbers and dates the German way', () => {
    const { format } = de;
    const when = new Date(2026, 8, 23, 14, 5);
    assert.equal(format.number(1234567), '1.234.567');
    assert.equal(format.number(-1200), '-1.200');
    assert.equal(format.decimal(1234.56), '1.234,6');
    assert.equal(format.decimal(-0.04), '0,0');
    assert.equal(format.date(when), '23.09.2026');
    assert.equal(format.dateTime(when), '23.09.2026 14:05');
    assert.equal(format.monthsShort.length, 12);
    assert.equal(format.weekdaysShort.length, 7);
    assert.equal(format.weekdaysShort[0], 'Mo');
    assert.equal(format.upper('Größe der Straße'), 'GRÖSSE DER STRASSE');
    assert.equal(de.stats.chart.day(new Date(2026, 8, 24)), 'Donnerstag, 24. September');
    assert.equal(de.stats.percent(12), `12${_}%`);
    assert.equal(de.stats.duration.hoursMinutes(4, 12), `4${_}h 12${_}min`);
    assert.equal(de.details.lyrics.earlier(0.25), `−0,25${_}s`);
  });

  it('keeps every number and name it is given', () => {
    for (const n of [0, 1, 2, 5, 21, 100]) {
      assert.match(de.lists.picker.added(n, 'Sommer'), new RegExp(`${n}.*Sommer`));
      assert.match(de.backup.songs(Math.min(n, 3), n), n === 0 ? /keine/ : new RegExp(`${n}`));
      assert.match(de.listenbrainz.past.unsent(n), new RegExp(`^${n} `));
      assert.match(de.details.write.progressLabel(n, n + 1), new RegExp(`^${n} von ${n + 1} `));
    }
    assert.match(de.listenbrainz.refused('kayra', 'Nein.'), /kayra.*„Nein\.“/);
    assert.match(de.stats.report.tracksLead('week', 'rolling'), /in den letzten 7 Tagen/);
  });
});
