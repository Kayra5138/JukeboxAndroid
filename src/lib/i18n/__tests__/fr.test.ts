import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { en } from '../en/index.ts';
import { fr } from '../fr/index.ts';
import { de, one } from '../fr/grammar.ts';

const NARROW = ' ';
const NBSP = ' ';

/** Every line in a table, by where it is. A list counts as one line. */
function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

describe('French', () => {
  it('has every line of the English table, as the same kind of thing', () => {
    const english = new Map(lines(en));
    const french = new Map(lines(fr));
    assert.deepEqual([...french.keys()].sort(), [...english.keys()].sort());
    for (const [at, value] of french) {
      assert.equal(typeof value, typeof english.get(at), at);
      if (typeof value === 'string') assert.notEqual(value.trim(), '', at);
    }
  });

  it('counts 0 and 1 as one', () => {
    assert.equal(one(0, 'a', 'b'), 'a');
    assert.equal(one(1, 'a', 'b'), 'a');
    assert.equal(one(2, 'a', 'b'), 'b');
    assert.equal(fr.common.tracks(0), '0 titre');
    assert.equal(fr.common.tracks(1), '1 titre');
    assert.equal(fr.common.tracks(2), '2 titres');
    assert.equal(fr.common.songs(21), '21 morceaux');
    assert.equal(fr.common.tracks(12345), `12${NARROW}345 titres`);
    assert.equal(fr.player.sheet.back(1), `Reculer de 1${NBSP}seconde`);
    assert.equal(fr.player.sheet.back(10), `Reculer de 10${NBSP}secondes`);
  });

  it('writes numbers and dates the French way', () => {
    const when = new Date(2026, 8, 23, 14, 5);
    assert.equal(fr.format.number(1234567), `1${NARROW}234${NARROW}567`);
    assert.equal(fr.format.number(-1200), `-1${NARROW}200`);
    assert.equal(fr.format.decimal(1234.56), `1${NARROW}234,6`);
    assert.equal(fr.format.decimal(0.5, 2), '0,50');
    assert.equal(fr.format.date(when), '23/09/2026');
    assert.equal(fr.format.dateTime(when), '23/09/2026 14:05');
    assert.equal(fr.format.upper('Écoutes récentes'), 'ÉCOUTES RÉCENTES');
    assert.equal(fr.stats.chart.day(new Date(2026, 9, 1)), 'Jeudi 1er octobre');
    assert.equal(fr.stats.duration.hoursMinutes(4, 5), `4${NARROW}h${NARROW}05`);
  });

  it('joins « de » to a name the way French does', () => {
    assert.equal(de('Pomme'), 'de Pomme');
    assert.equal(de('Adele'), 'd’Adele');
    assert.equal(de('Étienne Daho'), 'd’Étienne Daho');
    assert.equal(de('Les Rita Mitsouko'), 'des Rita Mitsouko');
    assert.equal(de('Le Tigre'), 'du Tigre');
    assert.equal(fr.discover.why.moreFrom('Angèle'), 'Plus d’Angèle');
  });

  it('agrees with what a backup holds', () => {
    assert.equal(fr.backup.songs(0, 0), 'Elle ne contient aucun morceau.');
    assert.match(fr.backup.songs(3, 3), /^Les 3 morceaux qu’elle contient sont tous/);
    assert.match(fr.backup.songs(1, 5), /^1 des 5 morceaux qu’elle contient est dans ta bibliothèque\. Les 4 autres/);
    assert.match(fr.backup.songs(4, 5), /L’autre n’est pas sur ce téléphone\. Ses écoutes/);
    assert.match(fr.backup.songs(0, 5), /^Aucun des 5 morceaux qu’elle contient n’est dans ta bibliothèque\. Leurs écoutes/);
  });

  it('never leaves a placeholder unfilled, nor an ASCII apostrophe or a plain space before ? ! ; :', () => {
    const say = (at: string, line: string) => {
      assert.doesNotMatch(line, /undefined|NaN|\[object/, at);
      assert.doesNotMatch(line, /'/, at);
      assert.doesNotMatch(line, / [?!;:]/, at);
    };
    for (const [at, value] of lines(fr)) {
      if (typeof value === 'string') say(at, value);
      if (typeof value === 'function') {
        for (const n of [0, 1, 2, 5, 21, 100]) {
          const args = Array.from({ length: value.length }, (_, i) =>
            at === 'stats.period.versus' || at.startsWith('stats.report.') && at.endsWith('Lead') && at !== 'stats.report.clockLead'
              ? ['week', 'rolling'][i]
              : at.startsWith('stats.chart') || at.startsWith('format.date') || at === 'stats.period.monthOf'
                ? new Date(2026, 8, 23)
                : at.endsWith('write.summary')
                  ? { written: n, unchanged: n, skipped: n, failed: n }
                  : at.endsWith('same.holds')
                    ? { listens: n, tags: n, lyrics: true, lists: n }
                    : at.endsWith('general.found') || at.endsWith('write.written')
                      ? ['title']
                      : n
          );
          const call = value as (...a: unknown[]) => unknown;
          let line: unknown;
          try {
            line = call(...args);
          } catch {
            // A line that takes words and not numbers: the same again, written out.
            line = call(...args.map((arg) => (typeof arg === 'number' ? String(arg) : arg)));
          }
          if (typeof line === 'string') say(at, line);
        }
      }
    }
  });
});
