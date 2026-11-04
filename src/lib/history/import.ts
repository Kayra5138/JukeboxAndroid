import { hash } from '../backup/apply.ts';
import { looseSongKey } from '../discover/variants.ts';
import { foldForMatch } from '../metadata/text.ts';

/**
 * Bringing in what was listened to in other apps.
 *
 * Somebody who comes to Jukebox from Spotify or Last.fm has years of
 * listening behind them, and every chart and suggestion here starts from
 * nothing without it. The services will hand that history over as files:
 *
 *  - Last.fm's scrobbles, as the exporters people use write them: a table of
 *    artist, album, track and date with no heading (the one most often
 *    linked to), or one with headings that name the columns, a Unix time
 *    among them.
 *  - Spotify's "Download your data": `StreamingHistory_music_*.json`, a list
 *    of `endTime`, `artistName`, `trackName` and `msPlayed`; and the extended
 *    history, `Streaming_History_Audio_*.json`, whose rows say when they
 *    ended to the second, how long they ran and whether they were skipped.
 *  - ListenBrainz's export, a list of listens or a file of them a line each.
 *
 * Each listen found becomes a row of the history like any heard here. This
 * file is all the deciding -- what a file says, which song in the library a
 * listen was of, what is already in the history -- with no database or file
 * in sight, so that every format can be checked against a sample of it.
 */

export type HistorySource = 'lastfm' | 'spotify' | 'listenbrainz';

/** A listen as another app's history gives it. */
export type ForeignListen = {
  title: string;
  artist: string | null;
  album: string | null;
  /** When it began, in milliseconds. */
  startedAt: number;
  /** How long it was heard for, where the history says. A scrobble does not. */
  secondsPlayed: number | null;
  /** Whether it was heard to the end, where the history says. */
  completed: boolean | null;
  source: HistorySource;
};

/** Shorter than this and it was not a listen: Spotify writes down every song touched on the way past. */
export const SHORTEST_LISTEN_SEC = 30;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const text = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const number = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return null;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A moment as these files write one, in milliseconds, or null.
 *
 * Every one of them is in UTC, whether or not it says so: Spotify's
 * `2023-04-01 13:45` and `2023-04-01T13:45:12Z`, Last.fm's `01 Apr 2023 13:45`,
 * and a count of seconds since 1970. Read by hand rather than by `Date.parse`,
 * which takes a time with no zone on it for local time in one engine and for
 * UTC in another.
 */
export function momentOf(value: unknown): number | null {
  const count = number(value);
  if (count != null) {
    // Seconds, unless it is too large to be: then it was milliseconds.
    if (count <= 0) return null;
    return count > 1e11 ? Math.round(count) : Math.round(count * 1000);
  }
  const said = text(value);
  if (!said) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(said);
  if (iso) {
    const [, year, month, day, hour, minute, second, fraction, zone] = iso;
    let at = Date.UTC(+year!, +month! - 1, +day!, +hour!, +minute!, +(second ?? 0), Math.round(Number(`0.${fraction ?? 0}`) * 1000));
    if (zone && zone.toUpperCase() !== 'Z') {
      const sign = zone[0] === '-' ? -1 : 1;
      const digits = zone.slice(1).replace(':', '');
      at -= sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2))) * 60_000;
    }
    return Number.isFinite(at) ? at : null;
  }

  const written = /^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(said);
  if (written) {
    const [, day, name, year, hour, minute, second] = written;
    const month = MONTHS.indexOf(name!.toLowerCase());
    if (month < 0) return null;
    return Date.UTC(+year!, month, +day!, +hour!, +minute!, +(second ?? 0));
  }
  return null;
}

