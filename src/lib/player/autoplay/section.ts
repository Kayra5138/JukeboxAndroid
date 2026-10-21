/**
 * Where the songs that were picked begin, and keeping that true through every
 * edit of the queue.
 *
 * The picked songs are always the end of the queue: everything from one
 * position on. That is the whole of how they are told apart, and it is kept
 * true by deciding, for each edit, where that position goes. One number,
 * rather than a mark on each entry, because the same track can be in the queue
 * twice and the player addresses entries by position anyway — and because the
 * rule that matters most is about the boundary itself: what somebody adds to
 * the queue goes in front of it, so that their choice is never buried under
 * songs they did not choose.
 *
 * `-1` is "there are none". Every function here answers `-1` rather than a
 * position at or past the end, so that "none" is only ever said one way.
 */

/** The boundary, or -1 where it would leave nothing after it. */
function within(from: number, length: number): number {
  return from >= 0 && from < length ? from : -1;
}

/**
 * The first picked song still to come: the boundary, or the song after the
 * one playing where that is further on. -1 where none is still to come.
 */
export function pendingFrom(autoFrom: number, currentIndex: number, length: number): number {
  if (autoFrom < 0) return -1;
  return within(Math.max(autoFrom, currentIndex + 1), length);
}

/**
 * Where a song somebody queued goes, and where the picked songs begin after it.
 *
 * `end` is "Add to queue". While picked songs are still to come it goes in
 * front of the first of them; with none to come it goes on the end as it
 * always did, and the picked songs already played stop being told apart — they
 * are history, and the end of the queue is now somebody's own song.
 *
 * Otherwise it is "Play next", at [index]. Ahead of the boundary that moves
 * the boundary on by one. Past it — a picked song is playing — the song goes
 * where it was asked to, and the boundary moves to just after it: what follows
 * is still picked, and the played picks before it are history.
 */
export function placeQueued(
  length: number,
  autoFrom: number,
  currentIndex: number,
  index: number,
  end: boolean
): { index: number; autoFrom: number } {
  if (autoFrom < 0) return { index, autoFrom: -1 };
  if (end) {
    const pending = pendingFrom(autoFrom, currentIndex, length);
    return pending < 0 ? { index: length, autoFrom: -1 } : { index: pending, autoFrom: pending + 1 };
  }
  if (index <= autoFrom) return { index, autoFrom: autoFrom + 1 };
  return { index, autoFrom: within(index + 1, length + 1) };
}

/** The boundary once the row at [index] is taken out of a queue that is [length] long after it. */
export function afterRemoving(autoFrom: number, index: number, length: number): number {
  if (autoFrom < 0) return -1;
  return within(index < autoFrom ? autoFrom - 1 : autoFrom, length);
}

/**
 * The boundary once the row at [from] is dragged to [to].
 *
 * A picked song dragged above the boundary has been chosen, and is somebody's
 * own song from then on. One of theirs dragged below it is not handed over to
 * the picks: the boundary moves down to just after it, so that taking the
 * picks away can never take it with them. Dropped exactly on the boundary, a
 * row stays on the side it came from.
 */
export function afterMoving(autoFrom: number, from: number, to: number, length: number): number {
  if (autoFrom < 0 || from === to) return autoFrom;
  const wasPicked = from >= autoFrom;
  const lifted = from < autoFrom ? autoFrom - 1 : autoFrom;
  if (to < lifted) return within(lifted + 1, length);
  if (to > lifted) return wasPicked ? within(lifted, length) : within(to + 1, length);
  return within(wasPicked ? lifted : lifted + 1, length);
}

/**
 * Where the picked songs begin in a queue read back from the player, given the
 * ids they were written down as (see `SETTINGS.autoplayQueued`).
 *
 * The player keeps its queue across a restart and the app keeps this note of
 * which part of it was picked; the two are written at different moments, and
 * the player's copy can be a few songs behind the note — the last ones added
 * just before the app was put away. So the queue is taken to end with the
 * first so many of the noted songs, the most that fit, and is otherwise not
 * believed to have any: a queue that ends some other way is a different queue.
 */
export function restoreFrom(queueIds: readonly string[], noted: readonly string[]): number {
  for (let k = Math.min(queueIds.length, noted.length); k >= 1; k--) {
    const start = queueIds.length - k;
    let same = true;
    for (let i = 0; i < k && same; i++) same = queueIds[start + i] === noted[i];
    if (same) return start;
  }
  return -1;
}

/**
 * The rows of a list with a heading over its picked songs: each a position in
 * the queue, or `'divider'`. Positions are what the screen draws from and the
 * player is told; the heading is only ever drawn.
 */
export type ShownRow = number | 'divider';

/** Where the heading goes among [length] rows, or -1 for none. */
export function dividerAt(autoFrom: number, length: number): number {
  return within(autoFrom, length);
}

/** The row on screen a queue position is drawn in. */
export function shownIndex(position: number, divider: number): number {
  return divider >= 0 && position >= divider ? position + 1 : position;
}

/** The queue position a row on screen stands for, or -1 for the heading itself. */
export function queueIndex(row: number, divider: number): number {
  if (divider < 0 || row < divider) return row;
  return row === divider ? -1 : row - 1;
}

/**
 * A drag on screen, from row [from] to row [to], as a move in the queue.
 *
 * The heading is a row on screen and not in the queue, so a row dropped on or
 * past it is one place nearer the top in the queue than on screen. Null for a
 * drag that comes to no move.
 */
export function queueMove(from: number, to: number, divider: number): { from: number; to: number } | null {
  const start = queueIndex(from, divider);
  if (start < 0) return null;
  if (divider < 0) return to === start ? null : { from: start, to };
  // Where the heading stands once the row is lifted out, and so whether the row comes down after it.
  const heading = from < divider ? divider - 1 : divider;
  const landing = to > heading ? to - 1 : to;
  return landing === start ? null : { from: start, to: landing };
}
