import type { TapePlace } from './places';

/**
 * The tapes in the order the library shows them: the ones part way through
 * first, the one last listened to at the top, which is what somebody coming
 * to this view has come to carry on with; then the ones not begun, in the
 * order they came; and the ones heard to the end last, latest first.
 */
export function orderTapes<T extends { id: string }>(tapes: readonly T[], places: ReadonlyMap<string, TapePlace>): T[] {
  const begun: T[] = [];
  const fresh: T[] = [];
  const heard: T[] = [];
  for (const tape of tapes) {
    const place = places.get(tape.id);
    if (!place || (!place.finished && place.positionSec < 10)) fresh.push(tape);
    else if (place.finished) heard.push(tape);
    else begun.push(tape);
  }
  const latest = (a: T, b: T) => (places.get(b.id)?.at ?? 0) - (places.get(a.id)?.at ?? 0);
  return [...begun.sort(latest), ...fresh, ...heard.sort(latest)];
}

type Part = { id: string; album: string | null; artist: string | null; discNumber?: number | null; trackNumber: number | null; filename: string | null };

/**
 * What a tape is played with: the other tapes of the same record — the parts
 * of a book, the episodes of a show as they were filed — in their order, so
 * that one runs on into the next; or the tape alone, where it has no record.
 */
export function partsOf<T extends Part>(tape: T, tapes: readonly T[]): { tracks: T[]; index: number } {
  if (!tape.album) return { tracks: [tape], index: 0 };
  const parts = tapes.filter((other) => other.album === tape.album && (other.artist ?? '') === (tape.artist ?? '')).sort(byPart);
  const index = parts.findIndex((part) => part.id === tape.id);
  return index < 0 ? { tracks: [tape], index: 0 } : { tracks: parts, index };
}

/** One part before another of the same record: by disc, by number, then by name, which for a show is the day it came out. */
function byPart(a: Part, b: Part): number {
  return (
    (a.discNumber ?? 0) - (b.discNumber ?? 0) ||
    (a.trackNumber ?? 0) - (b.trackNumber ?? 0) ||
    (a.filename ?? '').localeCompare(b.filename ?? '', undefined, { numeric: true })
  );
}

/**
 * A followed show's episodes in the order they came out: every tape in its
 * folder, whatever their tags say, by the name each was filed under, which
 * begins with the day it came out. Tags are the feed's, and change, or are
 * missing, or count each season from one; the folder and the day do not.
 */
export function inSeriesOrder<T extends { filename: string | null }>(tapes: readonly T[]): T[] {
  return [...tapes].sort((a, b) => (a.filename ?? '').localeCompare(b.filename ?? '', undefined, { numeric: true }));
}

/**
 * Tapes chosen together, in the order they are played: each record's parts
 * together and in their order, the records one after another by name.
 */
export function inRecordOrder<T extends Part>(tapes: readonly T[]): T[] {
  return [...tapes].sort(
    (a, b) =>
      (a.artist ?? '').localeCompare(b.artist ?? '') ||
      (a.album ?? '').localeCompare(b.album ?? '') ||
      byPart(a, b)
  );
}

/**
 * What a series is carried on with at one press: the episode part way
 * through that was listened to last; or, with none begun, the newest of
 * those not yet heard — or for a book, [fresh] `first`, the first of them,
 * which is where a book is taken up; or nothing, where every one here has
 * been heard. [tapes] in the order they go, oldest or first part first.
 */
export function nextToPlay<T extends { id: string }>(
  tapes: readonly T[],
  places: ReadonlyMap<string, TapePlace>,
  fresh: 'newest' | 'first' = 'newest'
): T | null {
  let begun: T | null = null;
  let latest = -Infinity;
  for (const tape of tapes) {
    const place = places.get(tape.id);
    if (place && !place.finished && place.positionSec >= 10 && place.at > latest) {
      begun = tape;
      latest = place.at;
    }
  }
  if (begun) return begun;
  const unheard = (tape: T) => {
    const place = places.get(tape.id);
    return !place || (!place.finished && place.positionSec < 10);
  };
  return (fresh === 'first' ? tapes.find(unheard) : [...tapes].reverse().find(unheard)) ?? null;
}
