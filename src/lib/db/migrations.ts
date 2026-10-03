/**
 * Schema history, applied in order and never twice.
 *
 * `user_version` counts how many of these a database has had, so a launch that
 * has nothing to do reads one pragma and stops. That matters because the two
 * one-time data fixups below used to run on every single open: a full scan of
 * `track_metadata` with an insert-select behind it, and a rewrite pass over
 * `plays`, both on the thread that draws the first frame.
 *
 * The table definitions are deliberately *not* part of that history. Versioning
 * arrived long after the app shipped, and the installs in the wild are spread
 * across every shape the schema has ever had — settings alone, settings and
 * plays, and each of the three later tables in turn. They only ever converged
 * because these `IF NOT EXISTS` statements ran on every open, so they still run
 * on every open; what the versioning buys is skipping the expensive data
 * fixups, which is where the cost actually was.
 */

/** The parts of a database this needs. Kept small so it can be given a plain
 * SQLite handle in a test rather than the Expo one. */
export type MigrationTarget = {
  execSync(sql: string): void;
  getFirstSync<T>(sql: string): T | null;
};

const BASE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  -- Title and artist are denormalized on purpose: a media store id stops
  -- resolving once the file is moved or deleted, and history has to outlive
  -- the file it came from.
  CREATE TABLE IF NOT EXISTS plays (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id       TEXT    NOT NULL,
    title          TEXT    NOT NULL,
    artist         TEXT,
    filename       TEXT    NOT NULL,
    started_at     INTEGER NOT NULL,
    seconds_played REAL    NOT NULL,
    completed      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS plays_started_at ON plays (started_at);
  CREATE INDEX IF NOT EXISTS plays_track_id   ON plays (track_id);

  -- Kept apart from plays so that re-running enrichment improves every past
  -- statistic rather than only the listens recorded after it.
  CREATE TABLE IF NOT EXISTS track_metadata (
    track_id    TEXT PRIMARY KEY NOT NULL,
    status      TEXT NOT NULL,
    source      TEXT,
    title       TEXT,
    artist      TEXT,
    album       TEXT,
    genre       TEXT,
    year        INTEGER,
    artwork_url TEXT,
    fetched_at  INTEGER NOT NULL
  );

  -- Tags rather than one genre, because a track is rarely one thing: the
  -- sources describe a song as gothic *and* metal *and* japanese, and which
  -- of those you want depends on what you are looking for.
  --
  -- position is the order of importance: 0 is the one that best describes the
  -- track, so the list can be shown, and reordered, meaningfully.
  CREATE TABLE IF NOT EXISTS track_tags (
    track_id TEXT    NOT NULL,
    tag      TEXT    NOT NULL,
    position INTEGER NOT NULL,
    source   TEXT    NOT NULL,
    PRIMARY KEY (track_id, tag)
  );

  CREATE INDEX IF NOT EXISTS track_tags_tag ON track_tags (tag);

  -- Both forms are kept. The timed one is what scrolls with the song, but it
  -- is not always available, and plain words are better than none. A row with
  -- neither records that the database was asked and had nothing.
  CREATE TABLE IF NOT EXISTS track_lyrics (
    track_id   TEXT PRIMARY KEY NOT NULL,
    plain      TEXT,
    synced     TEXT,
    fetched_at INTEGER NOT NULL
  );

  -- Lists somebody made, as against tags, which say what a track is.
  --
  -- The two look alike and are not. A tag answers what a track *is* — a
  -- property, unordered, shared, and half of them come off the internet. A
  -- list answers what somebody wants to *hear*, in an order they chose. You
  -- can build a list out of tags; you cannot express "these nine, in this
  -- order, and that one metal track because it belongs" as a tag.
  CREATE TABLE IF NOT EXISTS playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- A track appears in a list once. That is what the primary key says, and it
  -- is deliberate: adding a track already there should be a no-op rather than
  -- a duplicate, which is what somebody adding an album twice actually meant.
  --
  -- Membership is not cleaned up when a list goes, because foreign keys are
  -- off on this connection and a declared cascade would be decoration. The
  -- deletes are written out instead, in one transaction.
  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL,
    track_id    TEXT    NOT NULL,
    position    INTEGER NOT NULL,
    added_at    INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, track_id)
  );

  CREATE INDEX IF NOT EXISTS playlist_tracks_order
    ON playlist_tracks (playlist_id, position);

  -- One row per track and target language, so changing the language later adds
  -- a translation rather than replacing the one already made.
  --
  -- The lines column is a JSON array holding one entry for every line of the
  -- original,
  -- blanks included. Keeping the shape rather than the text is what lets a
  -- translation be laid against timed lyrics: line five of the song and line
  -- five of the translation are the same moment, and joining them into a single
  -- string would lose that the moment a translator merged two lines into one.
  CREATE TABLE IF NOT EXISTS lyric_translations (
    track_id      TEXT NOT NULL,
    target        TEXT NOT NULL,
    source        TEXT,
    lines         TEXT NOT NULL,
    translated_at INTEGER NOT NULL,
    PRIMARY KEY (track_id, target)
  );
