import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import { en } from '../en/index.ts';
import { zhHans } from '../zh-Hans/index.ts';

/*
  The Simplified Chinese table, held to what `languages.test.ts` holds every
  registered language to, so that it is checked before it is in the list as
  well as after.
*/

function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

describe('the Simplified Chinese table', () => {
  it('has every line of the English one, as the same kind of thing', () => {
    const english = new Map(lines(en));
    const chinese = new Map(lines(zhHans));
    assert.deepEqual([...chinese.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of chinese) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  it('can name every language the translator knows', () => {
    const names: Record<string, string> = zhHans.languages;
    for (const tag of Object.values(LANGUAGE_OF_GUESS)) assert.ok(names[tag], tag);
  });

  it('counts with a measure word and one wording', () => {
    const { common } = zhHans;
    assert.equal(common.tracks(1), '1 首歌曲');
    assert.equal(common.tracks(12345), '12,345 首歌曲');
    assert.equal(common.albums(2), '2 张专辑');
    assert.equal(common.artists(5), '5 位艺人');
  });

  it('writes numbers and dates the mainland way', () => {
    const { format } = zhHans;
    const when = new Date(2026, 8, 23, 14, 5);
    assert.equal(format.number(1234567), '1,234,567');
    assert.equal(format.decimal(1234.56), '1,234.6');
    assert.equal(format.date(when), '2026/09/23');
    assert.equal(format.dateTime(when), '2026/09/23 14:05');
    assert.equal(format.upper('YouTube 下载器'), 'YOUTUBE 下载器');
    assert.equal(format.monthsShort.length, 12);
    assert.equal(format.weekdaysShort.length, 7);
    assert.equal(zhHans.stats.chart.day(when), '9月23日 星期三');
  });
});
