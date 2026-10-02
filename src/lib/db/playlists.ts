import { db } from './index.ts';

export type Playlist = {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  trackCount: number;
  /** Whose cover stands for the list, or null for the first four in a square. */
  coverTrackId: string | null;
  /** A picture chosen from the phone, which outranks both of those. */
  coverUri: string | null;
  /**
   * The tag this list is a standing question about, or null if it is a list of
   * chosen tracks.
   *
   * The one field that changes what the list *is*. With a tag there is nothing
   * in `playlist_tracks` at all: membership is read from the tag every time,
   * so a track tagged next week is in the list next week and there is no copy
   * to fall out of step. Without one it is the ordinary kind — an order
   * somebody chose, which is the thing a tag can never express.
   */
  tag: string | null;
};

/**
 * The lists, most recently touched first.
 *
 * Counted in the query rather than by loading the members, because the screen
 * that shows these only needs the number — and reading every list's tracks to
 * say "12" would make opening the tab cost the whole library.
 */
export function playlists(): Playlist[] {
  return db().getAllSync<Playlist>(
    `SELECT p.id,
            p.name,
            p.created_at    AS createdAt,
            p.updated_at    AS updatedAt,
            p.cover_track_id AS coverTrackId,
            p.cover_uri      AS coverUri,
            p.tag            AS tag,
            /*
              Counted from whichever side holds the members. The tagged count
              can read a little high on a library that has lost files, since a
              tag outlives the track it was put on; the list itself is resolved
              against the library when it is opened, which is where the number
              has to be right.
            */
            CASE WHEN p.tag IS NULL
              THEN (SELECT COUNT(*) FROM playlist_tracks t WHERE t.playlist_id = p.id)
              ELSE (SELECT COUNT(DISTINCT t.track_id) FROM track_tags t WHERE t.tag = p.tag)
            END AS trackCount
     FROM playlists p
     ORDER BY p.updated_at DESC, p.id DESC`
  );
}

export function playlist(id: number): Playlist | null {
  return db().getFirstSync<Playlist>(
    `SELECT p.id,
            p.name,
            p.created_at    AS createdAt,
            p.updated_at    AS updatedAt,
            p.cover_track_id AS coverTrackId,
            p.cover_uri      AS coverUri,
            p.tag            AS tag,
            /*
              Counted from whichever side holds the members. The tagged count
              can read a little high on a library that has lost files, since a
              tag outlives the track it was put on; the list itself is resolved
              against the library when it is opened, which is where the number
              has to be right.
            */
            CASE WHEN p.tag IS NULL
              THEN (SELECT COUNT(*) FROM playlist_tracks t WHERE t.playlist_id = p.id)
              ELSE (SELECT COUNT(DISTINCT t.track_id) FROM track_tags t WHERE t.tag = p.tag)
            END AS trackCount
     FROM playlists p WHERE p.id = ?`,
    id
  );
}

/**
 * @param tag Makes the list a standing question about that tag rather than a
 *   set of chosen tracks. Nothing is ever written to `playlist_tracks` for it.
 */
export function createPlaylist(name: string, at: number, tag?: string): number {
  const result = db().runSync(
    `INSERT INTO playlists (name, created_at, updated_at, tag) VALUES (?, ?, ?, ?)`,
    name.trim(),
    Math.round(at),
    Math.round(at),
    tag ?? null
  );
  return result.lastInsertRowId;
}

export function renamePlaylist(id: number, name: string, at: number): void {
  db().runSync(
    `UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?`,
    name.trim(),
    Math.round(at),
    id
  );
}

/**
 * Pins the list's cover to one track, or lets it go back to the default.
 *
 * Not counted as touching the list: `updated_at` orders the lists on screen by
 * when they were last worked on, and choosing a picture is not work on the
 * list's contents.
 */
export function setPlaylistCover(id: number, trackId: string | null): void {
  // Clears the picked image as it goes. The two are alternatives, and a list
  // holding both would show whichever the drawing code happened to prefer.
  db().runSync(
    `UPDATE playlists SET cover_track_id = ?, cover_uri = NULL WHERE id = ?`,
    trackId,
    id
  );
}

/** A picture chosen from the phone, or null to go back to the tracks' own. */
export function setPlaylistImage(id: number, uri: string | null): void {
  db().runSync(
    `UPDATE playlists SET cover_uri = ?, cover_track_id = NULL WHERE id = ?`,
    uri,
    id
  );
}

