import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTapeFolder } from '../rule.ts';
import { folderNameOf, partTitleOf, tapeFolderOf } from '../folders.ts';

describe('the folder a fetched tape goes in', () => {
  it('is named after its show or book, without what a path cannot hold', () => {
    assert.equal(folderNameOf('Huberman Lab: Sleep / Focus?'), 'Huberman Lab Sleep Focus');
    assert.equal(folderNameOf('  ...  '), 'Tape');
    assert.equal(Array.from(folderNameOf('x'.repeat(200))).length, 80);
  });

  it('is in the Tapes folder of the library, and so is a tape', () => {
    const folder = tapeFolderOf('/Music/Jukebox/', 'Dune');
    assert.equal(folder, 'Music/Jukebox/Tapes/Dune');
    assert.equal(isTapeFolder(`${folder}/`, 'Music/Jukebox'), true);
  });
});

describe('what a part of a book fetched from a list is called', () => {
  it('is its title without the list in front of it and without its number', () => {
    const list = 'Wedding Poems - Full Audiobook';
    assert.equal(partTitleOf('Wedding Poems - Full Audiobook 01 - Elegy XX', list), 'Elegy XX');
    assert.equal(partTitleOf('Wedding Poems - Full Audiobook 10 - Sonnet 116', list), 'Sonnet 116');
    assert.equal(partTitleOf('Chapter 3: The Storm', 'Dune'), 'The Storm');
  });

  it('is left as it was where it does not start with the list, or nothing would be left', () => {
    assert.equal(partTitleOf('A talk about rivers', 'Some list'), 'A talk about rivers');
    assert.equal(partTitleOf('Dune', 'Dune'), 'Dune');
  });
});
