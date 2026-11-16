import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { byColour, colourRank, hslOf } from '../colourOrder.ts';

describe('colour order', () => {
  it('reads a colour into hue, saturation and lightness', () => {
    assert.deepEqual(hslOf('#ff0000'), { h: 0, s: 1, l: 0.5 });
    assert.equal(hslOf('#00ff00')?.h, 120);
    assert.equal(hslOf('not a colour'), null);
  });

  it('runs the colours as a rainbow, red to pink, and the colourless after them dark to light', () => {
    const covers = ['#ffffff', '#0000ff', '#808080', '#ffff00', '#ff0000', '#000000', '#00ff00', '#ff00aa', '#ff8000'];
    assert.deepEqual(byColour(covers, (hex) => hex), [
      '#ff0000',
      '#ff8000',
      '#ffff00',
      '#00ff00',
      '#0000ff',
      '#ff00aa',
      '#000000',
      '#808080',
      '#ffffff',
    ]);
  });

  it('puts a pink that leans to red after the violets rather than before the reds', () => {
    assert.ok((colourRank('#ff0050') ?? 0) > (colourRank('#8000ff') ?? 1));
    assert.ok((colourRank('#ff1000') ?? 1) < (colourRank('#ff8000') ?? 0));
  });

  it('leaves the ones with no colour known at the end, in the order they came', () => {
    const covers = [{ n: 1 }, { n: 2, hex: '#ff0000' }, { n: 3 }];
    assert.deepEqual(
      byColour(covers, (cover) => cover.hex).map((cover) => cover.n),
      [2, 1, 3]
    );
  });
});
