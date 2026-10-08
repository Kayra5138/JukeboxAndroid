import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contrast, luminance } from '../colour.ts';
import { materialColours, samePalette, systemPaletteFrom, TONES } from '../material.ts';
import { effectsOf } from '../effects.ts';
import { THEMES } from '../registry.ts';
import { repaired } from '../repair.ts';
import { dark } from '../themes/dark.ts';
import { light } from '../themes/light.ts';
import type { Palette, SystemPalette } from '../tokens.ts';

/**
 * A phone's palette as a Pixel makes one from a blue wallpaper: the values
 * Android's own documentation shows for its default.
 */
const PIXEL: SystemPalette = {
  accent1: ['#ffffff', '#fefbff', '#f1f0ff', '#dce1ff', '#b5c4ff', '#8fa8ff', '#6a8cf5', '#4f72d9', '#3459be', '#1541a5', '#002a78', '#00174b', '#000000'],
  accent2: ['#ffffff', '#fefbff', '#f1f0ff', '#dde1f9', '#c1c5dc', '#a6aac1', '#8b90a5', '#71768a', '#595d72', '#414659', '#2b3042', '#161b2c', '#000000'],
  neutral1: ['#ffffff', '#fefbff', '#f2f0f4', '#e4e2e6', '#c7c6ca', '#acabaf', '#919094', '#77767a', '#5e5e62', '#46464a', '#303034', '#1b1b1f', '#000000'],
  neutral2: ['#ffffff', '#fefbff', '#f1f0f7', '#e2e1ec', '#c6c5d0', '#abaab4', '#90909a', '#767680', '#5d5e67', '#45464f', '#2f3038', '#1a1b23', '#000000'],
};

/** One a phone's maker might have made badly: every tone between the ends the same mid grey. */
const FLAT: SystemPalette = {
  accent1: TONES.map(() => '#808080'),
  accent2: TONES.map(() => '#808080'),
  neutral1: TONES.map(() => '#7a7a7a'),
  neutral2: TONES.map(() => '#868686'),
};

/** And one with its ramps the wrong way up. */
const UPSIDE_DOWN: SystemPalette = {
  accent1: [...PIXEL.accent1].reverse(),
  accent2: [...PIXEL.accent2].reverse(),
  neutral1: [...PIXEL.neutral1].reverse(),
  neutral2: [...PIXEL.neutral2].reverse(),
};

const GROUNDS = ['bg', 'bar', 'surface'] as const;
const READ = ['text', 'textSecondary', 'textMuted', 'textFaint', 'accent', 'danger', 'success', 'warning'] as const;

