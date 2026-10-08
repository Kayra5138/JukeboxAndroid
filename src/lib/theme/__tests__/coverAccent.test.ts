import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contrast, toLch } from '../colour.ts';
import { accentFrom, accentReads, colouredStops, coverColour } from '../coverAccent.ts';
import { cover } from '../themes/cover.ts';
import { dark } from '../themes/dark.ts';

const neutrals = dark.colours;

/** How far apart two hues are on a wheel that joins up. */
function apart(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/** Covers of every sort: the dark, the pale, the loud, and round the wheel. */
const COVERS = {
  navy: '#0b1440',
  oxblood: '#3a0a10',
  nearlyBlack: '#140a1e',
  paleYellow: '#fff3b0',
  palePink: '#ffe0ea',
  pureRed: '#ff0000',
  pureBlue: '#0000ff',
  pureGreen: '#00ff00',
  magenta: '#ff00ff',
  mud: '#6b5a2a',
  teal: '#1f8a8a',
};

describe('an accent from a cover', () => {
  it('can be read as text on every dark surface, whatever the cover', () => {
    for (const [name, cover] of Object.entries(COVERS)) {
      const made = accentFrom(cover, neutrals);
      assert.ok(made, name);
      for (const ground of ['bg', 'bar', 'surface', 'surfaceRaised'] as const) {
        const got = contrast(made.accent, neutrals[ground]);
        assert.ok(got >= 4.5, `${name} on ${ground} is ${got.toFixed(2)}:1`);
      }
      assert.ok(accentReads(made, neutrals), name);
    }
  });

  it('is in the range where a colour is an accent: light, and coloured, and not shouting', () => {
    for (const [name, cover] of Object.entries(COVERS)) {
      const { l, c } = toLch(accentFrom(cover, neutrals)!.accent);
      assert.ok(l >= 0.7 && l <= 0.86, `${name}: lightness ${l.toFixed(3)}`);
      assert.ok(c >= 0.05 && c <= 0.16, `${name}: chroma ${c.toFixed(3)}`);
    }
  });

  it('keeps the hue of the cover, which is all it was asked to keep', () => {
    for (const [name, cover] of Object.entries(COVERS)) {
      const before = toLch(cover).h;
      const after = toLch(accentFrom(cover, neutrals)!.accent).h;
      assert.ok(apart(before, after) < 12, `${name}: ${before.toFixed(0)} became ${after.toFixed(0)}`);
    }
  });

  it('lifts a dark cover and calms a loud one', () => {
    assert.ok(toLch(accentFrom(COVERS.navy, neutrals)!.accent).l > toLch(COVERS.navy).l + 0.3);
    assert.ok(toLch(accentFrom(COVERS.magenta, neutrals)!.accent).c < toLch(COVERS.magenta).c - 0.1);
    // A pale one is given colour, not left as a tint of white.
    assert.ok(toLch(accentFrom(COVERS.palePink, neutrals)!.accent).c > toLch(COVERS.palePink).c);
  });

  it('is written on in whichever of dark and white can be read, which here is dark', () => {
    for (const [name, cover] of Object.entries(COVERS)) {
      const made = accentFrom(cover, neutrals)!;
      assert.ok(contrast(made.onAccent, made.accent) >= 4.5, name);
      assert.equal(made.onAccent, neutrals.bg, name);
    }
  });

  it('makes its two fills quieter than itself and nearer the page, in that order', () => {
    const made = accentFrom(COVERS.teal, neutrals)!;
    const far = (colour: string) => contrast(colour, neutrals.bg);
    assert.ok(far(made.accent) > far(made.accentMuted));
    assert.ok(far(made.accentMuted) > far(made.accentSoft));
    assert.ok(far(made.accentSoft) > 1);
    // A switch that is on: the thumb is the accent, on a track of the muted one.
    assert.ok(contrast(made.accent, made.accentMuted) >= 3);
  });

  it('is nothing for a grey cover, or none, so the caller keeps its own', () => {
    assert.equal(accentFrom('#808080', neutrals), null);
    assert.equal(accentFrom('#0a0a0a', neutrals), null);
    assert.equal(accentFrom('#f4f4f4', neutrals), null);
    assert.equal(accentFrom('#8a8580', neutrals), null);
    assert.equal(accentFrom(null, neutrals), null);
    assert.equal(accentFrom('', neutrals), null);
    assert.equal(accentFrom('not a colour', neutrals), null);
  });
});

describe('the colour taken from a cover', () => {
  it('is the middle of the three it is read as', () => {
    assert.equal(coverColour(['#111111', '#222222', '#333333']), '#222222');
  });

  it('is the only one, of one, and nothing, of none', () => {
    assert.equal(coverColour(['#111111']), '#111111');
    assert.equal(coverColour([]), null);
    assert.equal(coverColour(null), null);
  });
});

/*
  What the phone answers for three covers. The stops are what its reader makes
  of each: a hue, a saturation held between 0.45 and 0.95, and three
  lightnesses. A grey has no hue, so it is read at nought, and its stops are
  the red ones below — which is the whole trouble.
*/
const READ = {
  grey: { stops: ['#231313', '#6D3C3C', '#B77C65'], main: '#7C7C7C' },
  blackAndWhite: { stops: ['#231313', '#6D3C3C', '#B77C65'], main: '#101010' },
  // An olive drab, weak enough that its saturation was raised to the floor too.
  muted: { stops: ['#232115', '#6D663C', '#B7B765'], main: '#6B6548' },
  saturated: { stops: ['#041623', '#09456D', '#1BB7B0'], main: '#1479C8' },
};

describe('the stops of a cover that was read', () => {
  it('are nothing when the cover was grey, however red its stops came out', () => {
    assert.equal(colouredStops(READ.grey), null);
    assert.equal(colouredStops(READ.blackAndWhite), null);
    // The stops alone would have passed for a colour: that is the bug.
    assert.ok(accentFrom(coverColour(READ.grey.stops), neutrals));
  });

  it('are its own when it had a colour, a weak one included', () => {
    assert.equal(colouredStops(READ.muted), READ.muted.stops);
    assert.equal(colouredStops(READ.saturated), READ.saturated.stops);
  });

  it('are passed on unjudged by a build that does not say what the colour was', () => {
    assert.deepEqual(colouredStops(READ.grey.stops), READ.grey.stops);
    assert.equal(colouredStops({ stops: READ.grey.stops }), READ.grey.stops);
    assert.equal(colouredStops({ stops: READ.grey.stops, main: null }), READ.grey.stops);
  });

  it('are nothing when there are none', () => {
    assert.equal(colouredStops(null), null);
    assert.equal(colouredStops([]), null);
    assert.equal(colouredStops({ stops: [], main: '#1479C8' }), null);
  });
});

describe('the theme from the cover', () => {
  const themed = (read: Parameters<typeof colouredStops>[0]) =>
    cover.dynamic!.resolve({ scheme: 'dark', cover: colouredStops(read), system: null }).colours;

  it('keeps the default accent for a grey cover', () => {
    assert.equal(themed(READ.grey).accent, neutrals.accent);
    assert.equal(themed(READ.blackAndWhite).accent, neutrals.accent);
    assert.equal(themed(null).accent, neutrals.accent);
  });

  it('takes the hue of a muted cover, and of a saturated one as it always did', () => {
    for (const [name, read] of [['muted', READ.muted], ['saturated', READ.saturated]] as const) {
      const accent = themed(read).accent;
      assert.notEqual(accent, neutrals.accent, name);
      assert.ok(apart(toLch(accent).h, toLch(read.stops[1]).h) < 12, name);
    }
    // Knowing the colour changes nothing for a cover that has one.
    assert.equal(themed(READ.saturated).accent, themed(READ.saturated.stops).accent);
  });
});
