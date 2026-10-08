/**
 * A list's members, some of which may not be in the library right now.
 *
 * Membership is kept by media store id and outlives the library it was made
 * in: the folder being read can be narrowed, a card taken out, the permission
 * withdrawn. None of those is the user taking a song off a list, so none of
 * them removes anything — the list simply shows what can be played today and
 * keeps the rest for the day it comes back. That makes "the fourth row" and
 * "the fourth member" two different things, and the arithmetic between them
 * lives here, away from the SQL, so it can be checked rather than assumed.
 */

/** The members that are in the library, in the list's own order. */
export function present(ids: string[], has: (id: string) => boolean): string[] {
  return ids.filter(has);
}

/**
 * The order after dragging [movedId] onto the row holding [targetId].
 *
 * Named by id rather than by row because the rows are only the members on
 * show: with one hidden above them, row 2 is member 3, and moving "2 to 4"
 * would move somebody else. The moved track takes the target's place and the
 * target shifts towards where the moved one came from, which is what a drag
 * looks like — and the members not on show keep their places among the rest.
 *
 * Null when there is nothing to do, so the caller writes nothing.
 */
export function moveOnto(ids: string[], movedId: string, targetId: string): string[] | null {
  const from = ids.indexOf(movedId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;

  const order = [...ids];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return order;
}
