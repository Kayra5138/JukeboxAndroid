import { createStore } from './store.ts';

/**
 * The menu that comes up under a finger held on a row: a ring of slices round
 * the finger, slid to and let go of with the finger never lifted.
 *
 * What is chosen is the slice the finger is in, however far out, so a little
 * way in about the right direction is enough, and each choice has a slice of
 * its own for good: where one is not on offer its slice stands empty, and
 * nothing moves into it.
 *
 * It is measured from the middle of the ring as it opened. In the open that
 * is where the finger came down. Near an edge the ring is moved to fit, and the
 * finger is left off to one side of the middle, already over a slice; which
 * means nothing until it moves, and is then as good as any other. There is
 * always room to reach all of it, since all of it is on the screen.
 *
 * Let go back in the middle, it is called off.
 */

/** Long enough to tell from a tap and a scroll, and not felt as a wait. */
export const PRESS_MS = 300;

/** How far from the ring's middle its outer edge is. */
export const RING_RADIUS = 140;

/** How far from the ring's middle the choices are drawn, half way along the slice. */
export const RING_ICONS = 98;

/** How many slices there are, and how many degrees each has. */
export const SLICES = 8;
const SLICE = 360 / SLICES;

/**
 * Within this of the ring's middle, nothing is chosen: the hole the ring
 * has there, as `pie-slice.svg` is drawn, so that what looks like nothing is
 * nothing, and is big enough to find to call it off.
 */
export const MIDDLE_WITHIN = 56;

/** Moved less than this since it came down, a finger is only resting on the glass, and chooses nothing. */
export const RESTING_WITHIN = 10;

/** How close to the sides of the screen the ring may come. */
const MARGIN = 6;

/** Room over the ring, for the name written there. */
const WORDS_ABOVE = 40;

/** The way a slice lies, in degrees from the right, up being negative: the first is straight up, and they go round clockwise. */
export function sliceAngle(place: number): number {
  return -90 + place * SLICE;
}

/** The slice a finger this far from the ring's middle is in, or null for the middle. */
export function placeAt(dx: number, dy: number): number | null {
  if (Math.hypot(dx, dy) < MIDDLE_WITHIN) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Math.round((angle + 90 + 360) / SLICE) % SLICES;
}

/**
 * Where the ring's middle goes for a finger at ([x], [y]) on a screen of
 * [width] and [height]: at the finger, moved as far as it takes for the whole
 * ring to be seen.
 */
export function ringMiddle(x: number, y: number, width: number, height: number, top: number): { x: number; y: number } {
  const reach = RING_RADIUS + MARGIN;
  const above = reach + WORDS_ABOVE + top;
  return {
    x: Math.min(Math.max(x, reach), Math.max(reach, width - reach)),
    y: Math.min(Math.max(y, above), Math.max(above, height - reach)),
  };
}

/** One choice, in its place. */
export type PressChoice<Icon> = { place: number; label: string; icon: Icon };

/** The menu that is up: where, what is on it, and which is chosen just now. */
export type PressMenu<Icon> = {
  /** The ring's middle, on the screen. */
  x: number;
  y: number;
  title: string;
  choices: readonly PressChoice<Icon>[];
  chosen: number | null;
};

/** Held here for the one layer over the whole app that draws it; what a row is held on is nowhere near that. */
export const pressMenu = createStore<PressMenu<unknown> | null>(null);
