import { finishOf } from './effects.ts';
import type { Palette } from './tokens.ts';

/**
 * How wide an outline is, in a theme that draws one.
 *
 * One figure for the whole app, so that a chip on a card and the card it is
 * on are edged by the same line. Wider than a hairline on purpose: a hairline
 * is a pixel, and this is for somebody who has asked to be shown where things
 * end.
 */
export const OUTLINE_WIDTH = 1;

/**
 * How much room a theme's outline takes: nothing at all, in a theme that
 * does not draw one.
 *
 * A theme says it wants no edge by making `outline` wholly transparent, and
 * that is read here as no width and not as a clear line a pixel wide. A clear
 * line would still be a pixel: everything inside a card would sit a pixel
 * further in, in sixteen themes, for the sake of the one that draws it.
 */
export function outlineWidth(c: Palette): number {
  // Eight digits ending in nought: a colour with nothing of it there.
  return /^#[0-9a-f]{6}00$/i.test(c.outline) ? 0 : OUTLINE_WIDTH;
}

type Edge = {
  borderWidth?: number;
  borderColor?: string;
  experimental_backgroundImage?: string;
  boxShadow?: string;
};

/** Nothing, and always the same nothing, so that a style spread from it is as it was. */
const NO_EDGE: Edge = Object.freeze({});

/**
 * The edge of something that is told from what it lies on by its fill alone,
 * to be spread into its style:
 *
 *     card: { backgroundColor: c.surface, borderRadius: 14, ...outlined(c) },
 *
 * In a theme with no outline this is an empty object and the style is, to the
 * letter, what it was without it. In one that has an outline it is a border
 * all the way round, in the outline's colour.
 *
 * [colour] is for the thing whose edge should be its own: a chip that is
 * filled when chosen is given its fill, so that it stays the size of the
 * ones beside it and is not ringed in grey; a chip that is on in a quieter
 * way is given the accent, so that the ring is what says so. It is still
 * only drawn where an outline is.
 */
export function outlined(c: Palette, colour: string = c.outline): Edge {
  const width = outlineWidth(c);
  if (width === 0) return NO_EDGE;
  return finished(c, { borderWidth: width, borderColor: colour });
}

/**
 * An edge with the rest of what a theme of glass gives a surface: the light
 * across its top and what it casts.
 *
 * Here, and not asked for beside it, because everything that is a surface
 * already comes this way to be given its edge, and a finish is the same
 * question — how is this thing told from what it lies on — answered by a
 * theme that has more to answer with. Such a theme always draws an edge: the
 * rim is the first thing glass has. So a theme with no edge has no finish,
 * and is still handed the empty object it always was.
 */
function finished(c: Palette, edge: Edge): Edge {
  /*
    An edge in no colour is room kept for one, round something that is not
    there yet: a button that will be ringed when it is on. Nothing is told
    from anything, and there is no surface to put a light across.
  */
  if (edge.borderColor === 'transparent') return edge;
  const finish = finishOf(c);
  return finish ? { ...edge, ...finish } : edge;
}

/** A border that is there and takes no room, as opposed to no border at all. */
const NO_ROOM: Edge = Object.freeze({ borderWidth: 0, borderColor: 'transparent' });

/**
 * The same edge, for something that also cuts its contents to its own shape:
 * a rounded card with `overflow: 'hidden'`.
 *
 *     card: { backgroundColor: c.surface, borderRadius: 14, overflow: 'hidden', ...outlinedClip(c) },
 *
 * Android works out where such a view cuts its children from its border. Told
 * of a border and then told nothing — which is what going from a theme with an
 * outline to one without amounts to, when no outline is an empty object — it
 * keeps cutting to the shape it last worked out, and that shape is wrong:
 * every card in Settings showed its background and none of what was in it,
 * until the app was closed and opened again. So where there is no outline
 * this says so in as many words, a border of no width, and the view works the
 * shape out afresh.
 *
 * Not for a style that has a border of its own, which this would undo; those
 * do not cut their contents and take the plain `outlined`.
 */
export function outlinedClip(c: Palette, colour: string = c.outline): Edge {
  const width = outlineWidth(c);
  if (width === 0) return NO_ROOM;
  return finished(c, { borderWidth: width, borderColor: colour });
}