/** A row of Spotify's own history: null where it is a podcast's or cannot be read, undefined where it is not one at all. */
function spotifyListen(row: Json): ForeignListen | null | undefined {
  if ('endTime' in row && 'msPlayed' in row) {
    const title = text(row.trackName);
    const ended = momentOf(row.endTime);
    const ms = number(row.msPlayed);
    if (!title || ended == null || ms == null) return null;
    return {
      title,
      artist: text(row.artistName),
      album: null,
      startedAt: ended - ms,
      secondsPlayed: ms / 1000,
      completed: null,
      source: 'spotify',
    };
  }
  if ('ts' in row && 'ms_played' in row) {
    // An episode or a book's chapter has no track name, and is not music.
    const title = text(row.master_metadata_track_name);
    const ended = momentOf(row.ts);
    const ms = number(row.ms_played);
    if (!title || ended == null || ms == null) return null;
    const reason = text(row.reason_end);
    return {
      title,
      artist: text(row.master_metadata_album_artist_name),
      album: text(row.master_metadata_album_album_name),
      startedAt: ended - ms,
      secondsPlayed: ms / 1000,
      // To the end when it says so, and short of it when the listener moved
      // on; anything else -- the app closed, the phone rang -- is not known.
      completed: reason === 'trackdone' ? true : row.skipped === true || reason === 'fwdbtn' ? false : null,
      source: 'spotify',
    };
  }
  return undefined;
}

/** A listen as ListenBrainz writes one, as {@link spotifyListen} reads Spotify's. */
function brainzListen(row: Json): ForeignListen | null | undefined {
  if (!('listened_at' in row) || !isObject(row.track_metadata)) return undefined;
  const meta = row.track_metadata;
  const title = text(meta.track_name);
  const at = momentOf(row.listened_at);
  if (!title || at == null) return null;
  const info = isObject(meta.additional_info) ? meta.additional_info : {};
  const ms = number(info.duration_ms);
  const seconds = ms != null ? ms / 1000 : number(info.duration);
  return {
    title,
    artist: text(meta.artist_name),
    album: text(meta.release_name),
    startedAt: at,
    secondsPlayed: seconds != null && seconds > 0 ? seconds : null,
    completed: true,
    source: 'listenbrainz',
  };
}

/** The rows of a JSON file: a list, an answer with a list in it, or a file of one object a line. */
function jsonRows(json: string): unknown[] | null {
  try {
    const value: unknown = JSON.parse(json);
    if (Array.isArray(value)) return value;
    if (isObject(value)) {
      if (isObject(value.payload) && Array.isArray(value.payload.listens)) return value.payload.listens;
      if (Array.isArray(value.listens)) return value.listens;
      return [value];
    }
    return null;
  } catch {
    const rows: unknown[] = [];
    for (const line of json.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }
    return rows.length > 0 ? rows : null;
  }
}

