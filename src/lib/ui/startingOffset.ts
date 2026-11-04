/** Where a list starts, and what it was built for. */
export type StartingOffset = { builtFor: unknown; offset: { x: number; y: number } };

/**
 * The `contentOffset` of a list that comes back to where it was left.
 *
 * Only ever what it was when the list was built. The prop looks like a place
 * to start from and is not: Android scrolls the list there each time its value
 * changes. Handed where the list was last known to be at every drawing, it
 * was that, a moment behind the finger, each time the screen was drawn: the
 * list jumped back and its run stopped, which anybody scrolling as a song
 * started felt as a catch.
 *
 * So the one it had is kept, as the same object, for as long as the same list
 * stands; a new one is read for a list built anew, for [builtFor] (a list that
 * is remounted by its key) or because the last was taken down ([standing]).
 */
export function startingOffset(
  held: StartingOffset | null,
  builtFor: unknown,
  standing: boolean,
  where: () => number
): StartingOffset {
  if (held && standing && held.builtFor === builtFor) return held;
  return { builtFor, offset: { x: 0, y: where() } };
}
