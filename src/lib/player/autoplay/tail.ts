import { restoreFrom } from './section.ts';

/**
 * The note of which songs at the end of the queue were picked, as it is
 * written down: `SETTINGS.autoplayQueued`.
 *
 * Kept on this side and not by the player, which keeps the queue itself. The
 * player's copy of the queue is a list of media items written by the service
 * whenever the queue changes; marking items in it would mean a field on every
 * item, carried through every way an item is made, read back and compared —
 * for one boundary that this side already knows and can write down in a line.
 * What it costs is that the two are written at different moments, which
 * `restoreFrom` allows for.
 */
export type TailNote = {
  /** The picked songs' ids, in their order: the end of the queue. */
  ids: string[];
  /** The id of the queue's first song, which is what says a later queue is the same one. */
  head: string | null;
  /** The picks were taken out of that queue, and it is not to be given more. */
  dismissed: boolean;
};

const NOTHING: TailNote = { ids: [], head: null, dismissed: false };

export function readTail(words: string | null | undefined): TailNote {
  if (!words) return NOTHING;
  try {
    const value: unknown = JSON.parse(words);
    if (!value || typeof value !== 'object') return NOTHING;
    const { ids, head, dismissed } = value as Partial<Record<keyof TailNote, unknown>>;
    return {
      ids: Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [],
      head: typeof head === 'string' ? head : null,
      dismissed: dismissed === true,
    };
  } catch {
    return NOTHING;
  }
}

export function writeTail(note: TailNote): string {
  return JSON.stringify(note);
}

/**
 * The note for a queue as it stands. Only the end of it is read: this is
 * written after every edit of a queue that can be the whole library.
 */
export function tailOf(queue: readonly { id: string }[], autoFrom: number, dismissed: boolean): TailNote {
  return { ids: autoFrom >= 0 ? queue.slice(autoFrom).map((track) => track.id) : [], head: queue[0]?.id ?? null, dismissed };
}

/**
 * Where the picks begin in a queue read back from the player, and whether
 * they were taken out of it, from the note. A queue that begins with some
 * other song is some other queue, and was never dismissed.
 */
export function restoreTail(queueIds: readonly string[], note: TailNote): { autoFrom: number; dismissed: boolean } {
  const same = queueIds.length > 0 && note.head === queueIds[0];
  return { autoFrom: same ? restoreFrom(queueIds, note.ids) : -1, dismissed: same && note.dismissed };
}
