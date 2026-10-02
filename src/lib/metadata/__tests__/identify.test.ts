import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { identify } from '../identify.ts';
import { track } from './support.ts';

describe('identify', () => {
  it('drops the artist a tagger left in the title as well', () => {
    // Left in, the catalogues search for `recording:"Ai Higuchi - Akuma no Ko"`
    // and find nothing at all.
    assert.deepEqual(identify(track({ artist: 'Ai Higuchi', title: 'Ai Higuchi - Akuma no Ko' })), {
      artist: 'Ai Higuchi',
      title: 'Akuma no Ko',
      query: 'Ai Higuchi Akuma no Ko',
    });
  });

  it('keeps a dash that belongs to the song', () => {
    assert.deepEqual(identify(track({ artist: 'Goose house', title: 'Hikaru Nara - TV Size' })), {
      artist: 'Goose house',
      title: 'Hikaru Nara - TV Size',
      query: 'Goose house Hikaru Nara - TV Size',
    });
  });

  it('reads the artist out of the filename when the file carries no tag', () => {
    assert.deepEqual(identify(track({ title: 'Yousei Teikoku - Filament' })), {
      artist: 'Yousei Teikoku',
      title: 'Filament',
      query: 'Yousei Teikoku - Filament',
    });
  });

  it('leaves an untagged title with no separator alone', () => {
    assert.deepEqual(identify(track({ title: 'Gurenge' })), {
      artist: null,
      title: 'Gurenge',
      query: 'Gurenge',
    });
  });
});
