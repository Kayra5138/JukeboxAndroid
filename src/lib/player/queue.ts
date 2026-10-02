/**
 * Position arithmetic for the queue.
 *
 * The queue is addressed by position rather than by track id because the same
 * track can sit in it more than once. Working out where a position lands after
 * an edit is fiddly enough to be worth keeping separate and tested.
 */

/**
 * How far a row shifts, in rows, while another row is dragged over it.
 *
 * Everything between the row's old and new position slides one place to fill
 * the gap it left, which is what shows the reader where the drop will land.
 */
export function rowShift(index: number, from: number, to: number): number {
  if (index === from) return 0;
  if (from < to) return index > from && index <= to ? -1 : 0;
  if (from > to) return index >= to && index < from ? 1 : 0;
  return 0;
}

/** Where the position `current` ends up once the row at `from` moves to `to`. */
export function indexAfterMove(current: number, from: number, to: number): number {
  if (current === from) return to;
  return current + rowShift(current, from, to);
}

/** Where the position `current` ends up once a row is inserted at `at`. */
export function indexAfterInsert(current: number, at: number): number {
  return at <= current ? current + 1 : current;
}

/**
 * Where the position `current` ends up once the row at `at` is removed.
 *
 * Removing the playing row leaves the position pointing at whatever slid into
 * its place, which is what the player moves on to; the track change it emits is
 * what settles which one that is.
 */
export function indexAfterRemove(current: number, at: number): number {
  return at < current ? current - 1 : current;
}

/**
 * The position "play next" asks for, given the row playing now.
 *
 * A queue can be non-empty while the row playing in it is unknown: the player
 * is read back after the JavaScript side is thrown away, and a reading that
 * cannot say which row is playing leaves the index at -1 with the queue it
 * came with intact. Adding one to that and calling the answer a position puts
 * the track at the very top — ahead of everything already queued, and, since
 * whichever row is playing is below it, behind the playhead as well. The one
 * track the user asked to hear next becomes the one track that will not play.
 *
 * With no current row there is no "after the current one" to honour, so this
 * gives back the queue's own "on the end", which is what the neighbouring "add
 * to queue" does. Landing one place too late is a smaller surprise than
 * jumping the whole queue, and the only one of the two the user could have
 * asked for.
 */
export function playNextPosition(currentIndex: number): number {
  return currentIndex < 0 ? -1 : currentIndex + 1;
}

/**
 * How to get a track into the queue.
 *
 * Inserting is only an insert while there is something to insert into. The
 * player is handed items one at a time but is only ever prepared and told to
 * play by being given a whole queue, so adding to an empty one puts a track
 * into a player that is not going to do anything with it — no audio, and no
 * current track either, which is what draws the queue in the first place.
 */
export function insertPlan(
  queueLength: number,
  at: number
): { replace: true } | { replace: false; index: number } {
  if (queueLength === 0) return { replace: true };
  const index = at < 0 ? queueLength : Math.min(Math.max(at, 0), queueLength);
  return { replace: false, index };
}
