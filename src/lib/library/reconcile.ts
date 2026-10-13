/**
 * Whether two readings of one track say the same thing.
 *
 * Field by field and one level down, which is as deep as a track goes: every
 * field is a word or a number or nothing, but for the tags, and those are a
 * short list of words. Anything deeper than that would be compared by being
 * the same object, which a fresh reading never is — so a field of that kind
 * added to a track one day shows up here as a track that always differs,
 * which is slow and not wrong.
 */
export function sameTrack<T extends object>(one: T, other: T): boolean {
  if (one === other) return true;
  const fields = Object.keys(one) as (keyof T)[];
  if (fields.length !== Object.keys(other).length) return false;
  for (const field of fields) {
    const a = one[field];
    const b = other[field];
    if (a === b) continue;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let at = 0; at < a.length; at += 1) if (a[at] !== b[at]) return false;
  }
  return true;
}

/**
 * A fresh reading of the library, made out of what was already being shown
 * wherever the two agree.
 *
 * Reading the library again makes every track again, alike in everything and
 * the same in nothing; and a list asks whether a row is to be drawn again by
 * asking whether it has been handed the same track. So a reading that found
 * nothing new used to redraw every row on screen, rebuild every album and
 * search every title again, to arrive at the picture it started from.
 *
 * What comes back holds the shown track wherever the read one says the same,
 * and the read one where it does not or where there was none. If that is the
 * shown list over again, track for track and in the same order, it is the
 * shown list itself that comes back, and whoever asks whether anything changed
 * can ask it with `===`.
 *
 * The order is the reading's. Most readings find the tracks where they were,
 * so each is first looked for in the place it had, and the tracks are only
 * gone through by id once one of them has moved.
 */
export function keepIdentity<T extends { id: string }>(shown: readonly T[], read: readonly T[]): T[] {
  let byId: Map<string, T> | null = null;
  let changed = shown.length !== read.length;

  const kept = read.map((track, at) => {
    const there = shown[at];
    const before =
      there?.id === track.id
        ? there
        : (byId ??= new Map(shown.map((entry) => [entry.id, entry]))).get(track.id);
    const same = before && sameTrack(before, track) ? before : track;
    if (same !== there) changed = true;
    return same;
  });

  return changed ? kept : (shown as T[]);
}

/**
 * The same for something read beside the library and keyed by track: when each
 * was last played, how often. [shown] itself if [read] says exactly what it
 * says, and [read] otherwise.
 *
 * These are read again on every visit as the library is, and for the same
 * reason are nearly always what they were. A list ordered by one of them is
 * put in order again whenever it is handed a new one, whatever is in it.
 */
export function keepMap<K, V, M extends ReadonlyMap<K, V>>(shown: M, read: M): M {
  if (shown === read) return shown;
  if (shown.size !== read.size) return read;
  for (const [key, value] of read) {
    if (shown.get(key) !== value || (value === undefined && !shown.has(key))) return read;
  }
  return shown;
}
