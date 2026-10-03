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
      artists: ['Ai Higuchi'],
      title: 'Akuma no Ko',
      query: 'Ai Higuchi Akuma no Ko',
    });
  });

  it('keeps a dash that belongs to the song', () => {
    assert.deepEqual(identify(track({ artist: 'Goose house', title: 'Hikaru Nara - TV Size' })), {
      artist: 'Goose house',
      artists: ['Goose house'],
      title: 'Hikaru Nara - TV Size',
      query: 'Goose house Hikaru Nara - TV Size',
    });
  });

  it('reads the artist out of the filename when the file carries no tag', () => {
    assert.deepEqual(identify(track({ title: 'Yousei Teikoku - Filament' })), {
      artist: 'Yousei Teikoku',
      artists: ['Yousei Teikoku'],
      title: 'Filament',
      query: 'Yousei Teikoku Filament',
    });
  });

  it('leaves an untagged title with no separator alone', () => {
    assert.deepEqual(identify(track({ title: 'Gurenge' })), {
      artist: null,
      artists: [],
      title: 'Gurenge',
      query: 'Gurenge',
    });
  });

  it('searches under the first name of a credit and keeps the credit as written', () => {
    assert.deepEqual(identify(track({ artist: 'Rihanna, Eminem', title: 'Love the Way You Lie' })), {
      artist: 'Rihanna, Eminem',
      artists: ['Rihanna', 'Eminem'],
      title: 'Love the Way You Lie',
      query: 'Rihanna Love the Way You Lie',
    });
    assert.deepEqual(identify(track({ artist: 'Eminem feat. Rihanna', title: 'The Monster' })).artists, [
      'Eminem',
      'Rihanna',
    ]);
  });

  it('takes a guest out of the title and puts them with the artists', () => {
    assert.deepEqual(identify(track({ artist: 'Eminem', title: 'Love The Way You Lie ft. Rihanna' })), {
      artist: 'Eminem',
      artists: ['Eminem', 'Rihanna'],
      title: 'Love The Way You Lie',
      query: 'Eminem Love The Way You Lie',
    });
    // Named in both places, counted once.
    assert.deepEqual(
      identify(track({ artist: 'Eminem, Rihanna', title: 'The Monster (feat. Rihanna)' })).artists,
      ['Eminem', 'Rihanna']
    );
  });

  it('reads all of that out of a file named after a video', () => {
    // Titles as they really are in a library saved from the web.
    assert.deepEqual(identify(track({ title: 'Eminem ft. Rihanna - The Monster (Explicit) [Official Video]' })), {
      artist: 'Eminem ft. Rihanna',
      artists: ['Eminem', 'Rihanna'],
      title: 'The Monster',
      query: 'Eminem The Monster',
    });
    assert.deepEqual(identify(track({ title: 'Eminem - Stan (Long Version) ft. Dido' })), {
      artist: 'Eminem',
      artists: ['Eminem', 'Dido'],
      title: 'Stan (Long Version)',
      query: 'Eminem Stan (Long Version)',
    });
    assert.deepEqual(identify(track({ title: 'Atiye feat. İskender Paydaş - Yetmez (Official Video)' })), {
      artist: 'Atiye feat. İskender Paydaş',
      artists: ['Atiye', 'İskender Paydaş'],
      title: 'Yetmez',
      query: 'Atiye Yetmez',
    });
    assert.deepEqual(
      identify(track({ title: '[DnB] - Feint - Snake Eyes (feat. CoMa) [Monstercat Release]' })),
      { artist: 'Feint', artists: ['Feint', 'CoMa'], title: 'Snake Eyes', query: 'Feint Snake Eyes' }
    );
  });

  it('does not take apart a name that only looks like several', () => {
    assert.deepEqual(identify(track({ artist: 'Earth, Wind & Fire', title: 'September' })).artists, [
      'Earth, Wind & Fire',
    ]);
    assert.equal(identify(track({ artist: 'Earth, Wind & Fire', title: 'September' })).query, 'Earth, Wind & Fire September');
  });
});
