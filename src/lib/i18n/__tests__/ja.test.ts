import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import { en } from '../en/index.ts';
import { ja } from '../ja/index.ts';

/*
  The Japanese table, held to what `languages.test.ts` holds every registered
  language to, so that it is checked before it is in the list as well as after.
*/

function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

describe('the Japanese table', () => {
  it('has every line of the English one, as the same kind of thing', () => {
    const english = new Map(lines(en));
    const japanese = new Map(lines(ja));
    assert.deepEqual([...japanese.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of japanese) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  it('can name every language the translator knows', () => {
    const names: Record<string, string> = ja.languages;
    for (const tag of Object.values(LANGUAGE_OF_GUESS)) assert.ok(names[tag], tag);
  });

  it('counts with a counter and one wording', () => {
    const { common } = ja;
    assert.equal(common.tracks(1), '1曲');
    assert.equal(common.tracks(0), '0曲');
    assert.equal(common.tracks(12345), '12,345曲');
    assert.equal(common.albums(2), 'アルバム2枚');
    assert.equal(common.artists(5), 'アーティスト5人');
    assert.equal(ja.details.write.heading(3), '3件のファイルに情報を書き込みますか？');
  });

  it('writes numbers and dates the Japanese way', () => {
    const { format } = ja;
    const when = new Date(2026, 8, 23, 14, 5);
    assert.equal(format.number(1234567), '1,234,567');
    assert.equal(format.number(-1200), '-1,200');
    assert.equal(format.decimal(1234.56), '1,234.6');
    assert.equal(format.decimal(0.5, 2), '0.50');
    assert.equal(format.date(when), '2026/09/23');
    assert.equal(format.dateTime(when), '2026/09/23 14:05');
    assert.equal(format.monthsShort.length, 12);
    assert.equal(format.weekdaysShort.length, 7);
    assert.equal(format.weekdaysShort[0], '月');
    assert.equal(ja.stats.chart.day(when), '9月23日 水曜日');
    assert.equal(ja.stats.period.monthOf(when), '2026年9月');
  });

  it('leaves headings as they are written', () => {
    assert.equal(ja.format.upper('YouTubeダウンローダー'), 'YouTubeダウンローダー');
  });
});
