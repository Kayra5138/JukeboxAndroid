import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import { en } from '../en/index.ts';
import { ru } from '../ru/index.ts';
import { plural } from '../ru/plural.ts';

/** Every line in a table, by where it is. A list counts as one line. */
function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

const NBSP = ' ';

describe('the Russian plural', () => {
  const form = (count: number) => plural(count, 'one', 'few', 'many');

  it('tells one, few and many apart by the last digits', () => {
    const expected: [number, string][] = [
      [0, 'many'],
      [1, 'one'],
      [2, 'few'],
      [4, 'few'],
      [5, 'many'],
      [11, 'many'],
      [12, 'many'],
      [14, 'many'],
      [21, 'one'],
      [22, 'few'],
      [25, 'many'],
      [101, 'one'],
      [111, 'many'],
    ];
    for (const [count, wanted] of expected) assert.equal(form(count), wanted, String(count));
  });

  it('takes a negative count by its size, and a fraction as few', () => {
    assert.equal(form(-1), 'one');
    assert.equal(form(-12), 'many');
    assert.equal(form(2.5), 'few');
  });

  it('puts the right noun after a count', () => {
    assert.equal(ru.common.tracks(1), '1 трек');
    assert.equal(ru.common.tracks(3), '3 трека');
    assert.equal(ru.common.tracks(11), '11 треков');
    assert.equal(ru.common.tracks(21), '21 трек');
    assert.equal(ru.common.songs(22), '22 песни');
    assert.equal(ru.common.songs(0), '0 песен');
    assert.equal(ru.common.tracks(12345), `12${NBSP}345 треков`);
  });
});

describe('the Russian table', () => {
  it('has every line of the English table, as the same kind of thing', () => {
    const english = new Map(lines(en));
    const theirs = new Map(lines(ru));
    assert.deepEqual([...theirs.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of theirs) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  it('can name every language the translator knows', () => {
    const names: Record<string, string> = ru.languages;
    for (const tag of Object.values(LANGUAGE_OF_GUESS)) assert.ok(names[tag], tag);
  });

  it('writes numbers and dates the Russian way', () => {
    const when = new Date(2026, 8, 23, 14, 5);
    assert.equal(ru.format.number(1234567), `1${NBSP}234${NBSP}567`);
    assert.equal(ru.format.number(-1200), `-1${NBSP}200`);
    assert.equal(ru.format.decimal(1234.56), `1${NBSP}234,6`);
    assert.equal(ru.format.decimal(0.5, 2), '0,50');
    assert.equal(ru.format.date(when), '23.09.2026');
    assert.equal(ru.format.dateTime(when), '23.09.2026 14:05');
    assert.equal(ru.format.upper('Эта неделя, ёлка'), 'ЭТА НЕДЕЛЯ, ЁЛКА');
    assert.equal(ru.format.monthsShort.length, 12);
    assert.equal(ru.format.weekdaysShort.length, 7);
    assert.equal(ru.stats.chart.day(when), 'Среда, 23 сентября');
    assert.equal(ru.stats.chart.month(when), 'Сентябрь 2026');
  });

  it('agrees a verb or a preposition with the count where one is used', () => {
    assert.equal(ru.player.sheet.back(1), 'Назад на 1 секунду');
    assert.equal(ru.player.sheet.back(10), 'Назад на 10 секунд');
    assert.equal(ru.player.sleepTimer.pauseAfter(21), 'Пауза через 21 минуту');
    assert.equal(ru.details.write.progressLabel(1, 21), 'Записано 1 из 21 файла');
    assert.equal(ru.details.write.progressLabel(3, 5), 'Записано 3 из 5 файлов');
    assert.equal(ru.details.tagPrompt.heading(2), 'Добавить тег к 2 трекам');
    assert.equal(ru.sound.autoEq.imported(1), 'Импортирована 1 полоса.');
    assert.equal(ru.sound.autoEq.imported(3), 'Импортированы 3 полосы.');
    assert.equal(ru.sound.autoEq.imported(5), 'Импортировано 5 полос.');
  });
});
