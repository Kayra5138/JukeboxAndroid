import { strings, type Strings } from '../i18n/languages.ts';

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
  discover_exclusions: {
    id: 'T!', song_key: 'T!', title: 'T!', artist: 'T!', reason: 'T!', until_at: 'I',
    // When it was put away. Later than the rest: a backup from before it has
    // rows without, which are read as rows of no known date.
    created_at: 'I',
  },
  plays: {
    track_id: 'T!',
    title: 'T!',
    artist: 'T',
    filename: 'T',
    started_at: 'I!',
    seconds_played: 'R!',
    completed: 'I!',
    // Where a listen brought in from another app was heard. Absent from a
    // backup made before there could be such listens: every one heard here.
    source: 'T',
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
    // Absent from a backup made before it existed, which reads as never
    // searched: the cover is looked for once more and that is all.
    cover_searched_at: 'I',
    // Both absent from a backup made before they existed: a record whose
    // artist nobody had said, and no cover taken off by hand.
    album_artist: 'T',
    cover_removed_at: 'I',
    // Absent from a backup made before they existed: a song with one name, until it is looked up again.
    latin_title: 'T',
    latin_artist: 'T',
    native_title: 'T',
    native_artist: 'T',
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
    kind: 'T',
    /** A smart list's rules, which name tags and artists rather than songs, and so travel as they are. */
    rules: 'T',
  },
  playlist_tracks: { playlist_id: 'I!', track_id: 'T!', position: 'I!', added_at: 'I!' },
  // Both later than the rest, and absent from a backup made before them.
  /** The podcasts and channels followed, and how each is fetched; not their episodes, which their feeds give again. */
  podcasts: {
    feed_url: 'T!',
    title: 'T!',
    author: 'T',
    image: 'T',
    summary: 'T',
    subscribed_at: 'I!',
    checked_at: 'I',
    auto_download: 'I!',
    keep: 'I!',
    fetch_next: 'I!',
    next_count: 'I!',
    folder: 'T',
  },
  /** The places marked in tapes, each with what was noted of it. */
  tape_marks: { track_id: 'T!', position_sec: 'R!', note: 'T', created_at: 'I!' },
  /** What is set aside (`library/setAside.ts`): a song by its id, the rest by what they are. Absent from a backup made before it. */
  set_aside: { kind: 'T!', key: 'T!', added_at: 'I!' },
} as const;

export type TableName = keyof typeof TABLES;
export type Tables = Record<TableName, Row[]>;

export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

/** What a required column is given when a backup from before it existed lacks it. */
const DEFAULTS: Partial<Record<TableName, Row>> = {
  track_lyrics: { offset_ms: 0 },
  // As the database has them for a show followed before each was asked.
  podcasts: { auto_download: 1, keep: 3, fetch_next: 0, next_count: 3 },
};

/**
 * Settings that describe this phone rather than the person using it, and so
 * stay behind.
 *
 * The library folder is a path on this phone's storage. The second is the
 * record of which downloaded playlists feed which lists, which is download
 * history by another name and points at list ids that will not survive the
 * journey.
 *
 * The third is the connection to ListenBrainz, and the reason is a different
 * one: among those keys is the user's token, which is a password in all but
 * name, and a backup is a file that gets left in a downloads folder and sent
 * to people. The whole group stays rather than the token alone, because the
 * rest of it -- sending switched on, since when -- means nothing without a
 * token and would arrive on another phone as a switch that is on and does
 * nothing. It is ignored on the way in for the same reason it is left out on
 * the way out: a file is not what decides where somebody's listens are sent.
 *
 * The last two are this phone's own log of what went wrong and what it last
 * heard of a newer version (see `support/`): brought to another phone, a
 * bug report from there would describe failures that never happened on it.
 * The switch for asking about new versions is a preference, and travels.
 */
export function carried(key: string): boolean {
  return (
    key !== 'library:root' &&
    !key.startsWith('youtube:') &&
    !key.startsWith('listenbrainz:') &&
    !PHONE_SUPPORT_KEYS.includes(key)
  );
}

/**
 * `SETTINGS.errorLog`, `SETTINGS.updateKnown`, `SETTINGS.lyricsFolders`,
 * `SETTINGS.autoplayQueued` and `SETTINGS.setupSeen`, and the rest below, spelt out — the third
 * being folders this phone granted, the fourth a note about this phone's
 * queue, and the fifth which screens of the first start this phone has shown,
 * all meaningless on another (a phone a backup is brought to has shown its own
 * setup, or is about to): this file is read by tests that cannot open the
 * database.
 */
