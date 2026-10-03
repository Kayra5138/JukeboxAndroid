import { foldForMatch } from '../metadata/text.ts';
import { splitCredit } from '../metadata/credit.ts';

export const DAY = 86_400_000;
export type DiscoverSettings = { count: number; refreshDays: number; autoDownload: boolean; wifiOnly: boolean };
export const DEFAULT_SETTINGS: DiscoverSettings = { count: 20, refreshDays: 7, autoDownload: true, wifiOnly: true };
export function settingsFrom(value: unknown): DiscoverSettings {
  const v = (value ?? {}) as Partial<DiscoverSettings>;
  return {
    count: [10, 20, 30, 40].includes(v.count!) ? v.count! : 20,
    refreshDays: [0, 1, 3, 7, 14, 30].includes(v.refreshDays!) ? v.refreshDays! : 7,
    autoDownload: typeof v.autoDownload === 'boolean' ? v.autoDownload : true,
    wifiOnly: typeof v.wifiOnly === 'boolean' ? v.wifiOnly : true,
  };
}
export function songKey(song: { title: string; artist?: string | null }): string {
  return `${foldForMatch(song.artist ?? '')}|${foldForMatch(song.title)}`;
}
export type Listen = { track_id: string; artist: string | null; started_at: number; seconds_played: number; completed: number };
export type Skip = { artist: string | null; started_at: number; seconds_played: number; duration_sec: number | null };
export function tasteProfile(plays: Listen[], skips: Skip[], tags: Map<string, string[]>, now: number) {
  const artists = new Map<string, { name: string; score: number }>();
  const genres = new Map<string, number>();
  const recent = (at: number) => at >= now - 30 * DAY && at <= now;
  const decay = (at: number) => Math.pow(0.5, (now - at) / (14 * DAY));
  for (const play of plays.filter(p => recent(p.started_at))) {
    // Cap one session so an overnight loop cannot dictate the whole profile.
    const gain = Math.min(600, Math.max(0, play.seconds_played)) * decay(play.started_at) * (play.completed ? 1.25 : 1);
    const names = splitCredit(play.artist);
    for (const name of names) {
      const key = foldForMatch(name);
      const prev = artists.get(key);
      artists.set(key, { name: prev?.name ?? name, score: (prev?.score ?? 0) + gain / names.length });
    }
    for (const tag of tags.get(play.track_id) ?? []) genres.set(tag, (genres.get(tag) ?? 0) + gain);
  }
  for (const skip of skips.filter(s => recent(s.started_at) && s.seconds_played < Math.min(30, (s.duration_sec || 120) * .25))) {
    for (const name of splitCredit(skip.artist)) {
      const prev = artists.get(foldForMatch(name));
      if (prev) prev.score = Math.max(0, prev.score - 90 * decay(skip.started_at));
    }
  }
  return { artists: [...artists.values()].filter(a => a.score > 0).sort((a,b) => b.score-a.score),
    tags: [...genres].sort((a,b) => b[1]-a[1]).slice(0, 4).map(([tag]) => tag) };
}

export type RankedSong = { recordingMbid: string; title: string; artist: string; artistMbid: string; familiar: boolean; score: number };
/** Strict half-and-half quotas; unfilled places remain visible rather than silently changing the mix. */
export function selectSongs<T extends RankedSong>(pool: T[], retained: T[], count: number, excluded: Set<string>): T[] {
  const picked = retained.slice(0, count);
  const ids = new Set(picked.map(p => p.recordingMbid));
  const keys = new Set(picked.map(songKey));
  const artists = new Map<string, number>();
  picked.forEach(p => artists.set(p.artistMbid, (artists.get(p.artistMbid) ?? 0) + 1));
  const candidates = [...pool].sort((a,b) => b.score-a.score || a.recordingMbid.localeCompare(b.recordingMbid));
  for (const familiar of [true, false]) {
    const quota = familiar ? Math.floor(count / 2) : Math.ceil(count / 2);
    // Prefer at most two songs per artist; relax only within the deficient half.
    for (const cap of [2, count]) {
      for (const song of candidates) {
        if (picked.filter(p => p.familiar === familiar).length >= quota) break;
        const key = songKey(song);
        if (song.familiar !== familiar || ids.has(song.recordingMbid) || keys.has(key) ||
            excluded.has(song.recordingMbid) || excluded.has(key) || (artists.get(song.artistMbid) ?? 0) >= cap) continue;
        picked.push(song); ids.add(song.recordingMbid); keys.add(key);
        artists.set(song.artistMbid, (artists.get(song.artistMbid) ?? 0) + 1);
      }
    }
  }
  // Interleave the two halves rather than presenting ten familiar artists first.
  const familiar = picked.filter(p => p.familiar), novel = picked.filter(p => !p.familiar);
  return Array.from({ length: Math.max(familiar.length, novel.length) }, (_, i) => [familiar[i], novel[i]])
    .flat().filter((p): p is T => !!p);
}

/** A staged refresh may replace the old list only when its whole target is playable. */
export function batchReady(entries: { track?: unknown }[] | undefined, count: number): boolean {
  return !!entries && entries.length >= count && entries.every(e => !!e.track);
}
/** Reused jobs belong to the new batch; an earlier retirement mark must never delete them. */
export function retirementIds(retired: string[], jobs: { id: string }[], liveIds: (string | undefined)[]): string[] {
  const live = new Set(liveIds);
  return [...new Set([...retired, ...jobs.map(j => j.id)])].filter(id => !live.has(id));
}
