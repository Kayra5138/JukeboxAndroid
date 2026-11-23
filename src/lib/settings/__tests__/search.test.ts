import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';

import { en } from '../../i18n/en/index.ts';
import { tr } from '../../i18n/tr/index.ts';
import { searchSettings, wayTo } from '../search.ts';

describe('finding a setting', () => {
  it('has the words of every page as the pages say them now', () => {
    // Out of date, a row added to a page could not be found: run node scripts/settings-index.mjs.
    assert.doesNotThrow(() => execFileSync('node', ['scripts/settings-index.mjs', '--check'], { stdio: 'pipe' }));
  });

  it('finds a page by its name, before anything said on a page', () => {
    const hits = searchSettings(en, 'equalizer');
    assert.equal(hits[0]?.page, 'equalizer');
    assert.equal(hits[0]?.isPage, true);
  });

  it('finds a row on a page some way in, and says the way there', () => {
    const hits = searchSettings(en, en.settings.coverLook.motion);
    const hit = hits.find((one) => one.page === 'player-look');
    assert.ok(hit, 'the player look page has its own motion row');
    assert.deepEqual(hit.trail, [en.nav.settings, en.settings.sections.look, en.nav.playerLook]);
  });

  it('reads the words in the language the app is in, without regard to case or accents', () => {
    const plain = searchSettings(tr, 'gorunum');
    const marked = searchSettings(tr, 'GÖRÜNÜM');
    assert.ok(plain.some((hit) => hit.page === 'settings-look' && hit.isPage));
    assert.deepEqual(plain, marked);
  });

  it('wants every word typed, in any order', () => {
    // Two words of one line, the other way round.
    const [first, , third] = en.sound.transitions.albums.title.split(' ');
    const hits = searchSettings(en, `${third} ${first}`);
    assert.ok(hits.some((hit) => hit.text === en.sound.transitions.albums.title));
    for (const hit of hits) {
      const folded = hit.text.toLowerCase();
      assert.ok(folded.includes(first!.toLowerCase()) && folded.includes(third!.toLowerCase()), hit.text);
    }
    assert.deepEqual(searchSettings(en, '   '), []);
  });

  it('finds the names of the themes, which the page reads by a key it works out', () => {
    const hits = searchSettings(en, en.themes.midnight);
    assert.ok(hits.some((hit) => hit.page === 'themes'));
  });

  it('opens the pages on the way, in order', () => {
    assert.deepEqual(wayTo('theme'), ['settings-look', 'themes', 'theme']);
    assert.deepEqual(wayTo('settings-sound'), ['settings-sound']);
    assert.deepEqual(wayTo('settings'), []);
  });
});
