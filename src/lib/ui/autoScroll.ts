/**
 * How hard a list should scroll while something is being dragged over its edge.
 *
 * Dragging a row can only reach as far as the screen shows unless the list
 * comes to meet it, so holding the row near an edge pulls the list past it.
 *
 * The pull is proportional to how far into the edge the finger is rather than
 * switched on at a threshold. A fixed speed makes the list bolt the instant the
 * row touches the zone, which overshoots what somebody nudging the edge asked
 * for; ramping means the edge of the zone is a crawl and the edge of the screen
 * is a sprint, and everything in between is a choice the finger can make.
 */

/** How deep the pull reaches in from each edge, in points. */
export const EDGE = 76;

/** Points a tick at the very edge. A tick is a frame, so this is per 16ms. */
export const FASTEST = 14;

/**
 * Points to scroll this tick: negative towards the top, positive towards the
 * bottom, zero anywhere in the middle.
 *
 * @param at Where the finger is, in the same coordinates as `top`.
 * @param top Where the list's first pixel is.
 * @param height How tall the list is.
 */
export function edgePull(at: number, top: number, height: number): number {
  if (height <= 0) return 0;

  // Past the edge entirely — a finger dragged off the list still pulls, at the
  // full rate, because stopping there would be a dead zone exactly where the
  // intent is least ambiguous.
  const intoTop = top + EDGE - at;
  if (intoTop > 0) return -FASTEST * Math.min(intoTop / EDGE, 1);

  const intoBottom = at - (top + height - EDGE);
  if (intoBottom > 0) return FASTEST * Math.min(intoBottom / EDGE, 1);

  return 0;
}

/** Keeps an offset inside a list that only has so much to show. */
export function withinScroll(offset: number, content: number, viewport: number): number {
  return Math.min(Math.max(offset, 0), Math.max(0, content - viewport));
}
