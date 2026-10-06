import { db, readSetting, writeSetting } from '../db/index.ts';
import type { Discovery } from '../db/discover.ts';
import type { Track } from '../types.ts';
import { DAY, settingsFrom, songKey, type DiscoverSettings } from './policy.ts';
export type Entry = Discovery & { familiar: boolean; score: number; tags?: string[]; durationSec?: number | null; jobId?: string; track?: Track; error?: string };
export type Snapshot = { entries: Entry[]; pool: Entry[]; refreshedAt: number; retired: string[]; pending?: Entry[]; pendingRejected?: string[] };
export function readDiscoverSettings(): DiscoverSettings {
  try { return settingsFrom(JSON.parse(readSetting('discover:settings') ?? '{}')); } catch { return settingsFrom(null); }
}
export function saveDiscoverSettings(value: DiscoverSettings) { writeSetting('discover:settings', JSON.stringify(settingsFrom(value))); }
export function readSnapshot(): Snapshot {
  const row = db().getFirstSync<{ data: string }>('SELECT data FROM discover_state WHERE id = ?', 'current');
  try { if (row) return JSON.parse(row.data); } catch { /* recover with a new batch */ }
  return { entries: [], pool: [], refreshedAt: 0, retired: [] };
}
export function saveSnapshot(value: Snapshot) {
  db().runSync('INSERT INTO discover_state (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', 'current', JSON.stringify(value));
}
/** How long a song stays out: for good if it was saved or blocked, a season if it was shown, a month if it could not be found. */
const AWAY_DAYS = { blocked: null, saved: null, expired: 90, unmatched: 30 } as const;
export function exclude(entry: Entry, reason: keyof typeof AWAY_DAYS, now = Date.now()) {
  db().runSync(`INSERT INTO discover_exclusions (id,song_key,title,artist,reason,until_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET reason=excluded.reason,until_at=excluded.until_at`,
  entry.recordingMbid, songKey(entry), entry.title, entry.artist, reason, AWAY_DAYS[reason] == null ? null : now + AWAY_DAYS[reason] * DAY);
}
export function exclusions(now = Date.now()): Set<string> {
  const rows = db().getAllSync<{ id: string; song_key: string }>('SELECT id,song_key FROM discover_exclusions WHERE until_at IS NULL OR until_at > ?', now);
  return new Set(rows.flatMap(r => [r.id, r.song_key]));
}
export function blockedSongs() {
  return db().getAllSync<{ id: string; title: string; artist: string }>("SELECT id,title,artist FROM discover_exclusions WHERE reason = 'blocked'");
}
export function unblock(id: string) { db().runSync("DELETE FROM discover_exclusions WHERE id = ? AND reason = 'blocked'", id); }
