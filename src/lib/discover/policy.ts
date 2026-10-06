import { foldForMatch } from '../metadata/text.ts';
import { splitCredit } from '../metadata/credit.ts';

export const DAY = 86_400_000;
export type DiscoverSettings = { count: number; refreshDays: number; autoDownload: boolean; wifiOnly: boolean };
/**
 * How Discover starts out: it does nothing nobody asked for.
 *
 * The list is refreshed when somebody presses refresh, and a song is fetched
 * when somebody taps it. Refreshing on a schedule and downloading ahead are
 * there to be switched on; a fresh install should not start using the network
 * and the storage for songs nobody has chosen yet.
 */
export const DEFAULT_SETTINGS: DiscoverSettings = { count: 20, refreshDays: 0, autoDownload: false, wifiOnly: true };
export function settingsFrom(value: unknown): DiscoverSettings {
  const v = (value ?? {}) as Partial<DiscoverSettings>;
  return {
    count: [10, 20, 30, 40].includes(v.count!) ? v.count! : DEFAULT_SETTINGS.count,
    refreshDays: [0, 1, 3, 7, 14, 30].includes(v.refreshDays!) ? v.refreshDays! : DEFAULT_SETTINGS.refreshDays,
    autoDownload: typeof v.autoDownload === 'boolean' ? v.autoDownload : DEFAULT_SETTINGS.autoDownload,
    wifiOnly: typeof v.wifiOnly === 'boolean' ? v.wifiOnly : DEFAULT_SETTINGS.wifiOnly,
  };
}
export function songKey(song: { title: string; artist?: string | null }): string {
  return `${foldForMatch(song.artist ?? '')}|${foldForMatch(song.title)}`;
}
/**
 * What somebody listens to, as tags: which ones, how much each, and which go together.
 *
 * The pairs are the point. `rock` on its own is half the catalogue and says
 * nothing about anybody; `rock` together with `j-pop`, because that is what
 * the songs actually played are tagged, is a taste. So a pair is counted when
 * both tags are on the same song, and searching for the two at once finds
 * artists who are both rather than the most famous name under either.
 *
 * Each item is a song's tags, best first, and how much it was listened to.
 * Only its first four count: past that a tag describes the song less than it
 * describes whoever tagged it.
 */
export type TagMix = { tags: string[]; weights: Map<string, number>; pairs: [string, string][] };
export function tagMix(items: Iterable<[tags: string[], gain: number]>): TagMix {
  const single = new Map<string, number>(), together = new Map<string, number>();
  for (const [all, gain] of items) {
    if (!(gain > 0)) continue;
    const tags = [...new Set(all)].slice(0, 4);
    tags.forEach((tag, index) => {
      single.set(tag, (single.get(tag) ?? 0) + gain);
      for (const other of tags.slice(index + 1)) {
        const key = [tag, other].sort().join('\n');
        together.set(key, (together.get(key) ?? 0) + gain);
      }
    });
  }
  const byWeight = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
  const ordered = [...single].sort(byWeight);
  const top = ordered[0]?.[1] ?? 1;
  return {
    tags: ordered.slice(0, 4).map(([tag]) => tag),
    // As a share of the most listened-to tag, so one means "as much as anything".
    weights: new Map(ordered.map(([tag, weight]) => [tag, weight / top])),
    pairs: [...together].sort(byWeight).slice(0, 3).map(([key]) => key.split('\n') as [string, string]),
  };
}
/**
 * How well a song's tags sit in that mix, from nought to three.
 *
 * Every tag listened to counts for its share, so a song tagged with three
 * things played a little outranks one tagged with a single favourite. Capped,
 * or a song somebody tagged with everything would win every time.
 */
export function tagFit(tags: string[], weights: Map<string, number>): number {
  let fit = 0;
  for (const tag of new Set(tags)) fit += weights.get(tag) ?? 0;
  return Math.min(3, fit);
}
export type Listen = { track_id: string; artist: string | null; started_at: number; seconds_played: number; completed: number };
export type Skip = { artist: string | null; started_at: number; seconds_played: number; duration_sec: number | null };
export function tasteProfile(plays: Listen[], skips: Skip[], tags: Map<string, string[]>, now: number) {
  const artists = new Map<string, { name: string; score: number }>();
  const tagged: [string[], number][] = [];
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
    tagged.push([tags.get(play.track_id) ?? [], gain]);
  }
  for (const skip of skips.filter(s => recent(s.started_at) && s.seconds_played < Math.min(30, (s.duration_sec || 120) * .25))) {
    for (const name of splitCredit(skip.artist)) {
      const prev = artists.get(foldForMatch(name));
      if (prev) prev.score = Math.max(0, prev.score - 90 * decay(skip.started_at));
    }
  }
  return { artists: [...artists.values()].filter(a => a.score > 0).sort((a,b) => b.score-a.score), ...tagMix(tagged) };
}

/**
 * What a song is told when nobody has put its studio recording up to be found.
 *
 * Kept as a constant because it is also how such a song is recognised later:
 * it does not get to keep its place and be tried again, it is taken out and
 * the next best song has the place instead. The second wording is the one
 * lists saved before that rule still carry.
 */
export const NO_MATCH = 'No matching studio recording was found. Another song is taking its place.';
const NO_MATCH_BEFORE = 'A matching studio recording could not be found.';
export function isNoMatch(error: string | undefined | null): boolean {
  return !!error && (error === NO_MATCH || error.startsWith(NO_MATCH_BEFORE));
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
