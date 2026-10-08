import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { stringsFor } from '../../i18n/languages.ts';
import { DEFAULT_TARGET, namedTargets, targetFrom, TARGETS } from '../target.ts';

describe('the language lyrics are translated into', () => {
  it('is English unless told otherwise', () => {
    assert.equal(DEFAULT_TARGET, 'en');
    assert.equal(targetFrom(null), 'en');
    assert.equal(targetFrom(''), 'en');
  });

  it('is what was chosen, where there is a model for it', () => {
    assert.equal(targetFrom('tr'), 'tr');
    assert.equal(targetFrom('zh-Hans'), 'zh-Hans');
  });

  it('is English again for a language there is no model for', () => {
    assert.equal(targetFrom('is'), 'en');
    assert.equal(targetFrom('tur'), 'en');
  });

  it('offers each language once', () => {
    assert.equal(new Set(TARGETS).size, TARGETS.length);
    assert.ok(TARGETS.includes('en'));
    assert.ok(TARGETS.includes('tr'));
  });
});

describe('the list to choose from', () => {
  it('names every target in the language the app is in, in that order', () => {
    const english = namedTargets(stringsFor('en').languages, 'en');
    assert.equal(english.length, TARGETS.length);
    assert.equal(english[0]!.name, 'Afrikaans');
    assert.equal(english.find((entry) => entry.tag === 'tr')!.name, 'Turkish');

    const turkish = namedTargets(stringsFor('tr').languages, 'tr');
    assert.equal(turkish.find((entry) => entry.tag === 'de')!.name, 'Almanca');
    assert.equal(turkish.find((entry) => entry.tag === 'en')!.name, 'İngilizce');
  });

  it('shows the tag for a language nobody has named, rather than dropping it', () => {
    const named = namedTargets({}, 'en');
    assert.equal(named.length, TARGETS.length);
    assert.ok(named.every((entry) => entry.name === entry.tag));
  });
});
