/**
 * The two buttons that move a little way through the record.
 *
 * A step rather than a drag, because what they are for is catching the line
 * that just went past — and a scrub bar the width of a phone puts a four
 * minute song into some three hundred pixels, which is a second and a half
 * under the smallest movement a thumb can make on purpose.
 *
 * Nothing here reads the database. The step is a stored string somewhere else
 * in the app and a number here, and keeping the parsing apart from the reading
 * is what lets both of them be checked without a phone to store anything on.
 */

/** How far a press moves, in seconds. */
export const JUMP_STEPS = [5, 10, 15, 30, 60] as const;

/** The step nobody chose: what every other player uses, so a thumb knows it. */
export const DEFAULT_JUMP = 10;

/** The step a stored setting means, falling back to ten for anything else. */
export function stepFrom(saved: string | null): number {
  const seconds = Number(saved);
  return (JUMP_STEPS as readonly number[]).includes(seconds) ? seconds : DEFAULT_JUMP;
}

/**
 * Where a jump of [bySec] from [positionSec] lands.
 *
 * Kept inside the record at both ends. Backwards past the start is the start,
 * which is what pressing it twice at the opening of a song should do rather
 * than ask the player to seek to a negative time. Forwards it stops at the end
 * rather than running over into the next track: these buttons are for moving
 * about within something, and there is already a button for leaving it.
 *
 * A duration of zero means the player has not prepared the track and does not
 * yet know how long it is. There is nothing to clamp against then, so only the
 * near end is held.
 */
export function jumpTo(positionSec: number, bySec: number, durationSec: number): number {
  const to = positionSec + bySec;
  if (to < 0) return 0;
  if (durationSec > 0 && to > durationSec) return durationSec;
  return to;
}