`;

/**
 * The two rewrites that used to run on every open, now run once.
 *
 * Both are idempotent, so applying them to a database that has already had them
 * would cost time but change nothing — except for the backfill, which would put
 * back tags the user has since deleted by hand. That is what `baselineOf` is
 * guarding, and it is the only thing it needs to guard.
 */
const LEGACY_DATA = `
  -- Genres collected before tags existed become each track's first tag, so the
  -- work already done is not thrown away and nothing has to be looked up again.
  INSERT OR IGNORE INTO track_tags (track_id, tag, position, source)
    SELECT track_id, LOWER(genre), 0, COALESCE(source, 'musicbrainz')
    FROM track_metadata
    WHERE genre IS NOT NULL AND genre != '';

  -- expo-media-library identified assets by their full content uri; the native
  -- module uses the bare media store id the uri is built from. Normalize the
  -- older rows so history written before the switch still matches the library.
  UPDATE plays
    SET track_id = replace(track_id, 'content://media/external/audio/media/', '')
    WHERE track_id LIKE 'content://media/external/audio/media/%';
`;

/**
 * "Asked and could not reach" is not the same answer as "asked and there are
 * none", and storing the first as the second would cost every track played on
 * an aeroplane a month of lyrics.
 */
const LYRICS_UNREACHABLE = `
  ALTER TABLE track_lyrics ADD COLUMN unreachable_at INTEGER;
`;

/**
 * `filename` comes from the media store, which really does hand back null for
 * it, and a NOT NULL column turned that into a constraint violation thrown from
 * inside a playback event listener — where it took the rest of the handler,
 * including the state updates that keep the interface following the player,
 * down with it. SQLite cannot drop NOT NULL in place, hence the rebuild.
 */
const NULLABLE_PLAY_FILENAME = `
  CREATE TABLE plays_rebuilt (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id       TEXT    NOT NULL,
    title          TEXT    NOT NULL,
    artist         TEXT,
    filename       TEXT,
    started_at     INTEGER NOT NULL,
    seconds_played REAL    NOT NULL,
    completed      INTEGER NOT NULL
  );

  INSERT INTO plays_rebuilt (id, track_id, title, artist, filename, started_at, seconds_played, completed)
    SELECT id, track_id, title, artist, filename, started_at, seconds_played, completed FROM plays;

  DROP TABLE plays;
  ALTER TABLE plays_rebuilt RENAME TO plays;

  CREATE INDEX IF NOT EXISTS plays_started_at ON plays (started_at);
  CREATE INDEX IF NOT EXISTS plays_track_id   ON plays (track_id);
`;

/**
 * Words a person put there by hand, and how far they sit from the music.
 *
 * `source` is what keeps a correction from being undone: a later lookup
 * overwrites what a lookup found, and leaves alone what somebody chose.
 *
 * `offset_ms` is stored beside the timings rather than folded into them, so it
 * stays adjustable and the original stays intact. Most of the time a set of
 * timings is not wrong, only early or late — the recording has a longer intro
 * than the one it was timed against — and a single number fixes the whole song.
 */
const LYRICS_SOURCE_AND_OFFSET = `
  ALTER TABLE track_lyrics ADD COLUMN source TEXT;
  ALTER TABLE track_lyrics ADD COLUMN offset_ms INTEGER NOT NULL DEFAULT 0;
