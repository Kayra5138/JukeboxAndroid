import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fromOutside, hostOf, isPrivateAddress, pageOfLink, systemPathTo } from '../late.ts';

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

describe('a link from outside the app', () => {
  it('writes a search into the box and does not run it', () => {
    assert.equal(fromOutside('/search?q=Faint&run=1'), '/search?q=Faint');
    assert.equal(fromOutside('jukebox://search?run=1'), 'jukebox://search');
  });

  it('has a podcast page ask before it reads the feed, however the link put it', () => {
    assert.equal(fromOutside('/podcast?feed=x'), '/podcast?feed=x&outside=1');
    assert.equal(fromOutside('jukebox://podcast?outside=0&feed=x'), 'jukebox://podcast?feed=x&outside=1');
    assert.equal(fromOutside('/tape?id=4'), '/tape?id=4');
  });

  it('tells an address on the phone or its own network from one out in the world', () => {
    for (const near of ['http://localhost/f.rss', 'http://127.0.0.1:8080/f', 'https://10.0.0.2/f', 'http://192.168.1.5/f', 'http://172.20.1.1/f', 'http://[::1]/f', 'http://nas.local/f', 'http://router/f', 'http://169.254.1.1/']) {
      assert.equal(isPrivateAddress(near), true, near);
    }
    for (const far of ['https://feeds.example.com/f.rss', 'https://8.8.8.8/f', 'http://172.32.0.1/f']) {
      assert.equal(isPrivateAddress(far), false, far);
    }
    assert.equal(hostOf('https://feeds.example.com/x?y'), 'feeds.example.com');
  });
});

describe('a link the system hands the app', () => {
  it('is no page when it is a sound file, and opening, opens the app where it would have', () => {
    assert.equal(systemPathTo('content://media/external/audio/media/12', true), '/');
    assert.equal(systemPathTo('file:///sdcard/a.mp3', true), '/');
    assert.equal(systemPathTo('CONTENT://x', false), null);
    assert.equal(systemPathTo('file:///sdcard/a.mp3', false), null);
  });

  it('goes where it says, less what it may not ask by itself', () => {
    assert.equal(systemPathTo('/search?q=Faint&run=1', false), '/search?q=Faint');
    assert.equal(systemPathTo('jukebox://podcast?feed=x', true), 'jukebox://podcast?feed=x&outside=1');
    assert.equal(systemPathTo('/tape?id=4', true), '/tape?id=4');
  });
});