/** The rules the written-down themes are held to, said of a palette nobody wrote down. */
function holds(c: Palette, name: string): void {
  for (const ground of GROUNDS) {
    for (const token of READ) {
      const got = contrast(c[token], c[ground]);
      assert.ok(got >= 4.5, `${name}: ${token} on ${ground} is ${got.toFixed(2)}:1`);
    }
  }
  for (const token of ['text', 'textSecondary', 'accent'] as const) {
    const got = contrast(c[token], c.surfaceRaised);
    assert.ok(got >= 4.5, `${name}: ${token} on surfaceRaised is ${got.toFixed(2)}:1`);
  }
  assert.ok(contrast(c.onPrimary, c.primary) >= 4.5, `${name}: onPrimary`);
  assert.ok(contrast(c.onAccent, c.accent) >= 4.5, `${name}: onAccent`);
  assert.ok(contrast(c.text, c.accentSoft) >= 4.5, `${name}: text on accentSoft`);
  assert.ok(contrast(c.danger, c.dangerSoft) >= 4.5, `${name}: danger on dangerSoft`);
  assert.ok(contrast(c.success, c.successSoft) >= 4.5, `${name}: success on successSoft`);

  const levels = [c.text, c.textSecondary, c.textMuted, c.textFaint, c.textDisabled].map((level) =>
    contrast(level, c.bg)
  );
  assert.deepEqual([...levels].sort((a, b) => b - a), levels, `${name}: levels of text`);

  for (const [token, value] of Object.entries(c)) {
    assert.match(value, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${name}.${token}`);
  }
}

describe('a palette from the phone', () => {
  it('is a dark theme from the dark end of the ramps and a light one from the light end', () => {
    const night = materialColours(PIXEL, 'dark', dark.colours);
    const day = materialColours(PIXEL, 'light', light.colours);

    assert.equal(night.bg, PIXEL.neutral1[11]);
    assert.equal(night.text, PIXEL.neutral1[3]);
    assert.equal(night.accent, PIXEL.accent1[4]);
    assert.equal(day.bg, PIXEL.neutral1[2]);
    assert.equal(day.text, PIXEL.neutral1[11]);
    assert.equal(day.accent, PIXEL.accent1[8]);
  });

  it('keeps nearer lighter in the dark and puts a white card on an off-white page in the light', () => {
    const night = materialColours(PIXEL, 'dark', dark.colours);
    assert.ok(luminance(night.bg) < luminance(night.bar));
    assert.ok(luminance(night.bar) < luminance(night.surface));
    assert.ok(luminance(night.surface) < luminance(night.surfaceRaised));

    const day = materialColours(PIXEL, 'light', light.colours);
    assert.ok(luminance(day.surface) > luminance(day.bg));
    assert.ok(luminance(day.surfaceRaised) < luminance(day.bg));
  });

  it('can be read, both ways up, from a palette as a phone ordinarily makes one', () => {
    holds(materialColours(PIXEL, 'dark', dark.colours), 'dark');
    holds(materialColours(PIXEL, 'light', light.colours), 'light');
  });

  it('leaves the signals to the default theme, the wallpaper having no say in what red means', () => {
    const night = materialColours(PIXEL, 'dark', dark.colours);
    assert.equal(night.warning, dark.colours.warning);
    assert.equal(night.scrim, dark.colours.scrim);
  });

  it('can still be read from a palette made badly: the tones are moved until it can', () => {
    for (const [name, palette] of Object.entries({ FLAT, UPSIDE_DOWN })) {
      holds(materialColours(palette, 'dark', dark.colours), `${name} dark`);
      holds(materialColours(palette, 'light', light.colours), `${name} light`);
    }
  });
});

describe('the repair', () => {
  it('changes nothing in a palette that needs nothing', () => {
    assert.deepEqual(repaired(light.colours, 'light'), light.colours);
  });

  it('moves only what fails, and only as far as passing', () => {
    const faint = { ...light.colours, textFaint: '#b0b0b8', accent: '#8ab4f0' };
    const mended = repaired(faint, 'light');
    assert.equal(mended.text, faint.text);
    assert.equal(mended.textMuted, faint.textMuted);
    assert.notEqual(mended.textFaint, faint.textFaint);
    const got = Math.min(...GROUNDS.map((ground) => contrast(mended.textFaint, mended[ground])));
    assert.ok(got >= 4.5 && got < 5, `${got}`);
    assert.ok(contrast(mended.accent, mended.surfaceRaised) >= 4.5);
  });

  it('can be held to more than the guideline', () => {
    const mended = repaired(dark.colours, 'dark', 7);
    for (const ground of GROUNDS) assert.ok(contrast(mended.textFaint, mended[ground]) >= 7);
  });

  it('changes nothing in any theme that is written down, at the ratio it is held to', () => {
    for (const theme of THEMES) {
      // A theme of glass is written in colours with an alpha, which are not grounds to mend text against.
      if (theme.id === 'dark' || theme.dynamic || effectsOf(theme.colours)) continue;
      const ratio = theme.id === 'contrast' ? 7 : 4.5;
      assert.deepEqual(repaired(theme.colours, theme.base, ratio), theme.colours, theme.id);
    }
  });

  it('swaps what is written on a fill for something that can be', () => {
    const mended = repaired({ ...dark.colours, onAccent: '#ffffff', onPrimary: '#ededed' }, 'dark');
    assert.ok(contrast(mended.onAccent, mended.accent) >= 4.5);
    assert.ok(contrast(mended.onPrimary, mended.primary) >= 4.5);
  });
});

describe('what the native side answered', () => {
  it('is a palette when it is four ramps of thirteen colours', () => {
    assert.deepEqual(systemPaletteFrom(PIXEL), PIXEL);
    assert.equal(systemPaletteFrom({ ...PIXEL, accent3: PIXEL.accent1 })?.accent1.length, 13);
  });

  it('is written small, whichever way it arrived', () => {
    const shouted = { ...PIXEL, accent1: PIXEL.accent1.map((colour) => colour.toUpperCase()) };
    assert.deepEqual(systemPaletteFrom(shouted), PIXEL);
  });

  it('is nothing when it is anything else', () => {
    assert.equal(systemPaletteFrom(null), null);
    assert.equal(systemPaletteFrom(undefined), null);
    assert.equal(systemPaletteFrom('#ffffff'), null);
    assert.equal(systemPaletteFrom({}), null);
    assert.equal(systemPaletteFrom({ ...PIXEL, neutral2: undefined }), null);
    assert.equal(systemPaletteFrom({ ...PIXEL, neutral2: PIXEL.neutral2.slice(1) }), null);
    assert.equal(systemPaletteFrom({ ...PIXEL, neutral2: PIXEL.neutral2.map(() => 'red') }), null);
    assert.equal(systemPaletteFrom({ ...PIXEL, neutral2: PIXEL.neutral2.map(() => 4278190080) }), null);
  });

  it('is the same palette when the colours are, however it was handed over', () => {
    assert.ok(samePalette(PIXEL, systemPaletteFrom(JSON.parse(JSON.stringify(PIXEL)))));
    assert.ok(samePalette(null, null));
    assert.ok(!samePalette(PIXEL, null));
    assert.ok(!samePalette(PIXEL, UPSIDE_DOWN));
  });
});
