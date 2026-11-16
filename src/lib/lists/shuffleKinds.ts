import type { AutoListId } from '../db/autoLists.ts';

/** The lists made from the listening, by id: every one of them, or this does not compile. Here rather than read from `db/autoLists.ts`, which opens the database. */
const AUTO_IDS: Record<AutoListId, true> = { mostPlayed: true, recentlyFound: true, forgotten: true, skipped: true };

/**
 * What the shuffle button over the tracks plays: everything, as it always
 * did, or any one list -- Favorites, one of the user's, a smart list, or one
 * of those made from the listening. Chosen for good under Settings › Library
 * or at the foot of the menu the button opens when held, and for once from
 * that menu (`components/ShuffleButton.tsx`). The widget's shuffle and the
 * car's play the same (`db/carCopy.ts`).
 *
 * Kept as a word, so that what it names can go: a list deleted is everything
 * again, and the button says so.
 */
export type ShuffleSource = { kind: 'all' } | { kind: 'list'; id: number } | { kind: 'auto'; id: AutoListId };

export const SHUFFLE_ALL: ShuffleSource = Object.freeze({ kind: 'all' });

export function sourceKey(source: ShuffleSource): string {
  return source.kind === 'all' ? 'all' : `${source.kind}:${source.id}`;
}

export function sourceOfKey(key: string | null | undefined): ShuffleSource {
  const [kind, id] = (key ?? '').split(':');
  if (kind === 'list' && id && /^\d+$/.test(id)) return { kind: 'list', id: Number(id) };
  if (kind === 'auto' && id && Object.prototype.hasOwnProperty.call(AUTO_IDS, id)) return { kind: 'auto', id: id as AutoListId };
  return SHUFFLE_ALL;
}

/** What the button says: the name of what it plays, the user's own words, or nothing beside its icon. */
export type ShuffleLabel = { mode: 'name' } | { mode: 'words'; words: string } | { mode: 'icon' };

export function labelOfSetting(value: string | null | undefined): ShuffleLabel {
  try {
    const read: unknown = JSON.parse(value ?? '');
    if (read && typeof read === 'object') {
      const mode = (read as { mode?: unknown }).mode;
      const words = (read as { words?: unknown }).words;
      if (mode === 'icon') return { mode: 'icon' };
      if (mode === 'words' && typeof words === 'string' && words.trim()) return { mode: 'words', words: words.trim() };
    }
  } catch {
    // The name.
  }
  return { mode: 'name' };
}

