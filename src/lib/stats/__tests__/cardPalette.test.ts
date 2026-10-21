import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contrast } from '../../theme/colour.ts';
import {
  CARD_PALETTES,
  CARD_READ_RATIO,
  legibleStops,
  readableUnder,
  softOver,
} from '../cardPalette.ts';

describe('the colours of the recap cards', () => {
  it('carry white at 4.5:1 on every stop of every palette', () => {
    for (const [card, stops] of Object.entries(CARD_PALETTES)) {
      for (const stop of stops) {
        const got = contrast('#ffffff', stop);
        assert.ok(got >= CARD_READ_RATIO, `${card}: white on ${stop} is ${got.toFixed(2)}:1`);
      }
    }
  });

  it('carry the quieter writing at 4.5:1 on every stop as well', () => {
    for (const [card, stops] of Object.entries(CARD_PALETTES)) {
      for (const stop of stops) {
        const got = contrast(softOver(stop), stop);
        assert.ok(got >= CARD_READ_RATIO, `${card}: the quieter white on ${stop} is ${got.toFixed(2)}:1`);
      }
    }
  });

  it('still run dark to light, so each card keeps its corner to write the heading in', () => {
    for (const [card, [first, , last]] of Object.entries(CARD_PALETTES)) {
      assert.ok(contrast('#ffffff', first) > contrast('#ffffff', last), card);
    }
  });
});

describe('the colours read out of a cover', () => {
  it('are taken down until the writing can be read on them, however light the cover', () => {
    const bright = ['#FFF8E1', '#FBBF24', '#FFFFFF'] as const;
    for (const stop of legibleStops(bright)) assert.ok(readableUnder(stop), stop);
  });

  it('are left as they were where the writing could already be read', () => {
    const dark = ['#1B1040', '#4C1D95', '#2B0A3D'] as const;
    assert.deepEqual(legibleStops(dark), dark);
  });

  it('keep their hue while they are darkened, as far as can be told by which channel leads', () => {
    const [, , warm] = legibleStops(['#000000', '#000000', '#FBBF24']);
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(warm.slice(at, at + 2), 16));
    assert.ok(r! >= g! && g! > b!, warm);
  });
});
