import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { folderNameFor, inNameOrder } from '../files.ts';

describe('files brought in by hand', () => {
  it('are offered a folder named after what their names share', () => {
    assert.equal(folderNameFor(['Dune - 01.mp3', 'Dune - 02.mp3', 'Dune - 10.mp3']), 'Dune');
    assert.equal(folderNameFor(['01 Dune.mp3', '02 Dune.mp3']), 'Dune');
    assert.equal(folderNameFor(['01 Chapter One.m4b', '02 Chapter Two.m4b']), 'Chapter');
    assert.equal(folderNameFor(['A Talk_part1.mp3']), 'A Talk part');
    assert.equal(folderNameFor(['One.mp3', 'Other.mp3']), 'One');
    assert.equal(folderNameFor([]), '');
  });

  it('go in the order their numbers count', () => {
    const files = ['Part 10.mp3', 'Part 2.mp3', 'Part 1.mp3'].map((name) => ({ name }));
    assert.deepEqual(inNameOrder(files).map((file) => file.name), ['Part 1.mp3', 'Part 2.mp3', 'Part 10.mp3']);
  });
});
