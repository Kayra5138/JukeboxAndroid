import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EDGE, FASTEST, edgePull, withinScroll } from '../autoScroll.ts';

/** A list a thousand points tall whose first pixel is two hundred down. */
const TOP = 200;
const HEIGHT = 1000;
const pull = (at: number) => edgePull(at, TOP, HEIGHT);

describe('edgePull', () => {
  it('leaves the list alone through the middle', () => {
    for (const at of [TOP + EDGE, TOP + HEIGHT / 2, TOP + HEIGHT - EDGE]) {
      assert.equal(pull(at), 0);
    }
  });

  it('pulls towards whichever edge is being leaned on', () => {
    assert.ok(pull(TOP + 10) < 0, 'near the top it should scroll up');
    assert.ok(pull(TOP + HEIGHT - 10) > 0, 'near the bottom it should scroll down');
  });

  it('ramps rather than switching on', () => {
    // Just inside the zone is a crawl; the edge itself is the full rate. A
    // fixed speed would make a nudge at the boundary bolt the list.
    const edgeOfZone = Math.abs(pull(TOP + EDGE - 1));
    const edgeOfList = Math.abs(pull(TOP));
    assert.ok(edgeOfZone > 0 && edgeOfZone < 1, `crawl was ${edgeOfZone}`);
    assert.equal(edgeOfList, FASTEST);
  });

  it('is symmetric', () => {
    for (const into of [1, 20, EDGE - 1, EDGE]) {
      assert.equal(pull(TOP + EDGE - into), -pull(TOP + HEIGHT - EDGE + into));
    }
  });

  it('keeps pulling at full rate past the edge, rather than giving up', () => {
    // A finger dragged off the list is the least ambiguous request there is.
    assert.equal(pull(TOP - 200), -FASTEST);
    assert.equal(pull(TOP + HEIGHT + 200), FASTEST);
  });

  it('does nothing for a list that has not been measured', () => {
    assert.equal(edgePull(500, 0, 0), 0);
  });
});

describe('withinScroll', () => {
  it('will not scroll past either end', () => {
    assert.equal(withinScroll(-40, 2000, 800), 0);
    assert.equal(withinScroll(5000, 2000, 800), 1200);
  });

  it('leaves an offset that is already inside alone', () => {
    assert.equal(withinScroll(600, 2000, 800), 600);
  });

  it('refuses to scroll a list shorter than its own viewport', () => {
    assert.equal(withinScroll(300, 400, 800), 0);
  });
});
