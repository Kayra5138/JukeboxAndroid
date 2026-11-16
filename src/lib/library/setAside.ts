import { useMemo, useSyncExternalStore } from 'react';

import { listMemberIds } from '../lists/memberIds';
import { listsVersion, subscribeLists } from '../playlists/listEvents';

import { creditReader } from '../db/credits';
import { db } from '../db/index';
import { strings } from '../i18n/languages';
import { albumsOf } from '../media/albums';
import { artistsOf } from '../media/artists';
import type { EnrichedTrack } from '../media/merge';
import { isTape } from '../tapes/tape';
import { createStore } from '../ui/store';
import { libraryState, subscribeLibrary } from './index';
import { NOTHING_SET_ASIDE, setAsideIds, setAsideOf, type SetAside, type SetAsideKind } from './setAsideRule';

/**
 * What is set aside, read from its table once and kept here, so that the
 * Tracks view, the shuffle and the copy for the car all read the same thing
 * and are told at once when it changes (`setAsideRule.ts` says what it is).
 */
const held = createStore<SetAside | null>(null);

function read(): SetAside {
  try {
    return setAsideOf(db().getAllSync<{ kind: string; key: string }>('SELECT kind, key FROM set_aside'));
  } catch {
    // A database that will not open has nothing set aside that can be shown.
    return NOTHING_SET_ASIDE;
  }
}

/** The rows as one line, to tell whether two readings differ. */
const said = (rules: SetAside) => JSON.stringify(Object.entries(rules).map(([kind, keys]) => [kind, [...keys].sort()]));

/*
  Read again whenever the library is: a song's id moved with its file, or a
  backup restored, changes the table behind this, and both are followed by the
  library being read again. Kept as it was where nothing changed, so that
  nothing worked out from it is worked out again.
*/
const readAgain = () => {
  const now = held.get();
  if (!now) return;
  const fresh = read();
  if (said(fresh) !== said(now)) held.set(fresh);
};
subscribeLibrary(readAgain);
// And whenever a list is: one deleted takes its row here with it.
subscribeLists(readAgain);

/** What is set aside now. */
export function setAsideRules(): SetAside {
  const now = held.get();
  if (now) return now;
  const loaded = read();
  held.set(loaded);
  return loaded;
}

export function watchSetAside(listener: () => void): () => void {
  return held.subscribe(listener);
}

export function useSetAside(): SetAside {
  return useSyncExternalStore(held.subscribe, setAsideRules);
}

/** Sets [key] of [kind] aside, or brings it back. */
export function setAside(kind: SetAsideKind, key: string, aside: boolean): void {
  setAsideMany(kind, [key], aside);
}

/** The same for several of one kind at once, as a selection of songs is. */
export function setAsideMany(kind: SetAsideKind, keys: readonly string[], aside: boolean): void {
  if (keys.length === 0) return;
  const database = db();
  database.withTransactionSync(() => {
    for (const key of keys) {
      if (aside) database.runSync('INSERT OR IGNORE INTO set_aside (kind, key, added_at) VALUES (?, ?, ?)', kind, key, Date.now());
      else database.runSync('DELETE FROM set_aside WHERE kind = ? AND key = ?', kind, key);
    }
  });
  held.set(read());
}

/**
 * The last answer, kept while it is asked of the same songs, the same rules
 * and, where a list is set aside, the same lists: a menu opened twice reads
 * it once, and a song put in a list set aside is set aside at once.
 */
let lastly: { tracks: readonly EnrichedTrack[]; rules: SetAside; lists: number; ids: Set<string> } | null = null;

/** How the lists stand, where any is set aside; nothing to follow otherwise. */
const listsFor = (rules: SetAside) => (rules.list.size > 0 ? listsVersion() : 0);

/**
 * The ids of [tracks] that are set aside, the records and artists they are on
 * worked out as the screens work them out, and only where one is set aside.
 */
export function setAsideIdsIn(
  tracks: readonly EnrichedTrack[],
  rules: SetAside = setAsideRules(),
  lists: number = listsFor(rules)
): Set<string> {
  if (lastly && lastly.tracks === tracks && lastly.rules === rules && lastly.lists === lists) return lastly.ids;
  const ids = setAsideIds(tracks, rules, {
    albums: () => albumsOf(tracks),
    artists: () => artistsOf(tracks, creditReader(), strings()),
    list: (key) => listMemberIds({ kind: 'list', id: Number(key) }, tracks)?.ids ?? [],
  });
  lastly = { tracks, rules, lists, ids };
  return ids;
}

/** The library's songs, as the Tracks view starts from them: everything but the tapes. */
let music: { from: readonly EnrichedTrack[]; songs: EnrichedTrack[] } | null = null;
function librarySongs(): EnrichedTrack[] {
  const state = libraryState();
  const from = state.kind === 'library' ? state.tracks : [];
  if (music?.from !== from) music = { from, songs: from.filter((track) => !isTape(track)) };
  return music.songs;
}

/** The ids of the library's songs that are set aside now: for what picks songs to keep the music going, and the car's copy. */
export function librarySetAside(): Set<string> {
  return setAsideIdsIn(librarySongs());
}

/**
 * How a song is set aside: by itself, which its own menu can undo; with a
 * record, an artist, a folder or a tag, which only undoing that brings back;
 * or not at all.
 */
export function asideOf(trackId: string): 'itself' | 'others' | null {
  const rules = setAsideRules();
  if (rules.track.has(trackId)) return 'itself';
  return setAsideIdsIn(librarySongs(), rules).has(trackId) ? 'others' : null;
}

/** The same, kept for as long as the songs and what is set aside are the same. */
export function useSetAsideIds(tracks: readonly EnrichedTrack[]): Set<string> {
  const rules = useSetAside();
  // Followed only where a list is set aside, since only then does a change to a list change this.
  const lists = useSyncExternalStore(subscribeLists, listsVersion);
  const following = rules.list.size > 0 ? lists : 0;
  return useMemo(() => setAsideIdsIn(tracks, rules, following), [rules, tracks, following]);
}

/** [tracks] less what is set aside: what the Tracks view lists and what shuffling everything plays. */
export function withoutSetAside<T extends EnrichedTrack>(tracks: readonly T[], aside: ReadonlySet<string> = setAsideIdsIn(tracks)): T[] {
  return aside.size === 0 ? [...tracks] : tracks.filter((track) => !aside.has(track.id));
}
