import { useSyncExternalStore } from 'react';

import { AUTO_LISTS, type AutoListId } from '../db/autoLists.ts';
import { labelOfSetting, SHUFFLE_ALL, sourceKey, sourceOfKey, type ShuffleLabel, type ShuffleSource } from './shuffleKinds.ts';
import { readSetting, SETTINGS, writeSetting } from '../db/index.ts';
import { playlists, type Playlist } from '../db/playlists.ts';
import type { Strings } from '../i18n/en/index.ts';
import { isTape } from '../tapes/tape.ts';
import { createStore } from '../ui/store.ts';
import { listMemberIds } from './memberIds.ts';
import type { SmartTrack } from './smart.ts';

export { labelOfSetting, SHUFFLE_ALL, sourceKey, sourceOfKey } from './shuffleKinds.ts';
export type { ShuffleLabel, ShuffleSource } from './shuffleKinds.ts';

// Held where they can be watched: the button and the settings page show them at once.
const source = createStore<ShuffleSource>(SHUFFLE_ALL);
const label = createStore<ShuffleLabel>({ mode: 'name' });
let read = false;

function readBoth(): void {
  if (read) return;
  read = true;
  try {
    source.set(sourceOfKey(readSetting(SETTINGS.shuffleSource)));
    label.set(labelOfSetting(readSetting(SETTINGS.shuffleLabel)));
  } catch {
    // Everything, by its name.
  }
}

export function shuffleSource(): ShuffleSource {
  readBoth();
  return source.get();
}

export function useShuffleSource(): ShuffleSource {
  return useSyncExternalStore(source.subscribe, shuffleSource);
}

export function setShuffleSource(next: ShuffleSource): void {
  read = true;
  source.set(next);
  writeSetting(SETTINGS.shuffleSource, sourceKey(next));
}

export function shuffleLabel(): ShuffleLabel {
  readBoth();
  return label.get();
}

export function useShuffleLabel(): ShuffleLabel {
  return useSyncExternalStore(label.subscribe, shuffleLabel);
}

export function setShuffleLabel(next: ShuffleLabel): void {
  read = true;
  label.set(next);
  writeSetting(SETTINGS.shuffleLabel, JSON.stringify(next));
}

/** One thing the button can play, with what it is called and how many songs of the library it holds today. */
export type ShuffleChoice = {
  key: string;
  source: ShuffleSource;
  name: string;
  /** What sort of list, for what is drawn beside it. */
  sort: 'all' | 'favorites' | 'list' | 'smart' | 'auto';
  count: number;
};

/** Names this side does not keep: everything, and the lists made from the listening, in the app's language. */
export type ShuffleNames = { all: string; auto: Record<AutoListId, string> };

/** The songs a list holds, in its order, of those in [byId]: the library's songs, tapes left out before. */
function songsOf<T extends SmartTrack>(ids: readonly string[], byId: Map<string, T>): T[] {
  return ids.flatMap((id) => {
    const track = byId.get(id);
    return track ? [track] : [];
  });
}

/**
 * Everything the button can play, in the order the menu shows them:
 * everything, Favorites (where it is shown), the user's lists as the Lists
 * tab orders them, then those made from the listening. A list with none of
 * the library's songs in it today is left out, there being nothing to shuffle.
 */
export function shuffleChoices<T extends SmartTrack & { folder?: string | null }>(
  music: readonly T[],
  names: ShuffleNames,
  favoritesShown: boolean,
  lists: readonly Playlist[] = playlists(),
  aside: ReadonlySet<string> = NONE
): ShuffleChoice[] {
  const songs = music.filter((track) => !isTape(track));
  const byId = new Map(songs.map((track) => [track.id, track]));
  const everything = aside.size === 0 ? songs.length : songs.filter((track) => !aside.has(track.id)).length;
  const choices: ShuffleChoice[] = [{ key: 'all', source: SHUFFLE_ALL, name: names.all, sort: 'all', count: everything }];
  const ordered = [
    ...lists.filter((list) => list.kind === 'favorites' && favoritesShown),
    ...lists.filter((list) => list.kind !== 'favorites'),
  ];
  for (const list of ordered) {
    const members = listMemberIds({ kind: 'list', id: list.id }, songs);
    const count = members ? songsOf(members.ids, byId).length : 0;
    if (count === 0) continue;
    const sort = list.kind === 'favorites' ? 'favorites' : list.kind === 'smart' ? 'smart' : 'list';
    choices.push({ key: `list:${list.id}`, source: { kind: 'list', id: list.id }, name: list.name, sort, count });
  }
  for (const id of AUTO_LISTS) {
    const members = listMemberIds({ kind: 'auto', id, name: names.auto[id] }, songs);
    const count = members ? songsOf(members.ids, byId).length : 0;
    if (count > 0) choices.push({ key: `auto:${id}`, source: { kind: 'auto', id }, name: names.auto[id], sort: 'auto', count });
  }
  return choices;
}

