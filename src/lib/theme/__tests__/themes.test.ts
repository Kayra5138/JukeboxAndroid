import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGUAGES } from '../../i18n/languages.ts';
import {
  isOffered,
  needsOf,
  NOTHING_AROUND,
  resolveTheme,
  SYSTEM_DARK,
  SYSTEM_LIGHT,
  THEME_GROUPS,
  themeChoiceFrom,
  themeOf,
  THEMES,
} from '../registry.ts';
import { outlined, outlinedClip, outlineWidth, OUTLINE_WIDTH } from '../edges.ts';
import type { Palette, Theme } from '../tokens.ts';

/** How bright a colour is to the eye, from nought to one, as WCAG reckons it. */
function luminance(hex: string): number {
  const channel = (at: number) => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high! + 0.05) / (low! + 0.05);
}

/** What text is written on. */
const GROUNDS = ['bg', 'bar', 'surface'] as const satisfies readonly (keyof Palette)[];

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

/**
 * The levels the original dark theme has always drawn fainter than the
 * guideline, kept as they were; see `themes/dark.ts`. They are still held to
 * the figure for large text, so that they cannot drift further.
 */
const QUIET_IN_DARK: readonly (keyof Palette)[] = ['textMuted', 'textFaint'];

/**
 * How far apart a theme's text and its grounds have to be: WCAG's AA for a
 * theme that is a look, and its AAA for the one that is there for being read.
 */
function wanted(theme: Theme, token: keyof Palette): number {
  if (theme.id === 'contrast') return 7;
  /*
    By palette and not by name: the themes that are `dark` until they have
    been worked out are `dark`'s very colours, and are allowed what it is.
    Nothing drawn anew is.
  */
  if (theme.colours === themeOf('dark').colours && QUIET_IN_DARK.includes(token)) return 3;
  return 4.5;
}

