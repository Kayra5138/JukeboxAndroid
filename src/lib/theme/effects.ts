import { parseColour, toHex } from './colour.ts';
import type { Palette } from './tokens.ts';

/**
 * What a theme does besides choose colours: light, depth, and glass.
 *
 * Every theme but a few is a palette and nothing else — flat fills, told
 * apart by their shade. A theme with effects is still a palette, and every
 * screen still asks it for the same tokens; what it adds is said here, once,
 * and reaches the screens through the handful of helpers below. No screen
 * asks whether the theme in use has effects, any more than it asks whether
 * the theme is a dark one.
 *
 * There are four things such a theme can do, and they are all it can do:
 *
 *   A page that is not one colour. `backdrop` is laid over `bg` wherever a
 *   page is drawn: gradients, as many as wanted, the first on top.
 *
 *   Surfaces that let the page through. That needs nothing from here at all:
 *   the theme writes `surface` and its neighbours with an alpha, and a card
 *   is glass because its fill is. Over a page that is all slow gradient this
 *   is the whole of frosted glass — blurring what is already smooth changes
 *   nothing — which is why no card in the app carries a blur.
 *
 *   A finish on those surfaces: a `sheen` of light across the top, and a
 *   `shadow` that is the rim catching it and the surface standing off the
 *   page. They ride on `outlined`, which every surface in the app already
 *   goes through to be given its edge; the line itself is the theme's
 *   `outline`, as it is in the theme that is there for being read.
 *
 *   A `veil` over whatever a sheet or a dialog is opened on, which is the
 *   one place glass has something sharp behind it and has to blur it.
 *
 * The gradients are written as CSS writes them, since that is how React
 * Native takes them. A mistake in one is not an error: the whole background
 * is dropped without a word, so the tests read every one of them.
 */
export type Effects = {
  /**
   * What a page is, over `bg`: gradients, the first on top.
   *
   * It should begin, at the top, at `bg` or near it. The bar a pushed screen
   * has over it is drawn by the phone in one flat colour, `bg`, and the page
   * starts under it.
   */
  backdrop: readonly string[];
  /** Light across the top of a surface, as a gradient over its fill. Null for none. */
  sheen: string | null;
  /**
   * Light along the inside of a surface's rim, as a box shadow. Null for none.
   *
   * Inset only. A shadow cast outwards was tried and is not wanted: it is
   * drawn outside the surface, and anything round the surface that cuts to
   * its own box — a header that slides, a wrapper that fades — cuts the
   * shadow off square, so that a rounded card sat on the ghost of a
   * rectangle. Glass is told from the page by its rim and its sheen.
   */
  shadow: string | null;
  /** How far, in pixels, what lies behind a sheet is blurred. Nought for not at all. */
  veil: number;
  /**
   * For a theme in which the player wears the cover of what it is playing as
   * its page, out of focus, in place of the backdrop: how much of `bg` is
   * washed over that cover, from nought to one. Nought for a player on the
   * page everything else is on.
   *
   * The wash is what keeps the ink readable whatever the cover is, and how
   * much it takes depends on which way up the theme is. Covers are dark more
   * often than not: a dark page needs little washed over one to stay dark,
   * and a light page a good deal to stay light.
   */
  coverWash: number;
};

const EFFECTS = new WeakMap<Palette, Effects>();

/**
 * Says that a palette is drawn with effects, and hands it back.
 *
 * Kept beside the palette and not in it. A palette is colours by what they
 * are for, every one of them a thing that can be measured against another,
 * and a great deal — the tests, the repair of a worked-out theme, the picker
 * — goes through one member by member on that understanding. By the palette
 * and not by the theme's name, because that is what a style sheet is built
 * from and all a helper is handed: a theme that is worked out afresh says
 * this again for each palette it makes.
 */
export function withEffects(colours: Palette, effects: Effects): Palette {
  EFFECTS.set(colours, effects);
  return colours;
}

/** The effects a palette is drawn with, or null for the many that have none. */
export function effectsOf(c: Palette): Effects | null {
  return EFFECTS.get(c) ?? null;
}

type Page = { backgroundColor: string; experimental_backgroundImage?: string };

const PAGES = new WeakMap<Palette, Page>();

/**
 * The page: what every screen is drawn on, to be spread into the style of
 * the one view that draws it.
 *
 *     page: { flex: 1, ...page(c) },
 *
 * `bg`, and in a theme with a backdrop the backdrop over it. It is drawn
 * once for each screen, by the root layout, under the screen and not by it;
 * so this is for that, and for the few things that are a page without being
 * a screen of the navigator's: the player, a viewer in a window of its own.
 * A screen wants `scene`.
 *
 * It has to go on a plain view. React Native draws a gradient behind one of
 * those and behind nothing else, and says nothing when handed one for a
 * list: the list is drawn in `bg`, flat, over whatever would have shown.
 */
export function page(c: Palette): Page {
  let made = PAGES.get(c);
  if (!made) {
    const backdrop = effectsOf(c)?.backdrop;
    made =
      backdrop && backdrop.length > 0
        ? { backgroundColor: c.bg, experimental_backgroundImage: backdrop.join(', ') }
        : { backgroundColor: c.bg };
    PAGES.set(c, made);
  }
  return made;
}

const CLEAR = { backgroundColor: 'transparent' } as const;

/**
 * What a screen draws behind itself, in the style of its outermost view:
 *
 *     screen: { flex: 1, ...scene(c) },
 *
 * In nearly every theme, `bg`, as it always has. In a theme with a backdrop,
 * nothing: the page is already under it, the picture and all, and a screen
 * that painted `bg` would paint over it. Under the tabs that page is one for
 * all of them and for their bar, which is how the bar comes to be glass over
 * the same picture as the screen above it.
 *
 * Nothing shows through a screen that is clear but its own page. One slid
 * over another has a page of its own between the two.
 */
