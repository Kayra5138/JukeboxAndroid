import { contrast, fromLch, inkOn, luminance, mix, parseColour, readableOn, toHex, toLch } from './colour.ts';
import { repaired } from './repair.ts';
import { dark } from './themes/dark.ts';
import { light } from './themes/light.ts';
import type { Palette } from './tokens.ts';

/**
 * A theme from two colours, or three: the one somebody makes for themselves.
 *
 * What is chosen is the page and the accent, and the card if the card the
 * page would have been given is not the one wanted. Everything else — the bar,
 * a chip, the lines, five levels of text, what is written on a fill, the
 * washes — is worked out here, because nobody who wants a green app wants to
 * be asked thirty-three questions about it, and because the answers to most
 * of them are not a matter of taste: a caption either can be read or cannot.
 *
 * So the words are never chosen. They are placed by how far they have to
 * stand from what they are written on, and a colour that was chosen gives way
 * where it would make them unreadable: a page in a mid grey, which nothing
 * can be read on, is moved to the nearer side of the middle, and an accent too
 * near the page is taken lighter or darker until it shows. Whether the theme
 * is a light one or a dark one is not asked either. The page says.
 *
 * Nothing here knows about React or the phone, so all of it can be tested,
 * and is: the test beside this sweeps the colours and holds every palette
 * that comes out to what the written-down themes are held to.
 */
export type CustomSeeds = {
  /** The page, as `#rrggbb`. */
  background: string;
  /** The app's one colour, as `#rrggbb`. */
  accent: string;
  /** A card, as `#rrggbb`; null for the one the page would be given. */
  surface: string | null;
};

/** Which of the three a control is for. */
export type SeedRole = keyof CustomSeeds;

/**
 * What the theme is before anybody has touched it: a deep green-blue with an
 * amber accent. Not one of the themes that are written down, so that choosing
 * "Custom" for the first time is seen to have done something.
 */
export const DEFAULT_SEEDS: CustomSeeds = Object.freeze({
  background: '#0f1f20',
  accent: '#f2b05e',
  surface: null,
});

/**
 * A few colours to start from for each of the three, since a slider is a slow
 * way to arrive at "a dark blue". Pages run from black to white by way of the
 * hues; accents are the same hues at full strength.
 */
export const SEED_PRESETS: Record<SeedRole, readonly string[]> = {
  background: [
    '#000000', '#121212', '#0f1f20', '#101a2e', '#1d1430', '#2a1418',
    '#14241a', '#2b2118', '#f4f4f6', '#fbf3f6', '#f3ecdf', '#eaf3f8',
  ],
  accent: [
    '#ff8a8a', '#ff9f5a', '#f2b05e', '#e8d06a', '#8fd67a', '#5fd0b0',
    '#62c8e8', '#7ab8ff', '#9d9bff', '#c79bff', '#f08fd0', '#b0b0b0',
  ],
  surface: [
    '#0e0e0e', '#1c1c1c', '#17292a', '#18243c', '#281d3e', '#361c21',
    '#1c3024', '#372b20', '#ffffff', '#fff9fb', '#fbf6ec', '#f6fbfe',
  ],
};

/**
 * A colour somebody typed, as the `#rrggbb` everything here is written in;
 * null for anything that is not one.
 *
 * With the `#` or without it, in three digits or six, in either case. Not in
 * eight: a page that can be seen through is not a page.
 */
