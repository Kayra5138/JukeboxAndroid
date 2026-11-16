import { autoListTrackIds, type AutoListId } from '../db/autoLists.ts';
import { playlist, playlistTrackIds } from '../db/playlists.ts';
import { trackIdsWithTag } from '../db/tags.ts';
import type { SmartTrack } from './smart.ts';
import { smartListTracks } from './smartLive.ts';

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
  library: readonly T[]
): { name: string; ids: string[] } | null {
  if (source.kind === 'auto') return { name: source.name, ids: autoListTrackIds(source.id, Date.now()) };
  const details = playlist(source.id);
  if (!details) return null;
  if (details.kind === 'smart') {
    return { name: details.name, ids: smartListTracks(library, details.rules).map((track) => track.id) };
  }
  if (details.tag) {
    const tagged = new Set(trackIdsWithTag(details.tag));
    return { name: details.name, ids: library.filter((track) => tagged.has(track.id)).map((track) => track.id) };
  }
  return { name: details.name, ids: playlistTrackIds(source.id) };
}