`;

/**
 * Which track's cover stands for a list, when the default will not do.
 *
 * A track rather than a picture. Every cover the app can show already belongs
 * to a track — read out of the file or fetched for it — so naming the track
 * names the picture, and does it without a second place for images to live, a
 * second thing to clean up, and a file that outlives whatever it was chosen
 * for.
 *
 * Null means the first four covers in the list, arranged in a square. Which is
 * not stored at all: it is what the list looks like, and it follows the list
 * around as it is reordered.
 */
const PLAYLIST_COVER = `
  ALTER TABLE playlists ADD COLUMN cover_track_id TEXT;
`;

/**
 * Where a track sits on its record.
 *
 * Needed because the media store rarely knows. A file downloaded one at a time
 * carries no track number and reports its folder as its album, so an album
 * assembled that way has the right songs in the wrong order — which is most of
 * what an album is. The catalogue does know, and has been throwing the answer
 * away.
 *
 * Both nullable, and deliberately: a track whose position is unknown has to be
 * distinguishable from one that is genuinely first, or every unnumbered track
 * in the library opens its album.
 */
const ALBUM_POSITION = `
  ALTER TABLE track_metadata ADD COLUMN track_number INTEGER;
  ALTER TABLE track_metadata ADD COLUMN disc_number INTEGER;
`;

/**
 * A cover chosen from the phone rather than from the list's own tracks.
 *
 * Beside `cover_track_id` and not instead of it, because the two mean
 * different things: one names a track whose picture stands for the list and
 * follows that track, the other is a file the user picked out and which
 * nothing else can change. Whichever was set last is the one in force, so
 * setting either clears the other.
 */
const PLAYLIST_COVER_IMAGE = `
  ALTER TABLE playlists ADD COLUMN cover_uri TEXT;
`;

/**
 * A list that is a standing question about a tag rather than a set of tracks.
 *
 * Making a list out of a tag can mean two things and they are opposites. One
 * is "these tracks, as they are now, and from here they are mine to reorder
 * and prune" -- a copy, which is what this already did. The other is "whatever
 * carries this tag, always", which cannot be a copy: adding the tag to a track
 * next week has to put it in the list, and that only works if the list is read
 * from the tag every time it is opened.
 *
 * Null for every list that is not that, which is every list that exists today.
 * A list with a tag keeps no rows in `playlist_tracks` at all -- membership is
 * the query, so there is nothing to keep in step and no way for the two to
 * disagree. It still has a name and a cover of its own, because those are the
 * list's and not the tag's.
 */
const PLAYLIST_FROM_TAG = `
  ALTER TABLE playlists ADD COLUMN tag TEXT;
`;

/**
 * Lower-casing the letters SQLite will not.
 *
 * Its own `LOWER()` is ASCII and nothing more, so `Ö` and `İ` come through a
 * fold untouched — which on a Turkish library is most of the words that have
 * a case at all. The dotted capital maps to plain `i` rather than to `i` with
 * a combining dot, matching what the app does everywhere else; the rest are
 * their own lower-case selves.
 */
const FOLD = (column: string) =>
  ['İ,i', 'Ö,ö', 'Ü,ü', 'Ğ,ğ', 'Ş,ş', 'Ç,ç', 'Â,â', 'Î,î', 'Û,û'].reduce(
    (sql, pair) => {
      const [from, to] = pair.split(',');
      return `REPLACE(${sql}, '${from}', '${to}')`;
    },
    `LOWER(${column})`
  );

/**
 * One spelling per tag, for the tags already written down.
 *
 * From here on every write goes through the same fold, so the column cannot
 * gather two spellings of one tag again. What it already holds has to be
 * brought into line, or a library where somebody typed `Rock` once keeps two
 * of everything — two rows in the tag list, each with half the count, and a
 * list made from one of them missing the tracks filed under the other.
 *
 * `UPDATE OR IGNORE` because a track can be carrying both spellings: folding
 * the second onto the first would collide with the primary key, and the right
 * outcome is to keep one and drop the other rather than to fail. The delete
 * behind it clears whatever the ignore left standing. Positions are left with
 * gaps, which nothing minds — they are read in order, not by value.
 *
 * `track_metadata.genre` is the first tag written down a second time, so it
 * gets the same treatment or the listening statistics stay split.
 */
const ONE_SPELLING_PER_TAG = `
  UPDATE OR IGNORE track_tags SET tag = ${FOLD('tag')} WHERE tag <> ${FOLD('tag')};
  DELETE FROM track_tags WHERE tag <> ${FOLD('tag')};
  UPDATE track_metadata SET genre = ${FOLD('genre')}
    WHERE genre IS NOT NULL AND genre <> ${FOLD('genre')};
