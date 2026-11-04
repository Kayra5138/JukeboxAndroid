import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MIDDLE_WITHIN, placeAt, RING_RADIUS, ringMiddle, sliceAngle, SLICES } from '../pressMenu.ts';

const WIDTH = 400;
const HEIGHT = 900;
const towards = (angle: number, distance: number) => {
  const radians = (angle * Math.PI) / 180;
  return [Math.cos(radians) * distance, Math.sin(radians) * distance] as const;
};

describe('the ring under a held finger', () => {
  it('takes each slice from its way, at any distance past the middle', () => {
    for (let place = 0; place < SLICES; place += 1) {
      for (const distance of [MIDDLE_WITHIN + 1, 60, 150]) assert.equal(placeAt(...towards(sliceAngle(place), distance)), place);
    }
  });

  it('starts straight up and goes round clockwise', () => {
    assert.equal(placeAt(0, -60), 0);
    assert.equal(placeAt(60, 0), 2);
    assert.equal(placeAt(0, 60), 4);
    assert.equal(placeAt(-60, 0), 6);
  });

  it('gives each slice its share of the circle', () => {
    assert.equal(placeAt(...towards(sliceAngle(0) + 22, 60)), 0);
    assert.equal(placeAt(...towards(sliceAngle(0) + 23, 60)), 1);
    assert.equal(placeAt(...towards(sliceAngle(0) - 23, 60)), 7);
  });

  it('chooses nothing near where the finger came down', () => {
    assert.equal(placeAt(0, 0), null);
    assert.equal(placeAt(...towards(-90, MIDDLE_WITHIN - 1)), null);
  });

  it('stands at the finger where there is room', () => {
    assert.deepEqual(ringMiddle(200, 500, WIDTH, HEIGHT, 30), { x: 200, y: 500 });
  });

  it('is moved in from every edge, whole', () => {
    for (const [x, y] of [[5, 500], [395, 500], [200, 40], [200, 895]] as const) {
      const middle = ringMiddle(x, y, WIDTH, HEIGHT, 30);
      assert.ok(middle.x - RING_RADIUS >= 0 && middle.x + RING_RADIUS <= WIDTH);
      assert.ok(middle.y - RING_RADIUS >= 30 && middle.y + RING_RADIUS <= HEIGHT);
    }
  });
});
