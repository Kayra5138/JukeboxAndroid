import { libraryRoot } from '../media/library.ts';
import { folderKey } from '../media/folders.ts';
import { tapeFolderOf } from '../tapes/folders.ts';
import { subscriptions, type Subscription } from './store.ts';

/**
 * Which followed podcast a tape is an episode of: the one whose folder of the
 * Tapes folder it is in, which is where every episode of it is put, whether
 * fetched by itself or by hand, and before it was followed too.
 */
export function seriesFolderOf(show: Pick<Subscription, 'title'> & { folder?: string }, root = libraryRoot()): string {
  return folderKey(tapeFolderOf(root, show.folder ?? show.title)).toLocaleLowerCase();
}

/** The followed podcasts, by the folder their episodes are in. */
export function seriesByFolder(followed: readonly Subscription[] = subscriptions()): Map<string, Subscription> {
  const root = libraryRoot();
  return new Map(followed.map((show) => [seriesFolderOf(show, root), show]));
}

/** The followed podcast [track] is an episode of, or null. */
export function seriesOf(track: { folder?: string | null }, followed?: ReadonlyMap<string, Subscription>): Subscription | null {
  const key = folderKey(track.folder ?? '').toLocaleLowerCase();
  if (!key) return null;
  return (followed ?? seriesByFolder()).get(key) ?? null;
}
