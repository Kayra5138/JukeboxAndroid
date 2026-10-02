import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bareTitle } from '../text.ts';

describe('bareTitle', () => {
  it('drops a prefix that repeats the artist', () => {
    assert.equal(bareTitle('Ai Higuchi - Akuma no Ko', 'Ai Higuchi'), 'Akuma no Ko');
  });

  it('keeps a dash that is part of the title', () => {
    assert.equal(bareTitle('Hikaru Nara - TV Size', 'Goose house'), 'Hikaru Nara - TV Size');
  });

  it('ignores case and accents when comparing the two', () => {
    assert.equal(bareTitle('KANAKO ITŌ - Fatima', 'Kanako Itō'), 'Fatima');
  });

  it('leaves the title alone when nothing is known about the artist', () => {
    assert.equal(bareTitle('Someone - Something', null), 'Someone - Something');
  });

  it('refuses to strip the title down to nothing', () => {
    assert.equal(bareTitle('LiSA - ', 'LiSA'), 'LiSA - ');
  });

  it('finds the separator when the artist name contains one too', () => {
    assert.equal(bareTitle('AC - DC - Thunderstruck', 'AC - DC'), 'Thunderstruck');
  });

  it('passes an ordinary title through untouched', () => {
    assert.equal(bareTitle('Gurenge', 'LiSA'), 'Gurenge');
  });
});