`;

/**
 * A picture of the artist, and the terms it may be shown under.
 *
 * Its own table rather than a column on anything: every other row here is about
 * a track, and this is about a name. An artist with forty tracks is one
 * photograph, one lookup and one file, and hanging it off the tracks would be
 * forty copies of that and no way to record the artists that have no picture.
 *
 * `artist` is the folded name, so `Kanako Itō` and `Kanako Ito` are one artist
 * and not two lookups; `name` keeps a spelling somebody actually wrote, which
 * the fold is not readable enough to stand in for.
 *
 * A null `photo_uri` is the useful half of the table: it says the chain was
 * followed and ended in nothing, which is the common case for a personal
 * library and the thing that must not be asked again at a request a second per
 * artist every time the recap opens. Nothing is written when the request simply
 * failed — "could not reach" is not "there is none", the same distinction
 * `unreachable_at` draws for lyrics above.
 *
 * `credit` and `licence` are stored beside the file and not derived from it,
 * because they are what makes showing it lawful: the file outlives the lookup,
 * and a copy on disk with no idea who took it is one that has to be thrown
 * away rather than shown.
 *
 * Unlike the tables in `BASE_SCHEMA`, this one has no history to converge from
 * — every install that will ever see it is already versioned — so it is
 * created once here rather than checked on every open.
 */
const ARTIST_PHOTOS = `
  CREATE TABLE IF NOT EXISTS artist_photos (
    artist     TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    photo_uri  TEXT,
    credit     TEXT,
    licence    TEXT,
    fetched_at INTEGER NOT NULL
  );
