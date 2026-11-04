import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pageOfLink } from '../late.ts';

describe('the page of a link the app was opened with', () => {
  it('is the path the link names, with what it asks', () => {
    assert.equal(pageOfLink('jukebox://podcast?feed=https%3A%2F%2Fa.b%2Fc.rss'), '/podcast?feed=https%3A%2F%2Fa.b%2Fc.rss');
    assert.equal(pageOfLink('jukebox:///tape?id=4'), '/tape?id=4');
  });

  it('is none for a sound file, another scheme, or the app itself', () => {
    assert.equal(pageOfLink('content://media/external/audio/media/12'), null);
    assert.equal(pageOfLink('file:///sdcard/a.mp3'), null);
    assert.equal(pageOfLink('https://example.com/x'), null);
    assert.equal(pageOfLink('jukebox://'), null);
    assert.equal(pageOfLink(null), null);
  });
});