const PHONE_SUPPORT_KEYS: readonly string[] = [
  'support:errors',
  'support:updateKnown',
  'lyrics:folders',
  'player:autoplay:queued',
  'ui:setup',
  // Keyed by this phone's file and job ids, which mean nothing on another.
  'library:rightDownloads',
  'discover:wrongMended',
  // Automatic backup's folder is a grant this phone was given, and the switch
  // without it would arrive on another as one that is on and writes nowhere;
  // when the last was made, and how it went, are this phone's own record.
  // How often and how many to keep are preferences, and travel.
  'backup:auto',
  'backup:folder',
  'backup:last',
  'backup:trouble',
];

/**
 * Settings a backup that replaces everything still leaves alone.
 *
 * Replacing clears what the backup did not carry, on the grounds that it was
 * this phone's version of something being replaced. These are not that.
 * Where the music is kept is a fact about this phone, and so is the account it
 * was connected to: bringing in a history is not asking to be signed out. So
 * are its log of failures and what it last heard of a new version.
 */
export function staysThroughReplace(key: string): boolean {
  return key === 'library:root' || key.startsWith('listenbrainz:') || PHONE_SUPPORT_KEYS.includes(key);
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

/** Where a tape was left, as the player keeps it. */
export type TapePlace = { positionSec: number; durationSec: number; at: number; finished: boolean };

/**
 * What the player keeps of tapes rather than the database: where each was
 * left, by the song's id, and its switches — going back a little on being
 * played again, silences passed over, a clearer voice, a video's sponsors
 * passed over. How far the jump buttons go and each tape's speed are
 * settings, and travel as settings do.
 */
export type BackupTapes = {
  places: Record<string, TapePlace>;
  smartRewind?: boolean;
  flags?: Partial<Record<'skipSilence' | 'voiceClarity' | 'skipSponsors', boolean>>;
};

export type Backup = {
  format: number;
  /** The version of the app that wrote it, for a person reading the file. */
  app: string;
  exportedAt: number;
  tracks: BackupTrack[];
  settings: Record<string, string>;
  /** The player's own settings, kept as the player gave them. */
  sound: { effects?: unknown; transitions?: unknown; equalizer?: unknown; loudness?: unknown };
  /** Absent from a backup made before tapes were kept by it. */
  tapes?: BackupTapes;
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
export function parseBackup(json: string, t: Strings = strings()): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupError(t.backup.notABackup);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BackupError(t.backup.notABackup);
  }
  const source = raw as Record<string, unknown>;
  const format = number(source.format);
  if (format == null || !source.tables || typeof source.tables !== 'object') {
    throw new BackupError(t.backup.notABackup);
  }
  if (format > BACKUP_FORMAT) {
    throw new BackupError(t.backup.newer);
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
    tapes: tapesOf(source.tapes),
    tables,
  };
}

const FLAGS = ['skipSilence', 'voiceClarity', 'skipSponsors'] as const;

/** A backup's tapes, each place checked as a row is; nothing where it holds none. */
export function tapesOf(raw: unknown): BackupTapes | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const places: Record<string, TapePlace> = {};
  const given = source.places;
  if (given && typeof given === 'object' && !Array.isArray(given)) {
    for (const [id, each] of Object.entries(given as Record<string, unknown>)) {
      if (!id || !each || typeof each !== 'object') continue;
      const place = each as Record<string, unknown>;
      const positionSec = number(place.positionSec);
      const durationSec = number(place.durationSec);
      const at = number(place.at);
      if (positionSec == null || durationSec == null || at == null || positionSec < 0 || durationSec < 0) continue;
      places[id] = { positionSec, durationSec, at, finished: place.finished === true };
    }
  }
  const tapes: BackupTapes = { places };
  if (typeof source.smartRewind === 'boolean') tapes.smartRewind = source.smartRewind;
  const flags = source.flags;
  if (flags && typeof flags === 'object' && !Array.isArray(flags)) {
    for (const name of FLAGS) {
      const value = (flags as Record<string, unknown>)[name];
      if (typeof value === 'boolean') (tapes.flags ??= {})[name] = value;
    }
  }
  return tapes;
}