`;

/**
 * The listens that were cut short, which `plays` cannot tell you about.
 *
 * A play is only written down once thirty seconds of it have been heard, and
 * the whole point of a skip is that it was not. The commonest one there is —
 * four seconds in, press next — has therefore never appeared anywhere in this
 * database, and no query over `plays` could have found it.
 *
 * Its own table rather than a column on `plays`, because the two answer
 * different questions and genuinely overlap: ninety seconds of a four-minute
 * song is both a play that counted and a track that was walked out on. Folding
 * them together would mean choosing which of those to lose.
 *
 * `duration_sec` is here and not looked up, for the same reason the title is:
 * history has to outlive the file. Without it there is no way to tell four
 * seconds of a long song from four seconds of a six-second one, and only the
 * first of those is a judgement about the music.
 */
const SKIPS = `
  CREATE TABLE IF NOT EXISTS skips (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id       TEXT    NOT NULL,
    title          TEXT    NOT NULL,
    artist         TEXT,
    started_at     INTEGER NOT NULL,
    seconds_played REAL    NOT NULL,
    duration_sec   REAL    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS skips_track_id ON skips (track_id);
  CREATE INDEX IF NOT EXISTS skips_started_at ON skips (started_at);
`;

/**
 * Music worth going and finding, and the names it was worked out from.
 *
 * `artist_ids` is a cache with a purpose beyond speed. Resolving a name to a
 * catalogue id costs a request a second and a half, so a run over a dozen
 * artists spends most of its time on names it resolved last week. A null
 * `mbid` is the useful half: it says the catalogue was asked and had nothing,
 * which must not be asked again every time — the same distinction
 * `artist_photos` draws, and for the same reason.
 *
 * `discoveries` holds a whole run's findings rather than being read live,
 * because a run is twenty-odd requests and half a minute. The screen reads the
 * table and is instant; asking again is a thing the user does, not a thing
 * opening a screen does.
 *
 * `because` is the artist already listened to that led to the suggestion,
 * stored rather than recomputed: it is the only part of a recommendation that
 * explains itself, and it belongs to the run that produced it.
 */
const DISCOVERY = `
  CREATE TABLE IF NOT EXISTS artist_ids (
    artist     TEXT PRIMARY KEY NOT NULL,
    mbid       TEXT,
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS discoveries (
    recording_mbid TEXT PRIMARY KEY NOT NULL,
    title          TEXT    NOT NULL,
    artist         TEXT    NOT NULL,
    artist_mbid    TEXT    NOT NULL,
    release_name   TEXT,
    cover_url      TEXT,
    because        TEXT    NOT NULL,
    rank           INTEGER NOT NULL,
    found_at       INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS discoveries_rank ON discoveries (rank);
`;

/**
 * What a catalogue has said about a credit that could be read two ways.
 *
 * `Simon & Garfunkel` and `Lena Raine & Minecraft` are the same shape, and
 * only one of them is two artists. Nothing in the text says which, so the
 * rules guess; and when a lookup finds the song filed under the whole credit,
 * or only under one name out of it, that is the answer and it is kept here for
 * the next time artists are counted.
 *
 * Keyed on the folded credit, like every other table that files things under
 * an artist's name. Not in a backup: it is something learned from a catalogue
 * and can be learned again.
 */
const CREDITS = `
  CREATE TABLE IF NOT EXISTS artist_credits (
    credit     TEXT PRIMARY KEY NOT NULL,
    one_artist INTEGER NOT NULL,
    fetched_at INTEGER NOT NULL
  );
`;

export const MIGRATIONS: string[] = [
  LEGACY_DATA,
  LYRICS_UNREACHABLE,
  NULLABLE_PLAY_FILENAME,
  LYRICS_SOURCE_AND_OFFSET,
  PLAYLIST_COVER,
  ALBUM_POSITION,
  PLAYLIST_COVER_IMAGE,
  PLAYLIST_FROM_TAG,
  ONE_SPELLING_PER_TAG,
  ARTIST_PHOTOS,
  SKIPS,
  DISCOVERY,
  CREDITS,
  `CREATE TABLE IF NOT EXISTS discover_state (
    id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS discover_exclusions (
    id TEXT PRIMARY KEY NOT NULL, song_key TEXT NOT NULL, title TEXT NOT NULL,
    artist TEXT NOT NULL, reason TEXT NOT NULL, until_at INTEGER
  );`,
];

/**
 * Which migration to start from.
 *
 * `user_version` is 0 both for a database that has never been opened and for
 * one written before any of this existed, and only the second must be kept away
 * from the genre backfill. `track_tags` tells them apart: the table and the
 * backfill arrived in the same release, and the backfill ran on every open from
 * then until now, so a database that has the table has certainly had the
 * backfill — and one that does not cannot have had it, whether it is empty or a
 * three-releases-old install that never saw tags at all.
 *
 * This has to be asked before `BASE_SCHEMA` runs, since that creates the table.
 */
function baselineOf(database: MigrationTarget): number {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version > 0) return version;

  const existing = database.getFirstSync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'track_tags'`
  );
  return existing ? 1 : 0;
}

/**
 * A statement in the middle of a `BEGIN; ...; COMMIT;` failing leaves the
 * transaction open: SQLite stops at the offending statement and never reaches
 * the `COMMIT`. Left that way the connection is unusable — the next `BEGIN`
 * fails with "cannot start a transaction within a transaction", and anything
 * that does get through reads uncommitted half-migrated tables.
 */
function applyAtomically(database: MigrationTarget, sql: string): void {
  try {
    database.execSync(`BEGIN; ${sql} COMMIT;`);
  } catch (error) {
    try {
      database.execSync('ROLLBACK');
    } catch {
      // Nothing to roll back, which happens when it was `BEGIN` itself that
      // failed. Reporting that instead of the real failure would only hide it.
    }
    throw error;
  }
}

/** Bring `database` up to date. Returns the version it now holds. */
export function migrate(database: MigrationTarget): number {
  const target = MIGRATIONS.length;
  const baseline = baselineOf(database);

  applyAtomically(database, BASE_SCHEMA);

  for (let version = baseline; version < target; version += 1) {
    // The version bump rides inside the same transaction as the work it
    // describes, so a migration that fails part way is rolled back whole and
    // not recorded as done.
    applyAtomically(database, `${MIGRATIONS[version]!} PRAGMA user_version = ${version + 1};`);
  }
  return target;
}