export function seedColour(typed: string): string | null {
  const digits = typed.trim().replace(/^#/, '');
  if (digits.length !== 3 && digits.length !== 6) return null;
  const parsed = parseColour(digits);
  return parsed ? toHex(parsed.rgb) : null;
}

/**
 * The seeds a stored setting means.
 *
 * Whatever is stored was written by `seedsToSetting`, but it is also carried
 * between phones in a backup, which is a file anybody can open. So it is read
 * as something that might be anything, and anything that is not three colours
 * — one of them allowed to be missing — is the default, whole: half of
 * somebody's theme with half of the default's would be a theme nobody chose.
 */
export function seedsFrom(stored: string | null): CustomSeeds {
  if (!stored) return DEFAULT_SEEDS;
  let read: unknown;
  try {
    read = JSON.parse(stored);
  } catch {
    return DEFAULT_SEEDS;
  }
  if (!read || typeof read !== 'object') return DEFAULT_SEEDS;
  const { background, accent, surface } = read as Record<string, unknown>;
  if (typeof background !== 'string' || typeof accent !== 'string') return DEFAULT_SEEDS;
  const page = seedColour(background);
  const one = seedColour(accent);
  if (!page || !one) return DEFAULT_SEEDS;
  if (surface == null) return { background: page, accent: one, surface: null };
  const card = typeof surface === 'string' ? seedColour(surface) : null;
  if (!card) return DEFAULT_SEEDS;
  return { background: page, accent: one, surface: card };
}

/** The seeds as they are stored. */
export function seedsToSetting(seeds: CustomSeeds): string {
  return JSON.stringify({ background: seeds.background, accent: seeds.accent, surface: seeds.surface });
}

/** Whether two sets of seeds are the same three colours. */
export function sameSeeds(a: CustomSeeds, b: CustomSeeds): boolean {
  return a.background === b.background && a.accent === b.accent && a.surface === b.surface;
}

/**
 * How far every ground is held from the far end of the scale — from white, in
 * a dark theme. Half as far again as text has to stand from a ground, which
 * is the room the levels of text need to step down in and all still be read.
 * The figure `repaired` holds a ground to, so that what is made here is not
 * then moved there.
 */
const ROOM = 4.5 * 1.5;

/**
 * The luminance black and white are equally far from, by contrast: a page
 * above it is written on in dark ink and one below it in light.
 */
const MIDDLE = 0.179;

/** A colour at another lightness, its hue and its strength kept. */
function tone(colour: string, l: number): string {
  return fromLch({ ...toLch(colour), l: Math.max(0, Math.min(1, l)) });
}

/**
 * A colour a step lighter, or with a negative step a step darker.
 *
 * The size of the step is the one a little white paint, or black, would
 * make, because that is how the written-down themes step: the same amount
 * of white takes `#121212` to its card and `#000000` to its, and those are
 * very different distances by any measure that is even. The hue and the
 * strength are the colour's own all the same, which paint would have washed
 * out.
 */
function stepped(colour: string, amount: number): string {
  const painted = mix(colour, amount >= 0 ? '#ffffff' : '#000000', Math.abs(amount));
  return tone(colour, toLch(painted).l);
}

/**
 * Ink of one hue at the lightness that stands just `ratio` from the grounds:
 * the quietest that is still that loud on every one of them.
 *
 * Found by halving, since ink only gets louder the further it is taken from
 * what it is written on. Where the far end of the scale is not far enough —
 * the grounds are as near the middle as they are allowed — it is the far end:
 * white, or black.
 */
function inkAt(
  like: { c: number; h: number },
  grounds: readonly string[],
  ratio: number,
  base: 'light' | 'dark'
): string {
  const far = base === 'dark' ? 1 : 0;
  const loud = (l: number) => {
    const made = fromLch({ l, c: like.c, h: like.h });
    return Math.min(...grounds.map((ground) => contrast(made, ground))) >= ratio;
  };
  if (!loud(far)) return base === 'dark' ? '#ffffff' : '#000000';
  // `quiet` is never loud enough and `enough` always is; they close on the edge.
  let quiet = 1 - far;
  let enough = far;
  for (let step = 0; step < 12; step++) {
    const middle = (quiet + enough) / 2;
    if (loud(middle)) enough = middle;
    else quiet = middle;
  }
  return fromLch({ l: enough, c: like.c, h: like.h });
}

/**
 * The page, a card and a chip, from what was chosen.
 *
 * Nearer is lighter, as everywhere: on a dark page a card is a step up and a
 * chip a step up again. On a light page a card is lighter too where there is
 * anything lighter to be — a white card on a page a little off white, as the
 * light theme has it — and a chip is a touch darker than both. A page that
 * is white already has nothing above it, so there the card is the step down
 * and is told from the page that way round.
 *
 * A card that was chosen is that card, and the chip is stepped from whichever
 * of the two is further forward.
 *
 * All of them are then moved together, a hundredth at a time, until the one
 * nearest the middle — the chip, which is stepped towards it — leaves the
 * room text needs. That is the page giving way, and it only happens to a
 * page that was chosen from the middle of the scale.
 */
function grounds(seeds: CustomSeeds, base: 'light' | 'dark') {
  const farEnd = base === 'dark' ? '#ffffff' : '#000000';
  const away = base === 'dark' ? -0.01 : 0.01;
  const roomy = (colour: string) => contrast(colour, farEnd) >= ROOM;

  /*
    What was chosen is first brought to the right side of the middle, in one
    go: a white card asked for on a black page is a long way from anywhere a
    card on that page can be, and is taken to the lightest that can.
  */
  let page = readableOn(seeds.background, [farEnd], ROOM);
  let chosen = seeds.surface === null ? null : readableOn(seeds.surface, [farEnd], ROOM);

  const laid = () => {
    if (base === 'dark') {
      const card = chosen ?? stepped(page, 0.045);
      const front = luminance(card) >= luminance(page) ? card : page;
      return {
        // A page that is black is black to its edges: the bar of an OLED is off as well.
        bar: luminance(page) < 0.002 ? page : stepped(page, 0.02),
        card,
        chip: stepped(front, 0.04),
      };
    }
    // Whether there is anything lighter than the page for a card to be.
    const above = toLch(page).l <= 0.975;
    const card = chosen ?? (above ? tone(page, toLch(page).l + 0.035) : stepped(page, -0.035));
    const back = luminance(card) <= luminance(page) ? card : page;
    return {
      bar: above ? tone(page, toLch(page).l + 0.02) : page,
      card,
      chip: stepped(back, -0.04),
    };
  };

  let made = laid();
  for (let step = 0; step < 100 && !(roomy(page) && roomy(made.card) && roomy(made.chip)); step++) {
    // Whichever of the two that were chosen is nearer the middle is the one in the way.
    const cardInTheWay =
      chosen !== null && (base === 'dark' ? luminance(chosen) > luminance(page) : luminance(chosen) < luminance(page));
    if (cardInTheWay && chosen !== null) chosen = tone(chosen, toLch(chosen).l + away);
    else page = tone(page, toLch(page).l + away);
    made = laid();
  }

  return { page, bar: made.bar, card: made.card, chip: made.chip };
}

/**
 * The whole palette for a set of seeds, and which way up it came out.
 *
 * In the order things depend on each other: the grounds, then the words that
 * are written on them, then the accent, which has to be read on them too, and
 * last the signals, which are the default theme's own red, green and amber —
 * what red means is not the theme's to choose — moved only as far as these
 * grounds need.
 *
 * What comes out has been through `repaired` as well. Everything above is
 * made to pass already and the repair should find nothing to do; it is there
 * because it is the same check the wallpaper's theme is given, and a palette
 * that somebody can make any way they like is the one most likely to find
 * the case nobody thought of.
 */
export function customColours(seeds: CustomSeeds): { base: 'light' | 'dark'; colours: Palette } {
  const given: CustomSeeds = {
    background: seedColour(seeds.background) ?? DEFAULT_SEEDS.background,
    accent: seedColour(seeds.accent) ?? DEFAULT_SEEDS.accent,
    surface: seeds.surface === null ? null : seedColour(seeds.surface),
  };
  const base = luminance(given.background) > MIDDLE ? 'light' : 'dark';
  const plain = (base === 'dark' ? dark : light).colours;
  const { page, bar, card, chip } = grounds(given, base);
  const written = [page, bar, card, chip];

  /*
    The lines and the switch, from the chip: it is the furthest forward, and
    a line that has to be seen on a chip is seen on everything behind it.
  */
  const lines =
    base === 'dark'
      ? {
          border: stepped(chip, 0.03),
          borderStrong: stepped(chip, 0.12),
          switchTrack: stepped(chip, 0.03),
          switchThumb: stepped(chip, 0.33),
        }
      : {
          border: stepped(chip, -0.045),
          borderStrong: stepped(chip, -0.17),
          switchTrack: stepped(chip, -0.11),
          switchThumb: '#ffffff',
        };

  /*
    The words lean a little towards the page's hue, as every written-down
    theme's do: a true grey on a plum page is the one cold thing on it.

    How loud each level is, is how loud the light theme's are on its chip,
    which is the least any of them stands from anything. Where the grounds
    are near the middle there is not that much contrast to be had, and the
    levels share out what there is: evenly, from the quietest that can be
    read up to the far end of the scale.
  */
  const from = toLch(page);
  const tint = { c: Math.min(from.c * 0.5, 0.02), h: from.h };
  const farInk = base === 'dark' ? '#ffffff' : '#000000';
  const most = Math.min(...written.map((ground) => contrast(farInk, ground)));
  const share = Math.max(1, Math.cbrt(most / 4.8));
  const text = inkAt(tint, written, Math.min(13, most), base);
  const textSecondary = inkAt(tint, written, Math.min(7.6, 4.8 * share * share), base);
  const textMuted = inkAt(tint, written, Math.min(5.8, 4.8 * share), base);
  const textFaint = inkAt(tint, written, 4.8, base);
  // Not for reading, but for seeing: a hint in a field, a chevron. About where the default themes put theirs.
  const textDisabled = inkAt(tint, written, 2.6, base);

  /*
    The accent is the colour that was chosen wherever that can be read, and
    the nearest lightness of it that can be where it cannot. A navy accent on
    a black page comes out a lighter blue; that is the nudge the screen
    warns of.
  */
  const accent = readableOn(given.accent, written, 4.5);
  const danger0 = readableOn(plain.danger, written, 4.5);
  const success0 = readableOn(plain.success, written, 4.5);

  // A wash is the page with a little of the colour in it, and still a ground.
  const wash = (colour: string) => readableOn(mix(page, colour, 0.12), [farInk], ROOM);
  const dangerSoft = wash(danger0);
  const successSoft = wash(success0);

  const colours = repaired(
    {
      bg: page,
      bar,
      surface: card,
      surfaceRaised: chip,
      ...lines,

      text,
      textSecondary,
      textMuted,
      textFaint,
      textDisabled,

      primary: text,
      onPrimary: page,

      accent,
      onAccent: inkOn(accent, page, text),
      accentMuted: mix(page, accent, base === 'dark' ? 0.32 : 0.36),
      accentSoft: wash(accent),

      danger: readableOn(danger0, [...written, dangerSoft], 4.5),
      dangerSoft,
      success: readableOn(success0, [...written, successSoft], 4.5),
      successSoft,
      warning: readableOn(plain.warning, written, 4.5),

      scrim: plain.scrim,
      // A faint wash over black is fainter than the same wash over grey; see `themes/black.ts`.
      pressed: base === 'dark' && luminance(page) < 0.01 ? '#ffffff1f' : plain.pressed,

      selected: chip,
      onSelected: text,

      // A card is told from the page by its fill, as in every theme that is a look.
      outline: '#00000000',
    },
    base
  );

  // What is chosen is a chip with the words' colour on it, of the palette as it ended up.
  return { base, colours: { ...colours, selected: colours.surfaceRaised, onSelected: colours.text } };
}