/** Nothing set aside. */
const NONE: ReadonlySet<string> = new Set();

/**
 * The songs [source] holds of [music], to be shuffled, and what it is called;
 * everything, and `gone`, for a list that is no more or has none of them now.
 * Everything is everything but what has been set aside ([aside], the ids of
 * those songs: `library/setAside.ts`); a list is what is in it, whatever has
 * been set aside, since somebody put it there.
 */
export function shuffleTracks<T extends SmartTrack & { folder?: string | null }>(
  wanted: ShuffleSource,
  music: readonly T[],
  names: ShuffleNames,
  aside: ReadonlySet<string> = NONE
): { tracks: T[]; name: string; gone: boolean } {
  const songs = music.filter((track) => !isTape(track));
  const everything = aside.size === 0 ? songs : songs.filter((track) => !aside.has(track.id));
  if (wanted.kind === 'all') return { tracks: everything, name: names.all, gone: false };
  const members = listMemberIds(
    wanted.kind === 'auto' ? { kind: 'auto', id: wanted.id, name: names.auto[wanted.id] } : wanted,
    songs
  );
  const tracks = members ? songsOf(members.ids, new Map(songs.map((track) => [track.id, track]))) : [];
  if (!members || tracks.length === 0) return { tracks: everything, name: names.all, gone: true };
  return { tracks, name: members.name, gone: false };
}

/** What a source is called today, without gathering its songs: for the button's words. Null for a list that is no more. */
export function sourceName(wanted: ShuffleSource, names: ShuffleNames, lists: readonly Playlist[] = playlists()): string | null {
  if (wanted.kind === 'all') return names.all;
  if (wanted.kind === 'auto') return names.auto[wanted.id];
  return lists.find((list) => list.id === wanted.id)?.name ?? null;
}

/** Everything, and the lists made from the listening, by the names [t] gives them. */
export function shuffleNamesOf(t: Strings): ShuffleNames {
  return {
    all: t.library.shuffle.everything,
    auto: {
      mostPlayed: t.lists.auto.mostPlayed.name,
      recentlyFound: t.lists.auto.recentlyFound.name,
      forgotten: t.lists.auto.forgotten.name,
      skipped: t.lists.auto.skipped.name,
    },
  };
}

/**
 * What the button says, as [label] has it for [wanted], called [name]:
 * `shown` beside its icon, null for the icon alone; and `spoken`, what it does
 * in words, for a screen reader and for the car, whose tiles must have words.
 * Everything says "Shuffle all", as it always did; anything else, its name.
 */
export function shuffleWordsFor(
  t: Strings,
  wanted: ShuffleSource,
  label: ShuffleLabel,
  name: string
): { shown: string | null; spoken: string } {
  const spoken = wanted.kind === 'all' ? t.library.screen.shuffleAll : t.library.shuffle.spoken(name);
  if (label.mode === 'icon') return { shown: null, spoken };
  if (label.mode === 'words') return { shown: label.words, spoken: label.words };
  return { shown: wanted.kind === 'all' ? t.library.screen.shuffleAll : name, spoken };
}

/** Called whenever what the button plays or says is changed: the copy the car and the widget read follows. */
export function watchShuffle(changed: () => void): () => void {
  const one = source.subscribe(changed);
  const two = label.subscribe(changed);
  return () => {
    one();
    two();
  };
}
