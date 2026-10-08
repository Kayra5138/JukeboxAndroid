import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { LANGUAGE_OF_GUESS } from '../../lyrics/languages.ts';
import {
  currentLanguage,
  DEFAULT_LANGUAGE,
  LANGUAGES,
  languageFrom,
  strings,
  stringsFor,
} from '../languages.ts';

/** Every line in a table, by where it is. A list counts as one line. */
function lines(table: object, path = ''): [string, unknown][] {
  return Object.entries(table).flatMap(([key, value]): [string, unknown][] => {
    const at = path ? `${path}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return lines(value, at);
    return [[at, value]];
  });
}

describe('the languages on offer', () => {
  it('starts in English, and falls back to it for a setting it cannot read', () => {
    assert.equal(DEFAULT_LANGUAGE, 'en');
    assert.equal(languageFrom(null), 'en');
    assert.equal(languageFrom('tr'), 'tr');
    assert.equal(languageFrom('xx'), 'en');
    assert.equal(languageFrom(''), 'en');
  });

  it('names each language in the language itself', () => {
    assert.deepEqual(LANGUAGES.map((language) => language.name), ['English', 'Türkçe']);
  });

  /*
    The compiler already holds every table to the English one's shape. What it
    cannot see is a line that was declared and left empty, or one that is a
    string in one language and a function in another by way of a cast.
  */
  it('has every line of the English table in every other, as the same kind of thing', () => {
    const english = new Map(lines(stringsFor('en')));
    for (const language of LANGUAGES) {
      const theirs = new Map(lines(language.strings));
      assert.deepEqual([...theirs.keys()].sort(), [...english.keys()].sort(), language.id);
      for (const [at, value] of theirs) {
        assert.equal(typeof value, typeof english.get(at), `${language.id}: ${at}`);
        if (typeof value === 'string') assert.notEqual(value.trim(), '', `${language.id}: ${at}`);
      }
    }
  });

  it('can name every language the translator knows', () => {
    for (const language of LANGUAGES) {
      const names: Record<string, string> = language.strings.languages;
      for (const tag of Object.values(LANGUAGE_OF_GUESS)) {
        assert.ok(names[tag], `${language.id} has no name for ${tag}`);
      }
    }
  });
});

describe('the language in use', () => {
  afterEach(() => currentLanguage.set(DEFAULT_LANGUAGE));

  it('is English until something says otherwise', () => {
    assert.equal(strings().common.cancel, 'Cancel');
  });

  it('changes for everything that asks afterwards, and says that it has', () => {
    let told = 0;
    const stop = currentLanguage.subscribe(() => told++);
    currentLanguage.set('tr');
    assert.equal(strings().common.cancel, 'İptal');
    currentLanguage.set('tr');
    assert.equal(told, 1);
    stop();
    currentLanguage.set('en');
    assert.equal(told, 1);
  });
});

describe('what a count does to a sentence', () => {
  it('tells one from many in English', () => {
    const { common } = stringsFor('en');
    assert.equal(common.tracks(1), '1 track');
    assert.equal(common.tracks(0), '0 tracks');
    assert.equal(common.tracks(12345), '12,345 tracks');
  });

  it('leaves the noun alone in Turkish', () => {
    const { common } = stringsFor('tr');
    assert.equal(common.tracks(1), '1 parça');
    assert.equal(common.tracks(3), '3 parça');
    assert.equal(common.tracks(12345), '12.345 parça');
  });
});

describe('numbers and dates', () => {
  const when = new Date(2026, 8, 23, 14, 5);

  it('are written the English way', () => {
    const { format } = stringsFor('en');
    assert.equal(format.number(1234567), '1,234,567');
    assert.equal(format.number(-1200), '-1,200');
    assert.equal(format.decimal(1234.56), '1,234.6');
    assert.equal(format.decimal(0.5, 2), '0.50');
    assert.equal(format.date(when), '23/09/2026');
    assert.equal(format.dateTime(when), '23/09/2026 14:05');
  });

  it('are written the Turkish way', () => {
    const { format } = stringsFor('tr');
    assert.equal(format.number(1234567), '1.234.567');
    assert.equal(format.decimal(1234.56), '1.234,6');
    assert.equal(format.decimal(-0.04), '0,0');
    assert.equal(format.date(when), '23.09.2026');
    assert.equal(format.dateTime(when), '23.09.2026 14:05');
  });

  it('has twelve months and seven days in every language', () => {
    for (const language of LANGUAGES) {
      assert.equal(language.strings.format.monthsShort.length, 12);
      assert.equal(language.strings.format.weekdaysShort.length, 7);
    }
  });
});
