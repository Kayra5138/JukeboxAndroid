import { db, readSetting, writeSetting } from '../db/index.ts';
import { migrated } from './before.ts';
import { EMPTY, type AwayReason, type Kept, type Song } from './core.ts';
import { DAY, settingsFrom, songKey, type DiscoverSettings } from './policy.ts';

/**
 * Where Discover's list is written down, and the songs that are kept away.
 *
 * The list and the pool it was drawn from are kept apart. They used to be
 * one piece of JSON, written whole whenever anything about either changed,
 * and something changed about once a second while a song was downloading:
 * the pool is every song the catalogue came back with, several hundred of
 * them, and all of it was put into words and written to the database each
 * time, on the thread that draws the screen. The pool changes when the
 * catalogue is asked, which is every few days. So it has a row of its own,
 * written then; the list has another, a few kilobytes, written when the list
 * is a different list. Whoever writes says which of the two changed.
 *
 * Both rows are in `discover_state`, which has always been a name and a
 * piece of text, so nothing about the database had to change for it.
 */

export type { Entry } from './before.ts';

export function readDiscoverSettings(): DiscoverSettings {
  try {
    return settingsFrom(JSON.parse(readSetting('discover:settings') ?? '{}'));
  } catch {
    return settingsFrom(null);
  }
}

export function saveDiscoverSettings(value: DiscoverSettings): void {
  writeSetting('discover:settings', JSON.stringify(settingsFrom(value)));
}

const LIST = 'list';
const POOL = 'pool';
/** The one row everything was in before. Read once, written out as the two, and removed. */
const BEFORE = 'current';

type ListRow = Omit<Kept, 'pool'> & { version: 2 };

function row(id: string): unknown {
  const found = db().getFirstSync<{ data: string }>('SELECT data FROM discover_state WHERE id = ?', id);
  if (!found) return null;
  try {
    return JSON.parse(found.data);
  } catch {
    // Unreadable is the same as not there: the list is made again.
    return null;
  }
}

function write(id: string, value: unknown): void {
  db().runSync(
    'INSERT INTO discover_state (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
    id,
    JSON.stringify(value)
  );
}

/** What was written down, or nothing at all on a phone Discover has never run on. */
export function readKept(): Kept {
  const list = row(LIST) as ListRow | null;
  if (list && Array.isArray(list.list)) {
    const pool = row(POOL);
    return {
      list: list.list,
      staged: list.staged ?? null,
      refreshedAt: list.refreshedAt ?? 0,
      retired: list.retired ?? [],
      attemptAt: list.attemptAt ?? 0,
      problem: list.problem ?? null,
      fruitlessAt: list.fruitlessAt ?? 0,
      pool: Array.isArray(pool) ? (pool as Song[]) : [],
    };
  }
  const before = row(BEFORE);
  if (!before) return EMPTY;
  const kept = migrated(before, Date.now());
  db().withTransactionSync(() => {
    saveList(kept);
    savePool(kept.pool);
    db().runSync('DELETE FROM discover_state WHERE id = ?', BEFORE);
  });
  return kept;
}

export function saveList(kept: Omit<Kept, 'pool'>): void {
  const value: ListRow = {
    version: 2,
    list: kept.list,
    staged: kept.staged,
    refreshedAt: kept.refreshedAt,
    retired: kept.retired,
    attemptAt: kept.attemptAt,
    problem: kept.problem,
    fruitlessAt: kept.fruitlessAt,
  };
  write(LIST, value);
}

export function savePool(pool: readonly Song[]): void {
  write(POOL, pool);
}

/**
 * How long a song stays out, by why it was put away.
 *
 * For good if it was kept or sent away by name. A song that was on a list
 * and went with it stays out a season if it was heard — it had its hearing
 * and was not kept — and a fortnight if it never was: nobody turned it down,
 * it only happened to be on a list that was refreshed. A month if no
 * recording of it could be found, which is as long as it is worth before
 * looking again.
 *
 * `expired` is what a song that went with its list was filed under before
 * the two were told apart, and is still what such rows say.
 */
const AWAY_DAYS: Record<AwayReason | 'expired', number | null> = {
  blocked: null,
  saved: null,
  played: 90,
  unplayed: 14,
  expired: 90,
  unmatched: 30,
};

export function exclude(song: Song, reason: AwayReason, now = Date.now()): void {
  const days = AWAY_DAYS[reason];
  db().runSync(
    // Dated, so that what was said about an artist's songs can grow old: see `taste.ts`. Said again, it is said today.
    `INSERT INTO discover_exclusions (id,song_key,title,artist,reason,until_at,created_at) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET reason=excluded.reason,until_at=excluded.until_at,created_at=excluded.created_at`,
    song.recordingMbid,
    songKey(song),
    song.title,
    song.artist,
    reason,
    days == null ? null : now + days * DAY,
    Math.round(now)
  );
}

/** Everything that is being kept away now, by id and by name. An artist's row is in it too, under the names `taste.ts` gives it. */
export function exclusions(now = Date.now()): Set<string> {
  const rows = db().getAllSync<{ id: string; song_key: string }>(
    'SELECT id,song_key FROM discover_exclusions WHERE until_at IS NULL OR until_at > ?',
    now
  );
  return new Set(rows.flatMap((found) => [found.id, found.song_key]));
}

export function blockedSongs(): { id: string; title: string; artist: string }[] {
  return db().getAllSync<{ id: string; title: string; artist: string }>(
    "SELECT id,title,artist FROM discover_exclusions WHERE reason = 'blocked'"
  );
}

export function unblock(id: string): void {
  db().runSync("DELETE FROM discover_exclusions WHERE id = ? AND reason = 'blocked'", id);
}
