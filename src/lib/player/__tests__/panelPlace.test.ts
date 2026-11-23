import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { panelPlace, type Box } from '../panelPlace.ts';

const inside = (box: Box, outer: Box) =>
  box.x >= outer.x && box.y >= outer.y && box.x + box.width <= outer.x + outer.width && box.y + box.height <= outer.y + outer.height;
const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const moved = (box: Box, by: number): Box => ({ ...box, y: box.y + by });

// An upright phone: the cover at the top, the time and the buttons a band across the middle.
const tall = {
  width: 411,
  height: 891,
  top: 24,
  bottom: 24,
  art: { x: 20, y: 48, width: 371, height: 290 },
  band: { x: 20, y: 420, width: 371, height: 110 },
  side: null,
};

describe('panelPlace', () => {
  it('for the sound and the sleep timer, moves the buttons to the top and puts the card under them, to the foot', () => {
    for (const tab of ['sound', 'sleep'] as const) {
      const place = panelPlace({ ...tall, tab });
      const band = moved(tall.band, place.shift);
      assert.ok(place.shift < 0);
      assert.ok(band.y >= tall.top);
      assert.ok(!meets(place.card, band));
      assert.ok(place.card.y > band.y);
      assert.ok(place.card.y + place.card.height <= tall.height - tall.bottom);
      // Most of the screen: the room the cover had, as well as the list's.
      assert.ok(place.card.height > tall.height / 2);
      assert.deepEqual(place.closers, []);
    }
  });

  it('for the look, leaves the cover where it is and in sight, and takes the rest', () => {
    const place = panelPlace({ ...tall, tab: 'look' });
    assert.equal(place.shift, 0);
    assert.ok(!meets(place.card, tall.art));
    assert.ok(place.card.y + place.card.height <= tall.height - tall.bottom);
    assert.ok(place.closers.some((closer) => inside(tall.art, closer)));
  });

  it('never moves the player down', () => {
    const place = panelPlace({ ...tall, band: { ...tall.band, y: 10 }, tab: 'sound' });
    assert.equal(place.shift, 0);
  });

  it('on its side, takes the column of the list for every tab, and moves nothing', () => {
    const wide = { ...tall, width: 891, height: 411, top: 0, bottom: 0, band: { x: 40, y: 300, width: 300, height: 90 }, side: { x: 460, y: 0, width: 431, height: 411 } };
    for (const tab of ['sound', 'look', 'sleep'] as const) {
      const place = panelPlace({ ...wide, tab });
      assert.ok(inside(place.card, wide.side));
      assert.equal(place.shift, 0);
    }
  });
});