/** The cells of a table, quotes and all, split on [delimiter]. */
function csvRows(table: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < table.length; i++) {
    const char = table[i]!;
    if (quoted) {
      if (char === '"') {
        if (table[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && table[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((each) => each.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell);
  if (row.some((each) => each.trim() !== '')) rows.push(row);
  return rows;
}

const ARTIST_COLUMNS = ['artist', 'artist name', 'artist_name', 'artistname'];
const TITLE_COLUMNS = ['track', 'title', 'track name', 'track_name', 'trackname', 'song', 'name'];
const ALBUM_COLUMNS = ['album', 'album name', 'album_name', 'albumname', 'release'];
// A count of seconds first, where there is one beside a date written out: it cannot be misread.
const TIME_COLUMNS = ['uts', 'timestamp', 'date', 'utc_time', 'time', 'played at', 'played_at', 'listened_at', 'scrobble time'];

/**
 * A Last.fm export, which is a table.
 *
 * With no heading, its columns are artist, album, track and date, which is
 * what the exporter most people are sent to writes. With one, the heading
 * says which column is which, under any of the names the others use.
 */
function lastfmListens(table: string): ForeignListen[] | null {
  const firstLine = table.slice(0, table.search(/\r?\n|$/));
  const delimiter = [',', ';', '\t'].reduce((best, each) =>
    firstLine.split(each).length > firstLine.split(best).length ? each : best
  );
  const rows = csvRows(table, delimiter);
  if (rows.length === 0) return null;

  const heading = rows[0]!.map((cell) => cell.trim().toLowerCase());
  const column = (names: string[]) => {
    for (const name of names) {
      const at = heading.indexOf(name);
      if (at >= 0) return at;
    }
    return -1;
  };
  const headed = column(ARTIST_COLUMNS) >= 0 && column(TITLE_COLUMNS) >= 0;
  const at = headed
    ? { artist: column(ARTIST_COLUMNS), album: column(ALBUM_COLUMNS), title: column(TITLE_COLUMNS), time: column(TIME_COLUMNS) }
    : { artist: 0, album: 1, title: 2, time: 3 };
  if (at.time < 0) return null;

  const listens: ForeignListen[] = [];
  for (const row of headed ? rows.slice(1) : rows) {
    const title = text(row[at.title]);
    const startedAt = momentOf(row[at.time]);
    // A row with no time is the song that was playing as the export was made.
    if (!title || startedAt == null) continue;
    listens.push({
      title,
      artist: text(row[at.artist]),
      album: at.album >= 0 ? text(row[at.album]) : null,
      startedAt,
      secondsPlayed: null,
      completed: true,
      source: 'lastfm',
    });
  }
  // A table none of whose rows reads as a listen is some other table.
  return listens.length > 0 ? listens : null;
}

/**
 * The listens in one file, or null when it is not a history this can read.
 *
 * A file that is a history and has nothing in it to bring -- Spotify's
 * history of podcasts, say -- is an empty list and not null.
 */
export function readHistory(contents: string): ForeignListen[] | null {
  const body = contents.replace(/^﻿/, '');
  const start = body.trimStart()[0];
  if (start !== '[' && start !== '{') return lastfmListens(body);

  const rows = jsonRows(body);
  if (!rows) return null;
  const listens: ForeignListen[] = [];
  let known = false;
  for (const row of rows) {
    if (!isObject(row)) continue;
    // Undefined is a row of neither shape; null, one of the shape with nothing to bring.
    const spotify = spotifyListen(row);
    const listen = spotify === undefined ? brainzListen(row) : spotify;
    if (listen === undefined) continue;
    known = true;
    if (listen) listens.push(listen);
  }
  return known ? listens : null;
}

/** As much of a library track as a listen is matched by. */
export type LibrarySong = {
  id: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSec: number;
  filename: string | null;
};

/** A listen already in the history, as much of it as tells it apart. */
export type HeldListen = { startedAt: number; title: string; artist: string | null };

/** A row for the `plays` table, under its column names. */
export type PlayRow = {
  track_id: string;
  title: string;
  artist: string | null;
  filename: string | null;
  started_at: number;
  seconds_played: number;
  completed: 0 | 1;
  source: HistorySource;
};

/** What an import would do, said before it is done. */
export type ImportPlan = {
  /** What would be written, oldest first. */
  rows: PlayRow[];
  /** Every listen the files held. */
  found: number;
  /** Left out for being shorter than {@link SHORTEST_LISTEN_SEC}. */
  short: number;
  /** Left out for being in the history already, or twice in the files. */
  already: number;
  /** Of the rows, how many are of a song in the library. */
  matched: number;
  /** And how many different songs those are. */
  songs: number;
  /** The first and last of the rows, in milliseconds; null with none. */
  from: number | null;
  until: number | null;
};

const exactKey = (title: string, artist: string | null) => `${foldForMatch(artist ?? '')}|${foldForMatch(title)}`;

/** What says that two listens are one: the same second, and the same song by the same artist ([name], an {@link exactKey}). */
const sameListen = (startedAt: number, name: string) => `${Math.floor(startedAt / 1000)}\u0000${name}`;

/**
 * The id a song that is not in the library is filed under.
 *
 * Made from its name, as the backup makes one for a song that is not on the
 * phone (`backup/apply.ts`), so that it stays one song from one import to
 * the next and every listen of it is counted together. The loose name, so
 * that `Numb` and `Numb - 2011 Remaster`, which the services spell
 * differently from year to year, are counted as the one song they are.
 */
export function absentId(title: string, artist: string | null): string {
  return `absent:${hash(looseSongKey({ title, artist }))}`;
}

/**
 * Which listens to write, and under which song each.
 *
 * A listen is put on a song of the library when the artist and title are the
 * same, folded the way the rest of the app folds names -- case, accents,
 * punctuation; failing that, when they are the same with the notes taken off
 * that only say how a copy was issued, the guests after the lead artist and
 * a `(Remastered)` after a title. Where several songs answer, the one on the
 * same album is taken, and then the first by id, so that the same file
 * brought in twice puts its listens on the same song both times. Several
 * copies of one song are one song, and which of them carries its listens is
 * a small matter beside losing them.
 *
 * A song that is not in the library keeps its listens anyway, under an id of
 * its own (see {@link absentId}): it was listened to, and the hours count.
 *
 * Left out: listens shorter than half a minute, which Spotify keeps and
 * nobody would call a listen; and any listen the history already has, begun
 * in the same second with the same title and artist, which is what makes
 * bringing the same file in twice add nothing the second time.
 */
export function planImport(
  listens: Iterable<ForeignListen>,
  library: readonly LibrarySong[],
  held: Iterable<HeldListen>
): ImportPlan {
  const exact = new Map<string, LibrarySong[]>();
  const loose = new Map<string, LibrarySong[]>();
  const add = (index: Map<string, LibrarySong[]>, key: string, song: LibrarySong) => {
    const list = index.get(key);
    if (!list) index.set(key, [song]);
    else if (!list.some((each) => each.id === song.id)) list.push(song);
  };
  for (const song of library) {
    if (!song.title) continue;
    add(exact, exactKey(song.title, song.artist), song);
    add(loose, looseSongKey({ title: song.title, artist: song.artist }), song);
  }

  // Asked once a song, whatever the size of the history: a year of
  // somebody's listening is the same few hundred songs again and again.
  const chosen = new Map<string, LibrarySong | null>();
  const songOf = (listen: ForeignListen, key: string): LibrarySong | null => {
    const album = foldForMatch(listen.album ?? '');
    const asked = `${key}\u0000${album}`;
    const known = chosen.get(asked);
    if (known !== undefined) return known;

    const candidates = exact.get(key) ?? loose.get(looseSongKey(listen)) ?? [];
    const onAlbum = album ? candidates.filter((song) => foldForMatch(song.album ?? '') === album) : [];
    const pool = onAlbum.length > 0 ? onAlbum : candidates;
    const song = pool.reduce<LibrarySong | null>((best, each) => (best == null || each.id < best.id ? each : best), null);
    chosen.set(asked, song);
    return song;
  };

  const seen = new Set<string>();
  for (const listen of held) seen.add(sameListen(listen.startedAt, exactKey(listen.title, listen.artist)));
  // The made-up ids, likewise once a song.
  const absent = new Map<string, string>();
  const absentFor = (listen: ForeignListen, name: string) => {
    let id = absent.get(name);
    if (id == null) {
      id = absentId(listen.title, listen.artist);
      absent.set(name, id);
    }
    return id;
  };

  const rows: PlayRow[] = [];
  let found = 0;
  let short = 0;
  let already = 0;
  for (const listen of listens) {
    found++;
    if (!Number.isFinite(listen.startedAt) || listen.startedAt <= 0) continue;
    if (listen.secondsPlayed != null && listen.secondsPlayed < SHORTEST_LISTEN_SEC) {
      short++;
      continue;
    }
    const startedAt = Math.round(listen.startedAt);
    const name = exactKey(listen.title, listen.artist);
    const once = sameListen(startedAt, name);
    if (seen.has(once)) {
      already++;
      continue;
    }
    seen.add(once);

    const song = songOf(listen, name);
    const length = song && song.durationSec > 0 ? song.durationSec : null;
    // A scrobble says nothing of how long it ran; the song's own length is
    // the best guess there is, and with no song, nothing is guessed.
    const seconds = listen.secondsPlayed ?? length ?? 0;
    const completed =
      listen.completed ?? (length != null && listen.secondsPlayed != null ? listen.secondsPlayed >= length * 0.9 : true);
    rows.push({
      track_id: song ? song.id : absentFor(listen, name),
      title: listen.title,
      artist: listen.artist,
      filename: song ? song.filename : null,
      started_at: startedAt,
      seconds_played: Math.round(seconds * 1000) / 1000,
      completed: completed ? 1 : 0,
      source: listen.source,
    });
  }

  rows.sort((a, b) => a.started_at - b.started_at);
  const matchedIds = new Set<string>();
  let matched = 0;
  for (const row of rows) {
    if (row.track_id.startsWith('absent:')) continue;
    matched++;
    matchedIds.add(row.track_id);
  }
  return {
    rows,
    found,
    short,
    already,
    matched,
    songs: matchedIds.size,
    from: rows[0]?.started_at ?? null,
    until: rows[rows.length - 1]?.started_at ?? null,
  };
}
