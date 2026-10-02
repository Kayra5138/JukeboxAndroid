import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrations.ts';

let database: SQLiteDatabase | null = null;

/**
 * Opened lazily and kept for the life of the process.
 *
 * Opening it costs a schema check and, once, a migration, so the first caller
 * pays for all of them. Nothing should make that first caller a render: the
 * player provider reads its settings from an effect for exactly this reason.
 */
export function db(): SQLiteDatabase {
  if (database) return database;
  const opened = openDatabaseSync('jukebox.db');
  try {
    opened.execSync('PRAGMA journal_mode = WAL');
    migrate(opened);
  } catch (error) {
    // expo-sqlite hands back the same native connection for a path until it is
    // closed, so simply not keeping the reference would not undo anything: the
    // retry would land on this very handle, and it would still be holding the
    // file open and its write lock with it. Closing is what makes the next call
    // a genuinely fresh attempt.
    try {
      opened.closeSync();
    } catch {
      // Whatever went wrong closing, the migration failure is the one that
      // explains the state the user is in, so that is the one that propagates.
    }
    throw error;
  }
  database = opened;
  return database;
}

export function readSetting(key: string): string | null {
  const row = db().getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export function writeSetting(key: string, value: string): void {
  db().runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export const SETTINGS = {
  /**
   * Media store relative path the library is read from, without a trailing
   * slash. A setting rather than a constant because `Music` is often a mixed
   * bag — ringtones, game audio, voice memos — while the actual collection sits
   * in one folder below it.
   */
  libraryRoot: 'library:root',
  /** `'true'` when playback order is shuffled. */
  shuffle: 'player:shuffle',
  /** One of `'off' | 'one' | 'all'`. */
  repeat: 'player:repeat',
  /** Which stretch of history the stats screen opens on. */
  statsPeriod: 'stats:period',
  /** `'albums'` when the library is being browsed by record rather than track. */
  libraryView: 'library:view',
  /**
   * One of `'name' | 'added' | 'played'` — see `media/sort.ts`.
   *
   * Kept for the library as a whole rather than per view. Tracks and records are
   * two ways of looking at one collection, and somebody who has said they want
   * to see what is new has said it about the collection, not about the shape it
   * happens to be drawn in.
   */
  librarySort: 'library:sort',
  /**
   * `'true'` when records are browsed as a rack rather than as a list.
   *
   * Only a question sideways. The rack is records turned about a vertical axis
   * and seen from the side; upright the same shape has to stack instead, which
   * reads as a pile of slabs rather than a shelf, so there is no rack to offer
   * and the key is read only when the phone is on its side.
   */
  coverFlow: 'library:coverFlow:landscape',
  /**
   * `'true'` when the decoration should hold still.
   *
   * For a phone that cannot afford it. Everything this turns off is something
   * that was added to make a moment legible — the player rising rather than
   * appearing, a life swelling as it comes back, the board washed in colour
   * when one is lost — and on hardware that drops frames doing it, the moment
   * is less legible with the animation than without.
   *
   * Off by default, because most phones manage and the decoration is doing a
   * job. It is deliberately not tied to the system's own reduce-motion switch:
   * that one is an accessibility preference about vestibular discomfort, and
   * someone who turns it on has not thereby asked a game to look plainer.
   */
  reduceMotion: 'ui:reduceMotion',
  /**
   * How late the sound is by the time it is heard, in milliseconds.
   *
   * Only the tiles game reads it, but what it describes belongs to the
   * listener's output rather than to the game: a Bluetooth speaker runs a
   * fifth of a second behind whatever is feeding it, and that is as true of
   * the next thing that has to line up with the ear as it is of this one.
   */
  tilesOffsetMs: 'tiles:offsetMs',
  /** One of the ids in `lib/tiles/game.ts`, so the last choice is offered first. */
  tilesDifficulty: 'tiles:difficulty',
  /**
   * How far the player's two jump buttons move, in seconds.
   *
   * Settable because the right step belongs to what is being listened to
   * rather than to the player. Ten seconds is a line of a song and most of a
   * spoken sentence; it is also nothing at all in a half-hour mix, where the
   * thing being looked for is a minute away.
   */
  jumpSeconds: 'player:jumpSeconds',
} as const;
