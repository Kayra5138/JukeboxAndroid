import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTapeFolder } from '../rule.ts';

describe('what a tape is', () => {
  it('is anything in the Tapes folder of the library folder, at any depth', () => {
    assert.equal(isTapeFolder('Music/Jukebox/Tapes/', 'Music/Jukebox'), true);
    assert.equal(isTapeFolder('Music/Jukebox/Tapes/Dune/Part 1/', 'Music/Jukebox'), true);
    assert.equal(isTapeFolder('Music/Jukebox/tapes/', '/Music/Jukebox/'), true);
  });

  it('may be named in any language the app speaks', () => {
    assert.equal(isTapeFolder('Music/Jukebox/Kasetler/Kitap/', 'Music/Jukebox'), true);
    assert.equal(isTapeFolder('Music/Jukebox/Kassetten/', 'Music/Jukebox'), true);
  });

  it('is never music: not elsewhere in the library, not a Tapes folder further down, not outside it', () => {
    assert.equal(isTapeFolder('Music/Jukebox/', 'Music/Jukebox'), false);
    assert.equal(isTapeFolder('Music/Jukebox/Mixtapes/', 'Music/Jukebox'), false);
    assert.equal(isTapeFolder('Music/Jukebox/Some artist/Tapes/', 'Music/Jukebox'), false);
    assert.equal(isTapeFolder('Music/Tapes/', 'Music/Jukebox'), false);
    assert.equal(isTapeFolder('Music/JukeboxTapes/', 'Music/Jukebox'), false);
    assert.equal(isTapeFolder(null, 'Music/Jukebox'), false);
  });
});
