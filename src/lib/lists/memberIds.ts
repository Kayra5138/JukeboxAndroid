import { autoListTrackIds, type AutoListId } from '../db/autoLists.ts';
import { playlist, playlistTrackIds } from '../db/playlists.ts';
import { trackIdsWithTag } from '../db/tags.ts';
import type { SmartStats, SmartTrack } from './smart.ts';
import { readSmartStats, smartListTracks } from './smartLive.ts';

/** A list of any kind, by what it is: one of the user's (Favorites, a tag's, a smart one among them), or one made from the listening. */
export type ListSource = { kind: 'list'; id: number } | { kind: 'auto'; id: AutoListId; name: string };

/**
 * What a list holds, by id, in its order: what was put in it, or what
 * carries its tag in the library's order, or what a smart list's rules or an
 * auto list find today. Null for a list that is no more.
 *
 * Members that are hidden from the library are in it: they are files, and
 * the list has them. Whoever plays them or writes them out keeps to what
 * [library] has, as it needs.
 */
export function listMemberIds<T extends SmartTrack & { folder?: string | null }>(
  source: ListSource,
  library: readonly T[],
  /** What has been listened to, for a smart list's rules, from a caller asking about many lists: read once for all of them, rather than once a list. */
  stats?: () => SmartStats
): { name: string; ids: string[] } | null {
  if (source.kind === 'auto') return { name: source.name, ids: autoListTrackIds(source.id, Date.now()) };
  const details = playlist(source.id);
  if (!details) return null;
  if (details.kind === 'smart') {
    return { name: details.name, ids: smartListTracks(library, details.rules, stats?.()).map((track) => track.id) };
  }
  if (details.tag) {
    const tagged = new Set(trackIdsWithTag(details.tag));
    return { name: details.name, ids: library.filter((track) => tagged.has(track.id)).map((track) => track.id) };
  }
  return { name: details.name, ids: playlistTrackIds(source.id) };
}

/** What has been listened to, read the first time a smart list asks and kept for the rest: for {@link listMemberIds} over many lists. */
export function statsOnce(): () => SmartStats {
  let read: SmartStats | null = null;
  return () => (read ??= readSmartStats());
}
