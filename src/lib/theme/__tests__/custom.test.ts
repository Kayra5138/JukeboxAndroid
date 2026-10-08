import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contrast, fromLch, luminance, toLch } from '../colour.ts';
import {
  customColours,
  DEFAULT_SEEDS,
  sameSeeds,
  SEED_PRESETS,
  seedColour,
  seedsFrom,
  seedsToSetting,
  type CustomSeeds,
} from '../custom.ts';
import { NOTHING_AROUND, needsOf, resolveTheme, themeOf } from '../registry.ts';
import { repaired } from '../repair.ts';
import type { Palette } from '../tokens.ts';

/** Everything text is written on, a chip included: a theme somebody made has no history to excuse a caption on one. */
const GROUNDS = ['bg', 'bar', 'surface', 'surfaceRaised'] as const satisfies readonly (keyof Palette)[];

/** Everything meant to be read at an ordinary size. */
const READ = [
  'text',
  'textSecondary',
  'textMuted',
  'textFaint',
  'accent',
  'danger',
  'success',
  'warning',
] as const satisfies readonly (keyof Palette)[];

/** The rules the written-down themes are held to, and a little more, said of a palette somebody made. */
function holds(seeds: CustomSeeds): void {
  const name = seedsToSetting(seeds);
  const { base, colours: c } = customColours(seeds);

  for (const [token, value] of Object.entries(c)) {
    assert.match(value, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${name}.${token}`);
  }

  for (const ground of GROUNDS) {
    for (const token of READ) {
      const got = contrast(c[token], c[ground]);
      assert.ok(got >= 4.5, `${name}: ${token} on ${ground} is ${got.toFixed(2)}:1`);
    }
  }
  assert.ok(contrast(c.onPrimary, c.primary) >= 4.5, `${name}: onPrimary`);
  assert.ok(contrast(c.onAccent, c.accent) >= 4.5, `${name}: onAccent`);
  assert.ok(contrast(c.onSelected, c.selected) >= 4.5, `${name}: onSelected`);
  assert.ok(contrast(c.text, c.accentSoft) >= 4.5, `${name}: text on accentSoft`);
  assert.ok(contrast(c.danger, c.dangerSoft) >= 4.5, `${name}: danger on dangerSoft`);
  assert.ok(contrast(c.success, c.successSoft) >= 4.5, `${name}: success on successSoft`);

  const levels = [c.text, c.textSecondary, c.textMuted, c.textFaint, c.textDisabled].map((level) =>
    contrast(level, c.bg)
  );
  assert.deepEqual([...levels].sort((a, b) => b - a), levels, `${name}: levels of text`);

  // The way up it says it is, is the way up its page is: dark ink is the louder on a light one.
  const lightPage = contrast('#000000', c.bg) > contrast('#ffffff', c.bg);
  assert.equal(base, lightPage ? 'light' : 'dark', `${name}: base`);

  // As in every theme that is a look: no edge, and what is chosen is a chip with the words on it.
  assert.equal(c.outline, '#00000000', name);
  assert.equal(c.selected, c.surfaceRaised, name);
  assert.equal(c.onSelected, c.text, name);

  // Made to pass, not mended into passing: the repair finds nothing left to do.
  assert.deepEqual(repaired(c, base), c, `${name}: repaired`);
}

/**
 * Pages from every part of the scale: black, white and the grey nothing can
 * be read on, then twelve hues round the wheel, each from nearly black to
 * nearly white and from a tint to as strong as a screen can show.
 */
const PAGES = [
  '#000000',
  '#ffffff',
  '#808080',
  '#777777',
  '#121212',
  '#f4f4f6',
  ...Array.from({ length: 12 }, (_, hue) =>
    [0.08, 0.2, 0.35, 0.5, 0.62, 0.75, 0.9, 0.98].flatMap((l) =>
      [0.02, 0.1, 0.3].map((c) => fromLch({ l, c, h: hue * 30 }))
    )
  ).flat(),
];

/** Accents likewise, with the ones that are no accent at all: a grey, black, white. */
const ACCENTS = [
  '#808080',
  '#000000',
  '#ffffff',
  '#7ab8ff',
  '#1a62c2',
  '#ff0000',
  '#ffff00',
  '#00ff00',
  '#0000ff',
  '#ff00ff',
  '#3a1a4a',
  '#f2b05e',
];

describe('a theme somebody made', () => {
  it('can be read whatever it was made from, with the card left to the page', () => {
    for (const background of PAGES) {
      for (const accent of ACCENTS) holds({ background, accent, surface: null });
    }
  });

  it('can be read with an accent that is the page, or next to it', () => {
    for (const background of PAGES) {
      const { l, c, h } = toLch(background);
      holds({ background, accent: background, surface: null });
      holds({ background, accent: fromLch({ l: l + 0.04, c, h }), surface: null });
      holds({ background, accent: fromLch({ l: l - 0.04, c, h: h + 20 }), surface: background });
    }
  });

  it('can be read with a card that was chosen, the wrong way up from the page included', () => {
    const cards = ['#000000', '#ffffff', '#808080', '#1c1c1c', '#fff9fb', '#18243c', '#c02020', '#e8d06a'];
    for (const background of PAGES) {
      for (const surface of cards) {
        holds({ background, accent: '#7ab8ff', surface });
        holds({ background, accent: '#85560a', surface });
      }
    }
  });

  it('is a dark theme on a dark page and a light one on a light page, without being asked', () => {
    assert.equal(customColours({ background: '#000000', accent: '#7ab8ff', surface: null }).base, 'dark');
    assert.equal(customColours({ background: '#101a2e', accent: '#7ab8ff', surface: null }).base, 'dark');
    assert.equal(customColours({ background: '#ffffff', accent: '#7ab8ff', surface: null }).base, 'light');
    assert.equal(customColours({ background: '#f3ecdf', accent: '#7ab8ff', surface: null }).base, 'light');
  });

  it('keeps the page that was chosen, wherever words can be written on it', () => {
    for (const background of ['#000000', '#121212', '#101a2e', '#2a1418', '#ffffff', '#f4f4f6', '#fbf3f6', '#f0c020']) {
      assert.equal(customColours({ background, accent: '#7ab8ff', surface: null }).colours.bg, background);
    }
    // A mid grey is no page: it is moved to the nearer side, and no further than it must be.
    const { base, colours } = customColours({ background: '#808080', accent: '#7ab8ff', surface: null });
    assert.equal(base, 'light');
    assert.notEqual(colours.bg, '#808080');
    assert.ok(luminance(colours.bg) < 0.45, colours.bg);
  });

  it('keeps the accent that was chosen where it can be read, and its hue where it cannot', () => {
    const night = customColours({ background: '#121212', accent: '#7ab8ff', surface: null }).colours;
    assert.equal(night.accent, '#7ab8ff');

    // The sky blue that glows on black cannot be read on white; it is taken down, still a blue.
    const day = customColours({ background: '#ffffff', accent: '#7ab8ff', surface: null }).colours;
    assert.notEqual(day.accent, '#7ab8ff');
    assert.ok(luminance(day.accent) < luminance('#7ab8ff'));
    assert.ok(Math.abs(toLch(day.accent).h - toLch('#7ab8ff').h) < 8, day.accent);
  });

  it('puts nearer lighter on a dark page: the bar, a card, a chip', () => {
    for (const background of ['#121212', '#0f1f20', '#1d1430']) {
      const c = customColours({ background, accent: '#7ab8ff', surface: null }).colours;
      assert.ok(luminance(c.bg) < luminance(c.bar), background);
      assert.ok(luminance(c.bar) < luminance(c.surface), background);
      assert.ok(luminance(c.surface) < luminance(c.surfaceRaised), background);
      assert.ok(luminance(c.surfaceRaised) < luminance(c.border), background);
      assert.ok(luminance(c.border) < luminance(c.borderStrong), background);
    }
  });

  it('is black to its edges on a black page, with a card that is barely there', () => {
    const c = customColours({ background: '#000000', accent: '#7ab8ff', surface: null }).colours;
    assert.equal(c.bg, '#000000');
    assert.equal(c.bar, '#000000');
    assert.ok(luminance(c.surface) > 0 && luminance(c.surface) < 0.01, c.surface);
  });

  it('puts a lighter card on a light page where there is lighter to be had, and a darker one on white', () => {
    const offWhite = customColours({ background: '#f4f4f6', accent: '#1a62c2', surface: null }).colours;
    assert.ok(luminance(offWhite.surface) > luminance(offWhite.bg));
    assert.ok(luminance(offWhite.surfaceRaised) < luminance(offWhite.bg));

    const white = customColours({ background: '#ffffff', accent: '#1a62c2', surface: null }).colours;
    assert.equal(white.bg, '#ffffff');
    assert.ok(luminance(white.surface) < luminance(white.bg));
    assert.ok(luminance(white.surfaceRaised) < luminance(white.surface));
  });

  it('uses the card that was chosen, and steps the chip from it', () => {
    const c = customColours({ background: '#101a2e', accent: '#7ab8ff', surface: '#281d3e' }).colours;
    assert.equal(c.bg, '#101a2e');
    assert.equal(c.surface, '#281d3e');
    assert.ok(luminance(c.surfaceRaised) > luminance(c.surface));
  });

  it('leans its words towards the page, and never further than a tint', () => {
    const c = customColours({ background: '#1d1430', accent: '#c79bff', surface: null }).colours;
    for (const level of [c.text, c.textSecondary, c.textMuted, c.textFaint]) {
      const { c: strength, h } = toLch(level);
      assert.ok(strength > 0.002 && strength < 0.03, `${level} is ${strength}`);
      assert.ok(Math.abs(h - toLch('#1d1430').h) < 12, level);
    }
  });

  it('gives the same answer for the same question', () => {
    const seeds = { background: '#2b2118', accent: '#e8d06a', surface: '#372b20' };
    assert.deepEqual(customColours(seeds), customColours({ ...seeds }));
  });

  it('is the default’s palette for seeds that are not colours', () => {
    const broken = customColours({ background: 'teal', accent: '', surface: 'card' });
    assert.deepEqual(broken, customColours(DEFAULT_SEEDS));
  });
});

describe('the colours a custom theme is stored as', () => {
  it('come back as they went', () => {
    for (const seeds of [
      DEFAULT_SEEDS,
      { background: '#ffffff', accent: '#1a62c2', surface: null },
      { background: '#101a2e', accent: '#7ab8ff', surface: '#281d3e' },
    ]) {
      assert.deepEqual(seedsFrom(seedsToSetting(seeds)), { ...seeds });
    }
  });

  it('are the defaults when nothing is stored, and the very same ones', () => {
    assert.equal(seedsFrom(null), DEFAULT_SEEDS);
    assert.equal(seedsFrom(''), DEFAULT_SEEDS);
  });

  it('are written small and with six digits, however they were stored', () => {
    assert.deepEqual(seedsFrom('{"background":"FFF","accent":"#1A62C2"}'), {
      background: '#ffffff',
      accent: '#1a62c2',
      surface: null,
    });
  });

  it('are the defaults, whole, for anything that is not two colours and perhaps a third', () => {
    for (const stored of [
      'not json',
      'null',
      '[]',
      '42',
      '"#ffffff"',
      '{}',
      '{"background":"#ffffff"}',
      '{"background":"#ffffff","accent":"blue"}',
      '{"background":12,"accent":"#1a62c2"}',
      '{"background":"#ffffff","accent":"#1a62c2","surface":"card"}',
      '{"background":"#ffffff","accent":"#1a62c2","surface":7}',
      '{"background":"#ffffff80","accent":"#1a62c2"}',
      '{"background":"#fffff","accent":"#1a62c2"}',
    ]) {
      assert.equal(seedsFrom(stored), DEFAULT_SEEDS, stored);
    }
  });

  it('are told apart by their colours and not by which object they are', () => {
    assert.ok(sameSeeds(DEFAULT_SEEDS, { ...DEFAULT_SEEDS }));
    assert.ok(!sameSeeds(DEFAULT_SEEDS, { ...DEFAULT_SEEDS, surface: '#000000' }));
    assert.ok(!sameSeeds(DEFAULT_SEEDS, { ...DEFAULT_SEEDS, accent: '#000000' }));
  });
});

describe('a colour somebody typed', () => {
  it('is read with the mark or without it, in three digits or six, in either case', () => {
    assert.equal(seedColour('#1A62C2'), '#1a62c2');
    assert.equal(seedColour('1a62c2'), '#1a62c2');
    assert.equal(seedColour(' #fa0 '), '#ffaa00');
    assert.equal(seedColour('FA0'), '#ffaa00');
  });

  it('is nothing until it is a whole colour', () => {
    for (const typed of ['', '#', '#1a', '#1a62', '#1a62c', '#1a62c2f', '#1a62c2ff', 'blue', '#gggggg', '#1a 2c2']) {
      assert.equal(seedColour(typed), null, typed);
    }
  });
});

describe('the colours to start a custom theme from', () => {
  it('are colours, a dozen or so for each of the three, with no two the same', () => {
    for (const [role, presets] of Object.entries(SEED_PRESETS)) {
      assert.ok(presets.length >= 10 && presets.length <= 12, role);
      assert.equal(new Set(presets).size, presets.length, role);
      for (const preset of presets) assert.equal(seedColour(preset), preset, `${role}: ${preset}`);
    }
  });

  it('include the default’s own page and accent, so that they can be gone back to one at a time', () => {
    assert.ok(SEED_PRESETS.background.includes(DEFAULT_SEEDS.background));
    assert.ok(SEED_PRESETS.accent.includes(DEFAULT_SEEDS.accent));
  });
});

describe('the custom theme among the others', () => {
  const seeds: CustomSeeds = { background: '#fbf3f6', accent: '#a3446c', surface: null };

  it('is its default until colours are chosen, and says it needs them', () => {
    assert.deepEqual(needsOf('custom'), ['custom']);
    assert.equal(resolveTheme('custom', 'dark').colours, themeOf('custom').colours);
    assert.deepEqual(themeOf('custom').colours, customColours(DEFAULT_SEEDS).colours);
    assert.equal(themeOf('custom').base, 'dark');
  });

  it('is made from the colours chosen, and is whichever way up they are whatever the phone says', () => {
    const made = resolveTheme('custom', 'dark', { ...NOTHING_AROUND, custom: seeds });
    assert.equal(made.id, 'custom');
    assert.equal(made.base, 'light');
    assert.deepEqual(made.colours, customColours(seeds).colours);
  });

  it('is the very same object until the colours are, so that nothing is redrawn for nothing', () => {
    const around = { ...NOTHING_AROUND, custom: seeds };
    assert.equal(resolveTheme('custom', 'dark', around), resolveTheme('custom', 'dark', { ...around }));
    // A change in what it never looks at is no change to it.
    assert.equal(
      resolveTheme('custom', 'dark', around),
      resolveTheme('custom', 'dark', { ...around, cover: ['#000000'] })
    );
    // New colours are a new object, and that is what makes it again.
    assert.notEqual(
      resolveTheme('custom', 'dark', around),
      resolveTheme('custom', 'dark', { ...around, custom: { ...seeds, accent: '#1a62c2' } })
    );
  });

  it('leaves every other theme as it was when its colours change', () => {
    const cover = ['#2a0a0a', '#a02828', '#e06060'];
    assert.equal(
      resolveTheme('cover', 'dark', { ...NOTHING_AROUND, cover, custom: seeds }),
      resolveTheme('cover', 'dark', { ...NOTHING_AROUND, cover, custom: { ...seeds } })
    );
  });
});
