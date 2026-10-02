/**
 * Where a tag sits in a track's list.
 *
 * The order is read straight off the `position` column, so two tags on one
 * track holding the same position leaves `ORDER BY position` free to settle
 * them however it likes — and position 0 is whatever best describes the track,
 * which makes that order something the user sees. The arithmetic lives here,
 * away from the SQL, so the rule can be checked rather than assumed.
 */

/**
 * The position for a tag going on the end of a track's list, given the
 * positions the tags already there hold.
 *
 * Above the highest rather than into the first gap, because the caller is
 * appending. Reading where the tags are rather than counting them is what
 * makes it safe: nothing keeps a list numbered 0..n-1 — dropping the rows
 * between two of them leaves the survivors at 0 and 5 — and a count then hands
 * back a position somebody is already sitting on.
 */
export function nextPosition(taken: number[]): number {
  return taken.reduce((highest, position) => Math.max(highest, position), -1) + 1;
}
