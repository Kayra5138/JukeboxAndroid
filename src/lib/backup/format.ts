/**
 * What a backup is, and how one is read back in.
 *
 * A backup is everything the app has been told or has learned that could not
 * be worked out again: what was listened to, the lists, the tags and lyrics
 * and what was corrected in them, and the settings. It is not the music, and it
 * is not anything that can be fetched or computed a second time -- charts,
 * caches, artist photographs, translation models.
 *
 * Written as plain JSON, a table at a time, rather than as a copy of the
 * database file. A copy would be quicker to make and no use for the two things
 * a backup is for: it could not be merged into a phone that already has a
 * history, and it could not be carried to another phone, where every song has
 * a different id.
 */

/** Bumped when a backup written by this version could mislead an older one. */
export const BACKUP_FORMAT = 1;

/** The name of the document inside the archive. */
export const BACKUP_FILE = 'jukebox-backup.json';

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

/**
 * The tables that are carried, and the columns of each.
 *
 * Written out rather than read from the database, because this is the format:
 * a column added to the schema later is not thereby added to old backups, and
 * what an import is prepared to believe should be a list somebody can read.
 *
 * `T` is text, `I` a whole number, `R` a number; `!` means the row is no use
 * without it and is dropped if it is missing.
 */
export const TABLES = {
  plays: {
    track_id: 'T!',
    title: 'T!',
    artist: 'T',
    filename: 'T',
    started_at: 'I!',
    seconds_played: 'R!',
    completed: 'I!',
  },
  skips: {
    track_id: 'T!',
    title: 'T!',
    artist: 'T',
    started_at: 'I!',
    seconds_played: 'R!',
    duration_sec: 'R!',
  },
  track_metadata: {
    track_id: 'T!',
    status: 'T!',
    source: 'T',
    title: 'T',
    artist: 'T',
    album: 'T',
    genre: 'T',
    year: 'I',
    artwork_url: 'T',
    fetched_at: 'I!',
    track_number: 'I',
    disc_number: 'I',
  },
  track_tags: { track_id: 'T!', tag: 'T!', position: 'I!', source: 'T!' },
  track_lyrics: {
    track_id: 'T!',
    plain: 'T',
    synced: 'T',
    fetched_at: 'I!',
    unreachable_at: 'I',
    source: 'T',
    offset_ms: 'I!',
  },
  lyric_translations: {
    track_id: 'T!',
    target: 'T!',
    source: 'T',
    lines: 'T!',
    translated_at: 'I!',
  },
  playlists: {
    id: 'I!',
    name: 'T!',
    created_at: 'I!',
    updated_at: 'I!',
    cover_track_id: 'T',
    cover_uri: 'T',
    tag: 'T',
  },
  playlist_tracks: { playlist_id: 'I!', track_id: 'T!', position: 'I!', added_at: 'I!' },
} as const;

export type TableName = keyof typeof TABLES;
export type Tables = Record<TableName, Row[]>;

export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

/** What a required column is given when a backup from before it existed lacks it. */
const DEFAULTS: Partial<Record<TableName, Row>> = {
  track_lyrics: { offset_ms: 0 },
};

/**
 * Settings that describe this phone rather than the person using it, and so
 * stay behind.
 *
 * The library folder is a path on this phone's storage. The other is the record
 * of which downloaded playlists feed which lists, which is download history by
 * another name and points at list ids that will not survive the journey.
 */
export function carried(key: string): boolean {
  return key !== 'library:root' && !key.startsWith('youtube:');
}

/** Enough about a song to find it again somewhere its id means nothing. */
export type BackupTrack = {
  id: string;
  filename: string | null;
  folder: string | null;
  title: string | null;
  artist: string | null;
  durationSec: number | null;
};

export type Backup = {
  format: number;
  /** The version of the app that wrote it, for a person reading the file. */
  app: string;
  exportedAt: number;
  tracks: BackupTrack[];
  settings: Record<string, string>;
  /** The player's own settings, kept as the player gave them. */
  sound: { effects?: unknown; transitions?: unknown; equalizer?: unknown };
  tables: Tables;
};

export function emptyTables(): Tables {
  const tables = {} as Tables;
  for (const name of TABLE_NAMES) tables[name] = [];
  return tables;
}

/** A backup that will not be read, with the reason in words a person can use. */
export class BackupError extends Error {}

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * One row, with only the columns the format names and each of the right kind,
 * or null if something it cannot do without is missing.
 */
function cleanRow(table: TableName, raw: unknown): Row | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const row: Row = {};
  for (const [column, kind] of Object.entries(TABLES[table])) {
    let value: Cell;
    if (kind.startsWith('T')) value = text(source[column]);
    else {
      const read = number(source[column]);
      value = read == null ? null : kind.startsWith('I') ? Math.trunc(read) : read;
    }
    if (value == null) value = DEFAULTS[table]?.[column] ?? null;
    if (value == null && kind.endsWith('!')) return null;
    row[column] = value;
  }
  return row;
}

/**
 * A backup, from the text of one.
 *
 * Nothing in the file is trusted to be the shape it should be. It may have been
 * written by a different version, edited by hand, or handed over by somebody
 * else entirely, and every value in it is on its way into the database: so each
 * row is rebuilt from the columns this version knows, each value is checked for
 * its kind, and a row that cannot be made whole is left out rather than
 * guessed at. Unknown tables and columns are ignored, which is what lets a
 * later version add some without breaking this one.
 */
export function parseBackup(json: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupError('That file is not a Jukebox backup.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BackupError('That file is not a Jukebox backup.');
  }
  const source = raw as Record<string, unknown>;
  const format = number(source.format);
  if (format == null || !source.tables || typeof source.tables !== 'object') {
    throw new BackupError('That file is not a Jukebox backup.');
  }
  if (format > BACKUP_FORMAT) {
    throw new BackupError('That backup was made by a newer Jukebox. Update the app to read it.');
  }

  const given = source.tables as Record<string, unknown>;
  const tables = emptyTables();
  for (const name of TABLE_NAMES) {
    const rows = Array.isArray(given[name]) ? (given[name] as unknown[]) : [];
    for (const each of rows) {
      const row = cleanRow(name, each);
      if (row) tables[name].push(row);
    }
  }

  const tracks: BackupTrack[] = [];
  for (const each of Array.isArray(source.tracks) ? source.tracks : []) {
    if (!each || typeof each !== 'object') continue;
    const track = each as Record<string, unknown>;
    const id = text(track.id);
    if (!id) continue;
    tracks.push({
      id,
      filename: text(track.filename),
      folder: text(track.folder),
      title: text(track.title),
      artist: text(track.artist),
      durationSec: number(track.durationSec),
    });
  }

  const settings: Record<string, string> = {};
  if (source.settings && typeof source.settings === 'object' && !Array.isArray(source.settings)) {
    for (const [key, value] of Object.entries(source.settings as Record<string, unknown>)) {
      if (typeof value === 'string' && carried(key)) settings[key] = value;
    }
  }

  const sound =
    source.sound && typeof source.sound === 'object' && !Array.isArray(source.sound)
      ? (source.sound as Backup['sound'])
      : {};

  return {
    format,
    app: text(source.app) ?? '',
    exportedAt: number(source.exportedAt) ?? 0,
    tracks,
    settings,
    sound,
    tables,
  };
}
