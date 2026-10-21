import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import { en } from '../en/index.ts';
import { ptBR } from '../pt-BR/index.ts';

/*
  Brazilian Portuguese, held to the English table on its own: the same checks
  `languages.test.ts` makes of every registered language, so that they pass
  before it is registered as well as after.
*/

function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

describe('Brazilian Portuguese', () => {
  it('has every line of the English table, as the same kind of thing, and none empty', () => {
    const english = new Map(lines(en));
    const theirs = new Map(lines(ptBR));
    assert.deepEqual([...theirs.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of theirs) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  it('can name every language the translator knows', () => {
    const names: Record<string, string> = ptBR.languages;
    for (const tag of Object.values(LANGUAGE_OF_GUESS)) assert.ok(names[tag], tag);
  });

  it('tells one from many, with zero as many', () => {
    const { common } = ptBR;
    assert.equal(common.tracks(1), '1 faixa');
    assert.equal(common.tracks(0), '0 faixas');
    assert.equal(common.tracks(2), '2 faixas');
    assert.equal(common.albums(21), '21 álbuns');
    assert.equal(common.tracks(12345), '12.345 faixas');
  });

  it('writes numbers and dates the Brazilian way', () => {
    const { format } = ptBR;
    const when = new Date(2026, 8, 23, 14, 5);
    assert.equal(format.number(1234567), '1.234.567');
    assert.equal(format.number(-1200), '-1.200');
    assert.equal(format.decimal(1234.56), '1.234,6');
    assert.equal(format.decimal(0.5, 2), '0,50');
    assert.equal(format.date(when), '23/09/2026');
    assert.equal(format.dateTime(when), '23/09/2026 14:05');
    assert.equal(format.upper('ações já'), 'AÇÕES JÁ');
    assert.equal(format.monthsShort.length, 12);
    assert.equal(format.weekdaysShort.length, 7);
    assert.equal(ptBR.stats.chart.day(when), 'Quarta-feira, 23 de setembro');
    assert.equal(ptBR.stats.chart.month(when), 'Setembro de 2026');
  });

  it('agrees a backup’s count of songs with its verb', () => {
    const { backup } = ptBR;
    assert.equal(backup.songs(1, 1), 'A única música do backup está na sua biblioteca.');
    assert.match(backup.songs(1, 5), /^1 das 5 músicas do backup está na sua biblioteca\. As outras 4 não estão/);
    assert.match(backup.songs(4, 5), /^4 das 5 músicas do backup estão na sua biblioteca\. A outra não está/);
    assert.match(backup.songs(0, 5), /^Nenhuma das 5 músicas do backup está/);
  });
});
