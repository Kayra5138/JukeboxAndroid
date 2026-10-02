import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CONFETTI_COLOURS, CONFETTI_SEC, confettiFor, scrapAt } from '../confetti.ts';

const WIDTH = 360;
const HEIGHT = 780;

describe('confetti', () => {
  const burst = confettiFor(40, WIDTH, HEIGHT);

  it('is the same burst every time', () => {
    assert.deepEqual(confettiFor(40, WIDTH, HEIGHT), burst);
    assert.notDeepEqual(confettiFor(40, WIDTH, HEIGHT, 8), burst);
  });

  it('is thrown from both sides, towards the middle', () => {
    const left = burst.filter((scrap) => scrap.x0 < 0);
    const right = burst.filter((scrap) => scrap.x0 > WIDTH);
    assert.equal(left.length, 20);
    assert.equal(right.length, 20);
    assert.ok(left.every((scrap) => scrap.vx > 0));
    assert.ok(right.every((scrap) => scrap.vx < 0));
  });

  it('asks only for colours there are', () => {
    assert.ok(burst.every((scrap) => scrap.colour >= 0 && scrap.colour < CONFETTI_COLOURS));
  });

  it('shows nothing before a scrap has left, and nothing once it is over', () => {
    for (const scrap of burst) {
      assert.equal(scrapAt(scrap, 0).opacity, 0);
      assert.equal(scrapAt(scrap, scrap.delay).opacity, 0);
      assert.equal(scrapAt(scrap, CONFETTI_SEC).opacity, 0);
      assert.equal(scrapAt(scrap, CONFETTI_SEC + 5).opacity, 0);
      assert.equal(scrapAt(scrap, scrap.delay + 0.5).opacity, 1);
    }
  });

  it('fades out rather than stopping', () => {
    const scrap = burst[0]!;
    const late = scrapAt(scrap, CONFETTI_SEC - 0.35).opacity;
    assert.ok(late > 0.4 && late < 0.6, `half way through the fade it is ${late}`);
  });

  it('goes up, hangs, and comes down slower than it went', () => {
    for (const scrap of burst) {
      let highest = scrap.y0;
      let when = 0;
      for (let t = 0; t <= CONFETTI_SEC; t += 0.02) {
        const { y } = scrapAt(scrap, scrap.delay + t + 0.001);
        if (y < highest) {
          highest = y;
          when = t;
        }
      }
      assert.ok(highest < scrap.y0 - HEIGHT * 0.25, 'it rises a good way');
      assert.ok(highest > -HEIGHT * 0.1, `and does not leave by the top (${highest})`);
      assert.ok(when > 0.5 && when < 1.6, `the top of the throw is at ${when}s`);

      const rising = scrap.y0 - scrapAt(scrap, scrap.delay + 0.2).y;
      const falling = scrapAt(scrap, scrap.delay + when + 0.7).y - scrapAt(scrap, scrap.delay + when + 0.5).y;
      assert.ok(falling > 0, 'it is on the way down after the top');
      assert.ok(falling < rising, 'and slower than it went up');
    }
  });

  it('stays on the board from side to side', () => {
    for (const scrap of burst) {
      for (let t = 0.6; t < CONFETTI_SEC; t += 0.1) {
        const { x } = scrapAt(scrap, t);
        assert.ok(x > -40 && x < WIDTH + 40, `x ${x} at ${t}s`);
      }
    }
  });

  it('never turns fully edge on', () => {
    for (const scrap of burst) {
      for (let t = 0.4; t < CONFETTI_SEC; t += 0.013) {
        assert.ok(scrapAt(scrap, t).flat >= 0.25);
      }
    }
  });

  it('is scaled to the board it is thrown over', () => {
    const tall = confettiFor(40, WIDTH * 2, HEIGHT * 2);
    for (let index = 0; index < tall.length; index++) {
      assert.ok(Math.abs(tall[index]!.vy - burst[index]!.vy * 2) < 1e-6);
    }
  });
});