/** The list and everything in it, in one change or none. */
export function deletePlaylist(id: number): void {
  const database = db();
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM playlist_tracks WHERE playlist_id = ?`, id);
    database.runSync(`DELETE FROM playlists WHERE id = ?`, id);
  });
}

/** Track ids in the order the list holds them. */
export function playlistTrackIds(id: number): string[] {
  return db()
    .getAllSync<{ track_id: string }>(
      `SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position`,
      id
    )
    .map((row) => row.track_id);
}

/**
 * Appends tracks, skipping any the list already holds.
 *
 * Answers how many were actually new, which is what the confirmation needs to
 * say: adding an album you half-added last week should report the half it
 * added, not the whole of it.
 */
export function addToPlaylist(id: number, trackIds: string[], at: number): number {
  if (trackIds.length === 0) return 0;
  const database = db();
  let added = 0;

  database.withTransactionSync(() => {
    const row = database.getFirstSync<{ next: number | null }>(
      `SELECT MAX(position) + 1 AS next FROM playlist_tracks WHERE playlist_id = ?`,
      id
    );
    let position = row?.next ?? 0;

    for (const trackId of trackIds) {
      const result = database.runSync(
        // Already there is not a failure and not a duplicate. The position of
        // the copy already in the list is where the track belongs, since that
        // is where it was put.
        `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
         VALUES (?, ?, ?, ?)`,
        id,
        trackId,
        position,
        Math.round(at)
      );
      if (result.changes > 0) {
        added += 1;
        position += 1;
      }
    }

    if (added > 0) {
      database.runSync(`UPDATE playlists SET updated_at = ? WHERE id = ?`, Math.round(at), id);
    }
  });

  return added;
}

export function removeFromPlaylist(id: number, trackId: string, at: number): void {
  const database = db();
  database.withTransactionSync(() => {
    database.runSync(
      `DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`,
      id,
      trackId
    );
    // The gap left behind is closed straight away rather than tolerated,
    // because a reorder writes positions back as 0..n-1 and a stale gap would
    // make the two disagree about what "position 4" means.
    renumber(id);
    database.runSync(`UPDATE playlists SET updated_at = ? WHERE id = ?`, Math.round(at), id);
  });
}

/**
 * Moves the track at [from] to [to], shifting whatever is in between.
 *
 * The whole list is rewritten rather than the affected range patched. A range
 * update is two statements that have to agree about direction and inclusivity,
 * gets the edges wrong in one of the four cases, and saves nothing worth
 * having on lists of the size a person actually makes.
 */
export function reorderPlaylist(id: number, from: number, to: number, at: number): void {
  const database = db();
  database.withTransactionSync(() => {
    const ids = playlistTrackIds(id);
    if (from < 0 || from >= ids.length || to < 0 || to >= ids.length || from === to) return;

    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    write(id, ids);
    database.runSync(`UPDATE playlists SET updated_at = ? WHERE id = ?`, Math.round(at), id);
  });
}

/**
 * The first few tracks of every list at once, for drawing their covers.
 *
 * One query for the whole screen rather than one per list. The alternative is
 * a round trip per row, which on a screen that exists to show a dozen rows is
 * a dozen round trips before anything is drawn.
 */
export function coverTrackIds(each: number): Map<number, string[]> {
  const rows = db().getAllSync<{ playlist_id: number; track_id: string }>(
    `SELECT playlist_id, track_id FROM playlist_tracks
     WHERE position < ? ORDER BY playlist_id, position`,
    each
  );

  const byList = new Map<number, string[]>();
  for (const row of rows) {
    const held = byList.get(row.playlist_id);
    if (held) held.push(row.track_id);
    else byList.set(row.playlist_id, [row.track_id]);
  }
  return byList;
}

/**
 * Drops tracks that are no longer on the phone.
 *
 * Membership is stored by media store id, and an id stops resolving once its
 * file is deleted. Called with the library that was just scanned, so a list
 * does not quietly accumulate entries that can never play.
 */
export function forgetMissingTracks(present: Set<string>): void {
  const database = db();
  const rows = database.getAllSync<{ playlist_id: number; track_id: string }>(
    `SELECT playlist_id, track_id FROM playlist_tracks`
  );
  const gone = rows.filter((row) => !present.has(row.track_id));
  if (gone.length === 0) return;

  database.withTransactionSync(() => {
    for (const row of gone) {
      database.runSync(
        `DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`,
        row.playlist_id,
        row.track_id
      );
    }
    for (const id of new Set(gone.map((row) => row.playlist_id))) renumber(id);
  });
}

/** Rewrites positions as 0..n-1 in the order currently held. */
function renumber(id: number): void {
  write(id, playlistTrackIds(id));
}

function write(id: number, ids: string[]): void {
  const database = db();
  ids.forEach((trackId, position) => {
    database.runSync(
      `UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?`,
      position,
      id,
      trackId
    );
  });
}