export function scene(c: Palette): { backgroundColor: string } {
  return effectsOf(c)?.backdrop.length ? CLEAR : page(c);
}

/**
 * The finish of a surface, for `outlined` to add to the edge it gives:
 * nothing at all in a theme without effects.
 */
export function finishOf(c: Palette): { experimental_backgroundImage?: string; boxShadow?: string } | null {
  const effects = effectsOf(c);
  if (!effects || (!effects.sheen && !effects.shadow)) return null;
  return {
    ...(effects.sheen ? { experimental_backgroundImage: effects.sheen } : null),
    ...(effects.shadow ? { boxShadow: effects.shadow } : null),
  };
}

/** How far what is behind a sheet is blurred in this theme. Nought in nearly all. */
export function veilOf(c: Palette): number {
  return effectsOf(c)?.veil ?? 0;
}

/** Every colour written in a gradient or a shadow, in the forms a token is written in. */
const COLOUR = /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b/gi;

/** One colour laid over another at the strength its alpha says, as one flat colour. */
export function laid(wash: string, ground: string): string {
  const top = parseColour(wash);
  const under = parseColour(ground);
  if (!top || !under) return ground;
  const part = (index: 0 | 1 | 2) => top.rgb[index] * top.alpha + under.rgb[index] * (1 - top.alpha);
  return toHex([part(0), part(1), part(2)]);
}

/**
 * The flat colours a page can be at any one spot, for measuring what is
 * written on it against.
 *
 * `bg` alone, in a theme without a backdrop. With one, the page is built up
 * as it is drawn, from the back: each gradient's colours are laid, at their
 * own strength, over every colour the layers behind it could have left
 * there. That is more colours than the page has — it supposes the brightest
 * part of one glow can fall on the brightest part of another, whether or not
 * they overlap — and it errs the right way: a theme that can be read over
 * all of these can be read over its page.
 */
export function groundsOf(c: Palette): string[] {
  let grounds = new Set([c.bg]);
  const layers = effectsOf(c)?.backdrop ?? [];
  for (let at = layers.length - 1; at >= 0; at--) {
    const next = new Set(grounds);
    for (const colour of layers[at]!.match(COLOUR) ?? []) {
      for (const ground of grounds) next.add(laid(colour, ground));
    }
    grounds = next;
  }
  return [...grounds];
}

/**
 * A palette as the flat colours it comes to on the screen, once for each
 * colour its page can be.
 *
 * A theme of glass writes its surfaces with an alpha, and a colour with an
 * alpha cannot be measured against the ink on it: what the ink is on is that
 * colour over whatever is behind. So each is laid over what it is drawn on —
 * a card on the page, a chip on a card, a wash on a card — and the answer is
 * a palette like any other, which whatever checks a written-down theme can
 * check as it stands.
 *
 * A palette without effects is itself, alone.
 */
export function flattened(c: Palette): Palette[] {
  if (!effectsOf(c)) return [c];
  return groundsOf(c).map((ground) => {
    const surface = laid(c.surface, ground);
    return {
      ...c,
      bg: ground,
      bar: laid(c.bar, ground),
      surface,
      surfaceRaised: laid(c.surfaceRaised, surface),
      selected: laid(c.selected, surface),
      accentMuted: laid(c.accentMuted, surface),
      accentSoft: laid(c.accentSoft, surface),
      dangerSoft: laid(c.dangerSoft, surface),
      successSoft: laid(c.successSoft, surface),
    };
  });
}

const FUNCTION = /^(linear|radial)-gradient\((.*)\)$/s;

/** How a gradient may begin: an angle, or where a circle is. */
const LINEAR = /^\d+(\.\d+)?deg$/;
const RADIAL = /^(circle|ellipse) at \d+(\.\d+)?% \d+(\.\d+)?%$/;
/** A stop: one of our colours, and how far along it is, with its unit. */
const STOP = /^#(?:[0-9a-f]{8}|[0-9a-f]{6}) \d+(\.\d+)?(%|px)$/i;

/**
 * Whether a gradient is one React Native will draw, as far as can be told
 * without it.
 *
 * It drops a background it cannot read and says nothing, and it is exacting:
 * a length without its unit, a direction it does not know, a colour in a form
 * it does not take. So what is allowed here is narrower than what it would
 * accept and is exactly what the themes use — an angle or the place of a
 * circle, then stops that are each a colour in the form a token is written
 * in and a distance in per cent or pixels. A gradient written any other way
 * may well be drawn; it has to be shown to be before this is widened.
 */
export function drawable(gradient: string): boolean {
  const found = FUNCTION.exec(gradient.trim());
  if (!found) return false;
  const [shape, ...stops] = found[2]!.split(',').map((part) => part.trim());
  if (!shape || !(found[1] === 'linear' ? LINEAR : RADIAL).test(shape)) return false;
  return stops.length >= 2 && stops.every((stop) => STOP.test(stop));
}

/** One shadow: perhaps inset, four lengths, one of our colours. A length that is not nought has its unit. */
const SHADOW = /^(inset )?((0|-?\d+(\.\d+)?px) ){4}#(?:[0-9a-f]{8}|[0-9a-f]{6})$/i;

/**
 * The same for a box shadow, which is dropped as silently and for less: one
 * length without `px` loses every shadow in the list.
 */
export function castable(shadow: string): boolean {
  const parts = shadow.split(',').map((part) => part.trim());
  return parts.length > 0 && parts.every((part) => SHADOW.test(part));
}
