import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { THEMES } from '../registry.ts';
import { drawn, poolFrom, poolToSetting, withTheme } from '../shuffle.ts';

describe('a different theme each time', () => {
  it('reads its list back as it was written, in the picker’s order whatever order it was ticked in', () => {
    assert.deepEqual(poolFrom(poolToSetting(['plum', 'light', 'glass'])), ['light', 'plum', 'glass']);
    assert.equal(poolToSetting(['plum', 'light']), 'light,plum');
  });

  it('has nothing in it when nothing was stored, and forgets a theme that is no longer one', () => {
    assert.deepEqual(poolFrom(null), []);
    assert.deepEqual(poolFrom(''), []);
    assert.deepEqual(poolFrom('light,gone,system,plum'), ['light', 'plum']);
  });

  it('takes a theme in and lets it out, once each', () => {
    assert.deepEqual(withTheme(['light'], 'plum', true), ['light', 'plum']);
    assert.deepEqual(withTheme(['light', 'plum'], 'plum', true), ['light', 'plum']);
    assert.deepEqual(withTheme(['light', 'plum'], 'light', false), ['plum']);
    assert.deepEqual(withTheme([], 'light', false), []);
  });

  it('leaves the choice alone with nothing to draw from', () => {
    assert.equal(drawn([], 'dark', () => 0.5), null);
  });

  it('is the one theme when there is one, every time, even the one the app was last in', () => {
    assert.equal(drawn(['plum'], 'plum', () => 0), 'plum');
    assert.equal(drawn(['plum'], 'dark', () => 0.99), 'plum');
  });

  it('is never the theme the app was last in when there is another to be had', () => {
    for (let at = 0; at < 100; at++) {
      assert.notEqual(drawn(['light', 'plum', 'glass'], 'plum', () => at / 100), 'plum');
    }
    assert.equal(drawn(['light', 'plum'], 'light', Math.random), 'plum');
  });

  it('can come up as any of them, and as nothing else', () => {
    const pool = THEMES.map((theme) => theme.id);
    const seen = new Set<string>();
    for (let at = 0; at < 1000; at++) seen.add(drawn(pool, 'system', () => at / 1000)!);
    assert.deepEqual([...seen].sort(), [...pool].sort());
    // A draw that lands on the very end of the scale is still one of them.
    assert.equal(drawn(['light', 'plum'], 'system', () => 1), 'plum');
  });
});
