import { db, readSetting, writeSetting } from './index';
import { createPlaylist, playlist, playlistTrackIds } from './playlists';
import { reconcilePlaylist, type ImportedItem } from '../youtube/playlistSync';
import type { DownloadJob, YouTubeVideo } from '../youtube/types';

const KEY = 'youtube:playlist-imports:v1';
type Import = { sourceId: string; playlistId: number; items: ImportedItem[] };
const read = (): Import[] => JSON.parse(readSetting(KEY) ?? '[]');

/**
 * Save intent before enqueueing so background completion survives app restarts.
 *
 * [owned] are the videos the library already has a file of, by track
 * (`youtube/owned.ts`): they are not fetched again, and go into the list
 * now, in their places, as the others will when they arrive.
 */
export function registerYouTubePlaylist(videos: YouTubeVideo[], owned: ReadonlyMap<string, string> = new Map()): void {
  const source = videos[0]?.sourcePlaylist;
  if (!source) return;
  db().withTransactionSync(() => {
    const imports = read();
    let entry = imports.find((item) => item.sourceId === source.id);
    if (!entry || !playlist(entry.playlistId)) {
      const fresh = { sourceId: source.id, playlistId: createPlaylist(source.name, Date.now()), items: [] };
      if (entry) imports.splice(imports.indexOf(entry), 1, fresh);
      else imports.push(fresh);
      entry = fresh;
    }
    const known = new Set(entry.items.map((item) => item.videoId));
    for (const video of videos) {
      if (!known.has(video.id)) { entry.items.push({ videoId: video.id }); known.add(video.id); }
    }
    writeSetting(KEY, JSON.stringify(imports));
  });
  if (owned.size > 0) {
    // Put in as if fetched: a finished job of each is all the list needs to place it.
    syncYouTubePlaylists(
      [...owned].map(([videoId, trackId]) => ({ status: 'done', trackId, video: { id: videoId } }) as unknown as DownloadJob)
    );
  }
}

export function syncYouTubePlaylists(jobs: DownloadJob[]): boolean {
  let changed = false;
  const database = db();
  database.withTransactionSync(() => {
    const imports = read();
    for (const entry of imports) {
      // A deleted list stays deleted until the user explicitly downloads it again.
      if (!playlist(entry.playlistId)) continue;
      const update = reconcilePlaylist(entry.items, playlistTrackIds(entry.playlistId), jobs);
      if (!update.changed) continue;
      const at = Date.now();
      update.order.forEach((trackId, position) => database.runSync(
        `INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(playlist_id, track_id) DO UPDATE SET position = excluded.position`,
        entry.playlistId, trackId, position, at));
      database.runSync('UPDATE playlists SET updated_at = ? WHERE id = ?', at, entry.playlistId);
      entry.items = update.receipts;
      changed = true;
    }
    if (changed) writeSetting(KEY, JSON.stringify(imports));
  });
  return changed;
}
