/** Where something lies in the row that holds it, as its layout reports it. */
export type Place = { x: number; y: number; width: number; height: number };

/**
 * The places of a row of choices with one of them noted afresh.
 *
 * The same object back when nothing moved, so that a layout reported again
 * at the same place — which Android does on every redraw of the row — is not
 * a change of state and draws nothing again.
 */
export function withPlace(before: Readonly<Record<string, Place>>, key: string, place: Place): Record<string, Place> {
  const was = before[key];
  if (was && was.x === place.x && was.y === place.y && was.width === place.width && was.height === place.height) {
    return before;
  }
  return { ...before, [key]: { x: place.x, y: place.y, width: place.width, height: place.height } };
}

/**
 * A place reported from the row's outer edge, given as one measured from
 * inside its border.
 *
 * A choice's layout is measured from the outside of the row's border, and
 * something laid absolutely in the row starts inside it: so in a theme that
 * draws outlines the mark sat a border's width off its choice, down and to
 * the right, until it was taken back by as much.
 */
export function insideBorder(place: Place | undefined, border: number): Place | null {
  if (!place) return null;
  if (!border) return place;
  return { x: place.x - border, y: place.y - border, width: place.width, height: place.height };
}
