import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CLEAR, dockOf, nowPlayingHeight, overOf, tabBarHeight, tabBarOver } from '../bars.ts';

const upright = { glass: true, landscape: false, top: 0, tabs: true, tabBar: 80, player: 60 };

describe('what the bars of glass cover of a screen', () => {
  it('is nothing at all in a theme not of glass, whatever bars there are', () => {
    assert.equal(overOf({ ...upright, glass: false, top: 88 }), CLEAR);
    assert.equal(overOf({ ...upright, glass: false, landscape: true }), CLEAR);
  });

  it('is the tab bar and the bar of what is playing, one on the other, at the foot of a tab', () => {
    assert.deepEqual(overOf(upright), { top: 0, bottom: 140 });
    // Nothing playing: the bar is not there, and is measured as nothing.
    assert.deepEqual(overOf({ ...upright, player: 0 }), { top: 0, bottom: 80 });
  });

  it('is the bar of what is playing alone at the foot of a screen that is not a tab', () => {
    assert.deepEqual(overOf({ ...upright, tabs: false }), { top: 0, bottom: 60 });
    assert.equal(overOf({ ...upright, tabs: false, player: 0 }), CLEAR);
  });

  it('is the bar over a pushed screen at its top, where the screen runs on under it', () => {
    assert.deepEqual(overOf({ ...upright, tabs: false, player: 0, top: 88 }), { top: 88, bottom: 0 });
  });

  it('is nothing at the foot sideways, where the tabs and the player are beside the list', () => {
    assert.equal(overOf({ ...upright, landscape: true }), CLEAR);
    // The bar over a pushed screen is across the top either way.
    assert.deepEqual(overOf({ ...upright, landscape: true, top: 88 }), { top: 88, bottom: 0 });
  });

  it('never asks for less than no room', () => {
    assert.deepEqual(overOf({ ...upright, top: -4, player: -200 }), { top: 0, bottom: 0 });
  });
});

describe('the tab bar as reckoned', () => {
  it('is what it was measured to be, once it has been', () => {
    assert.equal(tabBarOver(83.4, 1, 24), 83.4);
  });

  it('is worked out from the size of writing and the inset until then', () => {
    assert.equal(tabBarOver(0, 1, 24), 46 + 16 + 24);
    assert.equal(tabBarOver(0, 1.3, 0), tabBarHeight(1.3));
    // Its label grows with the writing and never shrinks below its own line.
    assert.equal(tabBarHeight(0.85), tabBarHeight(1));
    assert.ok(tabBarHeight(2) > tabBarHeight(1.3));
  });

  it('keeps the bar of what is playing as tall as its cover, or as its two lines once they are taller', () => {
    assert.equal(nowPlayingHeight(1), 60);
    assert.equal(nowPlayingHeight(2), 20 + 74);
  });
});

describe('where the bar of what is playing stands', () => {
  it('is on the tab bar along the foot of a tab, and at the foot of any other screen', () => {
    assert.equal(dockOf({ glass: true, landscape: false, tabs: true, tabBar: 80 }), 80);
    assert.equal(dockOf({ glass: true, landscape: false, tabs: false, tabBar: 80 }), 0);
  });

  it('is in its own place in the page in a theme not of glass, and sideways', () => {
    assert.equal(dockOf({ glass: false, landscape: false, tabs: true, tabBar: 80 }), null);
    assert.equal(dockOf({ glass: true, landscape: true, tabs: true, tabBar: 80 }), null);
  });
});