describe('the themes', () => {
  it('have an id each, and none of them is the word for following the phone', () => {
    const ids = THEMES.map((theme) => theme.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!(ids as string[]).includes('system'));
  });

  it('are written as six- or eight-digit colours, so that they can be measured', () => {
    for (const theme of THEMES) {
      for (const [token, value] of Object.entries(theme.colours)) {
        assert.match(value, /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${theme.id}.${token}`);
      }
    }
  });

  it('can be read: 4.5:1 for everything meant to be', () => {
    for (const theme of THEMES) {
      for (const ground of GROUNDS) {
        for (const token of READ) {
          const least = wanted(theme, token);
          const got = contrast(theme.colours[token], theme.colours[ground]);
          assert.ok(
            got >= least,
            `${theme.id}: ${token} on ${ground} is ${got.toFixed(2)}:1, wanted ${least}:1`
          );
        }
      }
    }
  });

  it('can be read on a chip as well, for the words that go on one', () => {
    for (const theme of THEMES) {
      for (const token of ['text', 'textSecondary', 'accent'] as const) {
        const got = contrast(theme.colours[token], theme.colours.surfaceRaised);
        assert.ok(
          got >= wanted(theme, token),
          `${theme.id}: ${token} on surfaceRaised is ${got.toFixed(2)}:1`
        );
      }
    }
  });

  it('has nothing faint in the one for being read: 7:1 on a chip too, and its fills written on at 7:1', () => {
    const { colours } = themeOf('contrast');
    for (const token of READ) {
      const got = contrast(colours[token], colours.surfaceRaised);
      assert.ok(got >= 7, `${token} on surfaceRaised is ${got.toFixed(2)}:1`);
    }
    assert.ok(contrast(colours.onPrimary, colours.primary) >= 7);
    assert.ok(contrast(colours.onAccent, colours.accent) >= 7);
    assert.ok(contrast(colours.text, colours.accentSoft) >= 7);
    assert.ok(contrast(colours.danger, colours.dangerSoft) >= 7);
    assert.ok(contrast(colours.success, colours.successSoft) >= 7);
    // What is "not for reading" elsewhere can still be read here.
    for (const ground of [...GROUNDS, 'surfaceRaised'] as const) {
      assert.ok(contrast(colours.textDisabled, colours[ground]) >= 4.5, `textDisabled on ${ground}`);
    }
  });

  it('draws lines that can be seen in the one for being read: 3:1 against every surface', () => {
    const { colours } = themeOf('contrast');
    for (const ground of [...GROUNDS, 'surfaceRaised'] as const) {
      for (const line of ['border', 'borderStrong'] as const) {
        const got = contrast(colours[line], colours[ground]);
        assert.ok(got >= 3, `${line} on ${ground} is ${got.toFixed(2)}:1`);
      }
    }
  });

  it('tells good from bad from doubtful by lightness as well as hue, in the one for being read', () => {
    const { colours } = themeOf('contrast');
    const light = [colours.success, colours.warning, colours.danger].map((c) => contrast(c, '#000000'));
    assert.ok(light[0]! - light[1]! >= 2 && light[1]! - light[2]! >= 2, light.join(' > '));
  });

  it('is true black on every surface in the one for being read, and still written on at 7:1', () => {
    const { colours } = themeOf('contrast');
    for (const ground of GROUNDS) assert.equal(colours[ground], '#000000', ground);
    for (const token of READ) {
      const got = contrast(colours[token], colours.surface);
      assert.ok(got >= 7, `${token} on surface is ${got.toFixed(2)}:1`);
    }
    // The held-back accent is a fill that words go on as well: a chip that is on.
    assert.ok(contrast(colours.text, colours.accentMuted) >= 7, 'text on accentMuted');
  });

  it('is black where a pixel should be off, in the one for that', () => {
    const { colours } = themeOf('black');
    assert.equal(colours.bg, '#000000');
    assert.equal(colours.bar, '#000000');
  });

  it('can be read on its own fills', () => {
    for (const theme of THEMES) {
      const { colours } = theme;
      assert.ok(contrast(colours.onPrimary, colours.primary) >= 4.5, `${theme.id}: onPrimary`);
      assert.ok(contrast(colours.onAccent, colours.accent) >= 4.5, `${theme.id}: onAccent`);
      assert.ok(contrast(colours.text, colours.accentSoft) >= 4.5, `${theme.id}: text on accentSoft`);
      assert.ok(contrast(colours.danger, colours.dangerSoft) >= 4.5, `${theme.id}: danger on dangerSoft`);
      assert.ok(contrast(colours.success, colours.successSoft) >= 4.5, `${theme.id}: success on successSoft`);
    }
  });

  it('keep the order screens lean on: each level of text quieter than the last', () => {
    for (const theme of THEMES) {
      const { colours } = theme;
      const levels = [
        colours.text,
        colours.textSecondary,
        colours.textMuted,
        colours.textFaint,
        colours.textDisabled,
      ].map((level) => contrast(level, colours.bg));
      assert.deepEqual([...levels].sort((a, b) => b - a), levels, theme.id);
    }
  });

  it('are each in a group the picker shows, on the base their page is', () => {
    for (const theme of THEMES) {
      assert.ok((THEME_GROUPS as readonly string[]).includes(theme.group), theme.id);
      const lightPage = luminance(theme.colours.bg) > 0.5;
      assert.equal(theme.base, lightPage ? 'light' : 'dark', theme.id);
      if (theme.group === 'light' || theme.group === 'dark') assert.equal(theme.group, theme.base, theme.id);
    }
  });

  it('have a name in every language', () => {
    for (const theme of THEMES) {
      for (const language of LANGUAGES) {
        assert.ok(language.strings.themes[theme.nameKey], `${theme.id} in ${language.id}`);
      }
    }
  });
});

/** A colour laid over another at the strength its last two digits say, as one flat colour. */
function over(wash: string, ground: string): string {
  const alpha = wash.length === 9 ? parseInt(wash.slice(7, 9), 16) / 255 : 1;
  const channel = (at: number) =>
    Math.round(parseInt(wash.slice(at, at + 2), 16) * alpha + parseInt(ground.slice(at, at + 2), 16) * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Every theme as it is drawn, the worked-out ones both before and after they are worked out. */
function drawn(): { name: string; theme: Theme }[] {
  const around = { cover: ['#2a0a0a', '#a02828', '#e06060'], system: SOME_PALETTE };
  return [
    ...THEMES.map((theme) => ({ name: theme.id, theme: theme as Theme })),
    { name: 'cover, playing', theme: resolveTheme('cover', 'dark', around) },
    { name: 'material, by night', theme: resolveTheme('material', 'dark', around) },
    { name: 'material, by day', theme: resolveTheme('material', 'light', around) },
  ];
}

describe('the edge round a surface', () => {
  it('is a token of every theme, as what is chosen and what is written on that are', () => {
    for (const { name, theme } of drawn()) {
      for (const token of ['outline', 'selected', 'onSelected'] as const) {
        assert.match(theme.colours[token] ?? '', /^#[0-9a-f]{6}([0-9a-f]{2})?$/, `${name}.${token}`);
      }
    }
  });

  it('is not there at all in a theme that is a look: no line, no width, and a style left as it was', () => {
    for (const { name, theme } of drawn()) {
      if (theme.id === 'contrast') continue;
      assert.match(theme.colours.outline, /^#[0-9a-f]{6}00$/, name);
      assert.equal(outlineWidth(theme.colours), 0, name);
      // Not a border of no width: no border. Nothing for a layout to round differently.
      assert.deepEqual(outlined(theme.colours), {}, name);
      assert.deepEqual(outlined(theme.colours, theme.colours.accent), {}, name);
      assert.deepEqual({ padding: 4, ...outlined(theme.colours) }, { padding: 4 }, name);
      // A view that cuts its contents to its shape is told of a border of no
      // width rather than of none: told nothing, Android keeps cutting to the
      // shape it had under the last theme that drew one.
      assert.deepEqual(outlinedClip(theme.colours), { borderWidth: 0, borderColor: 'transparent' }, name);
    }
  });

  it('leaves what is chosen looking as it did in a theme that is a look: a chip, with the words on it', () => {
    for (const { name, theme } of drawn()) {
      if (theme.id === 'contrast') continue;
      assert.equal(theme.colours.selected, theme.colours.surfaceRaised, name);
      assert.equal(theme.colours.onSelected, theme.colours.text, name);
    }
  });

  it('is a line that can be seen in the one for being read: 3:1 against the page and every surface', () => {
    const { colours } = themeOf('contrast');
    assert.equal(outlineWidth(colours), OUTLINE_WIDTH);
    assert.ok(OUTLINE_WIDTH >= 1);
    assert.deepEqual(outlined(colours), { borderWidth: OUTLINE_WIDTH, borderColor: colours.outline });
    assert.deepEqual(outlined(colours, colours.accent), { borderWidth: OUTLINE_WIDTH, borderColor: colours.accent });
    assert.deepEqual(outlinedClip(colours), outlined(colours));
    for (const ground of [...GROUNDS, 'surfaceRaised', 'scrim'] as const) {
      // The scrim is nearly black over whatever is behind; over the page is the case that matters.
      const under = ground === 'scrim' ? over(colours.scrim, colours.bg) : colours[ground];
      const got = contrast(colours.outline, under);
      assert.ok(got >= 3, `outline on ${ground} is ${got.toFixed(2)}:1`);
    }
  });

  it('tells the chosen from the rest by 3:1 in the one for being read, and can be read on both', () => {
    const { colours } = themeOf('contrast');
    // A segment that is on, against one that is not and against what both sit on.
    for (const rest of ['bg', 'bar', 'surface', 'surfaceRaised'] as const) {
      const got = contrast(colours.selected, colours[rest]);
      assert.ok(got >= 3, `selected against ${rest} is ${got.toFixed(2)}:1`);
    }
    assert.ok(contrast(colours.onSelected, colours.selected) >= 7, 'onSelected on selected');
    // A chip filled with the button's colour when chosen, as the settings draw theirs.
    assert.ok(contrast(colours.primary, colours.surfaceRaised) >= 3, 'primary against a chip');
    // A chip that is on in the held-back accent is ringed in the accent: the ring against the chip and the card.
    for (const under of ['accentMuted', 'surface', 'surfaceRaised'] as const) {
      assert.ok(contrast(colours.accent, colours[under]) >= 3, `accent ring on ${under}`);
    }
  });

  it('shows a finger on something in the one for being read: 3:1 against what it is laid over', () => {
    const { colours } = themeOf('contrast');
    for (const ground of GROUNDS) {
      const got = contrast(over(colours.pressed, colours[ground]), colours[ground]);
      assert.ok(got >= 3, `pressed over ${ground} is ${got.toFixed(2)}:1`);
    }
  });

  it('shows how far a bar has got in the one for being read: the fill 3:1 against its track, the track against the page', () => {
    const { colours } = themeOf('contrast');
    assert.ok(contrast(colours.text, colours.borderStrong) >= 3, 'the fill on the track');
    assert.ok(contrast(colours.accent, colours.borderStrong) >= 3, 'a slider, filled in the accent');
    for (const ground of GROUNDS) assert.ok(contrast(colours.borderStrong, colours[ground]) >= 3, ground);
  });

  it('shows a switch against the page in the one for being read, and its thumb against its track', () => {
    const { colours } = themeOf('contrast');
    assert.ok(contrast(colours.switchTrack, colours.surface) >= 3, 'the track, off');
    assert.ok(contrast(colours.switchThumb, colours.switchTrack) >= 3, 'the thumb, off');
    assert.ok(contrast(colours.accent, colours.accentMuted) >= 3, 'the thumb, on');
  });
});

describe('which theme is drawn', () => {
  it('is the one chosen, whatever the phone says', () => {
    assert.equal(resolveTheme('light', 'dark').id, 'light');
    assert.equal(resolveTheme('dark', 'light').id, 'dark');
  });

  it('follows the phone when told to, and is dark when the phone does not say', () => {
    assert.equal(resolveTheme('system', 'light').id, SYSTEM_LIGHT);
    assert.equal(resolveTheme('system', 'dark').id, SYSTEM_DARK);
    assert.equal(resolveTheme('system', null).id, SYSTEM_DARK);
    assert.equal(resolveTheme('system', undefined).id, SYSTEM_DARK);
  });

  it('follows the phone for a setting that is absent or names no theme', () => {
    assert.equal(themeChoiceFrom(null), 'system');
    assert.equal(themeChoiceFrom('system'), 'system');
    assert.equal(themeChoiceFrom('solarised'), 'system');
    assert.equal(themeChoiceFrom('sepia'), 'sepia');
    assert.equal(themeChoiceFrom('light'), 'light');
  });

  it('answers the base the status bar needs', () => {
    assert.equal(themeOf('light').base, 'light');
    assert.equal(themeOf('dark').base, 'dark');
  });
});

/** A phone's palette of plain greys and blues, enough to tell which way up a theme came out. */
const ramp = (tint: string) => [
  '#ffffff', '#fefbff', '#f1f0f7', `#e2e2e${tint}`, '#c6c6d0', '#aaabb4', '#90909a',
  '#76777f', '#5d5e67', '#45464f', '#2f3038', '#1a1b23', '#000000',
];
const SOME_PALETTE = { accent1: ramp('9'), accent2: ramp('9'), neutral1: ramp('9'), neutral2: ramp('9') };

describe('a theme that is worked out', () => {
  it('is what it falls back to when nothing is known', () => {
    assert.equal(resolveTheme('cover', 'dark').colours, themeOf('dark').colours);
    assert.equal(resolveTheme('material', 'dark').colours, themeOf('dark').colours);
    assert.equal(resolveTheme('material', 'light').colours, themeOf('light').colours);
    assert.equal(resolveTheme('material', 'light').base, 'light');
  });

  it('takes its accent from the cover, and nothing else', () => {
    const made = resolveTheme('cover', 'dark', { cover: ['#2a0a0a', '#a02828', '#e06060'], system: null });
    const plain = themeOf('dark').colours;
    assert.notEqual(made.colours.accent, plain.accent);
    for (const token of Object.keys(plain) as (keyof Palette)[]) {
      if (token === 'accent' || token === 'onAccent' || token === 'accentMuted' || token === 'accentSoft') continue;
      assert.equal(made.colours[token], plain[token], token);
    }
    assert.equal(made.id, 'cover');
    assert.equal(made.base, 'dark');
  });

  it('follows the phone both ways up when made from the phone’s palette', () => {
    const around = { cover: null, system: SOME_PALETTE };
    const day = resolveTheme('material', 'light', around);
    const night = resolveTheme('material', 'dark', around);
    assert.equal(day.base, 'light');
    assert.equal(night.base, 'dark');
    assert.ok(luminance(day.colours.bg) > 0.5);
    assert.ok(luminance(night.colours.bg) < 0.1);
  });

  it('is the very same object for the same surroundings, so that nothing is redrawn for nothing', () => {
    const around = { cover: ['#2a0a0a', '#a02828', '#e06060'], system: SOME_PALETTE };
    assert.equal(resolveTheme('cover', 'dark', around), resolveTheme('cover', 'dark', { ...around }));
    assert.equal(resolveTheme('material', 'dark', around), resolveTheme('material', 'dark', { ...around }));
    // A change in what a theme never looks at is no change to it.
    assert.equal(
      resolveTheme('material', 'dark', around),
      resolveTheme('material', 'dark', { ...around, cover: ['#000000'] })
    );
    assert.notEqual(
      resolveTheme('cover', 'dark', around),
      resolveTheme('cover', 'dark', { ...around, cover: ['#0a0a2a', '#2828a0', '#6060e0'] })
    );
  });

  it('says what it needs fetched, and a written-down theme needs nothing', () => {
    assert.deepEqual(needsOf('cover'), ['cover']);
    assert.deepEqual(needsOf('material'), ['system']);
    assert.deepEqual(needsOf('system'), []);
    assert.deepEqual(needsOf('sepia'), []);
  });

  it('is offered only where it can be had', () => {
    assert.equal(isOffered(themeOf('material'), NOTHING_AROUND), false);
    assert.equal(isOffered(themeOf('material'), { ...NOTHING_AROUND, system: SOME_PALETTE }), true);
    assert.equal(isOffered(themeOf('cover'), NOTHING_AROUND), true);
    assert.equal(isOffered(themeOf('forest'), NOTHING_AROUND), true);
  });
});
