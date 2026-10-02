package expo.modules.jukeboxaudio.auto

import android.content.Context
import android.database.sqlite.SQLiteDatabase

/**
 * The app's own database, read from the service.
 *
 * Everything the car needs to show — which folder the library is, what the
 * lists are called, which record a track belongs to — is written by the
 * JavaScript half of the app into `jukebox.db`. The car does not start that
 * half: a head unit connects to the media service and nothing else, so the
 * service has to read the file itself.
 *
 * Read-only in practice, though opened for writing: the file is kept in
 * write-ahead logging mode, and a strictly read-only open of one of those
 * fails when the shared-memory file has to be created. Only SELECTs are issued
 * here, and SQLite is happy with two connections from one process.
 *
 * Nothing is cached. A browse in a car is a handful of queries against a few
 * hundred rows, and a cache would be a second copy of the library to keep in
 * step with a screen the driver cannot see.
 */
internal object LibraryDatabase {
  /**
   * Where expo-sqlite keeps it, which is not where Android keeps databases.
   *
   * `getDatabasePath` answers with `databases/`, and that is where a database
   * opened by the platform would live. Expo puts its own under the documents
   * directory instead. Looking in the wrong one is not an error — it is an
   * empty car, which is how this was found.
   */
  private fun file(context: Context) = java.io.File(context.filesDir, "SQLite/jukebox.db")

  private fun <T> read(context: Context, fallback: T, body: (SQLiteDatabase) -> T): T =
    runCatching {
      val target = file(context)
      if (!target.isFile) return fallback
      SQLiteDatabase.openDatabase(target.path, null, SQLiteDatabase.OPEN_READWRITE).use(body)
    }.getOrDefault(fallback)

  /** The folder the library is read from, defaulting the way the app does. */
  fun libraryRoot(context: Context): String = read(context, "Music") { database ->
    database.rawQuery("SELECT value FROM settings WHERE key = 'library:root'", null).use {
      if (it.moveToFirst()) it.getString(0) else "Music"
    }
  }

  data class Playlist(val id: Long, val name: String, val trackCount: Int)

  /*
    A list is either one somebody filled by hand or one that stands for a tag,
    and the two keep their members in different places: the first in
    `playlist_tracks`, the second in `track_tags`, matched by the list's tag.
    Counting only the first is what made every tag-backed list show up in the
    car as empty — the app's own screens have always taken both branches.
  */
  fun playlists(context: Context): List<Playlist> = read(context, emptyList()) { database ->
    database.rawQuery(
      """SELECT p.id, p.name,
                CASE WHEN p.tag IS NULL
                  THEN (SELECT COUNT(*) FROM playlist_tracks t WHERE t.playlist_id = p.id)
                  ELSE (SELECT COUNT(*) FROM track_tags g WHERE g.tag = p.tag)
                END
         FROM playlists p ORDER BY p.updated_at DESC, p.id DESC""",
      null
    ).use { cursor ->
      buildList {
        while (cursor.moveToNext()) {
          add(Playlist(cursor.getLong(0), cursor.getString(1), cursor.getInt(2)))
        }
      }
    }
  }

  fun playlistTrackIds(context: Context, id: Long): List<String> =
    read(context, emptyList()) { database ->
      database.rawQuery(
        """SELECT COALESCE(t.track_id, g.track_id) FROM playlists p
             LEFT JOIN playlist_tracks t ON p.tag IS NULL AND t.playlist_id = p.id
             LEFT JOIN track_tags g ON p.tag IS NOT NULL AND g.tag = p.tag
           WHERE p.id = ?
             AND COALESCE(t.track_id, g.track_id) IS NOT NULL
           ORDER BY COALESCE(t.position, g.position)""",
        arrayOf(id.toString())
      ).use { cursor ->
        buildList { while (cursor.moveToNext()) add(cursor.getString(0)) }
      }
    }

  /**
   * Tracks in the order they were last listened to, most recent first.
   *
   * The listening history is the app's own, written whenever a play counts as
   * one, and it is what makes a car useful: the thing a driver reaches for
   * first is almost always the thing they were playing yesterday.
   */
  fun recentlyPlayed(context: Context, limit: Int): List<String> =
    read(context, emptyList()) { database ->
      database.rawQuery(
        """SELECT track_id, MAX(started_at) AS last FROM plays
           GROUP BY track_id ORDER BY last DESC LIMIT ?""",
        arrayOf(limit.toString())
      ).use { cursor ->
        buildList { while (cursor.moveToNext()) add(cursor.getString(0)) }
      }
    }

  /** Tracks by how often they have been listened to, the most first. */
  fun mostPlayed(context: Context, limit: Int): List<String> =
    read(context, emptyList()) { database ->
      database.rawQuery(
        """SELECT track_id, COUNT(*) AS plays FROM plays
           GROUP BY track_id ORDER BY plays DESC, MAX(started_at) DESC LIMIT ?""",
        arrayOf(limit.toString())
      ).use { cursor ->
        buildList { while (cursor.moveToNext()) add(cursor.getString(0)) }
      }
    }

  /**
   * Each track that names a record, and what it names.
   *
   * One query for the lot rather than one per record: the grouping is done in
   * memory against the library that has already been read, which is the only
   * way to leave out records whose files are no longer on the phone.
   */
  fun albumsByTrack(context: Context): Map<String, String> =
    read(context, emptyMap()) { database ->
      database.rawQuery(
        "SELECT track_id, album FROM track_metadata WHERE album IS NOT NULL AND album <> ''",
        null
      ).use { cursor ->
        buildMap { while (cursor.moveToNext()) put(cursor.getString(0), cursor.getString(1)) }
      }
    }

  /** Where each track sits on its record, for putting one in order. */
  fun positionsByTrack(context: Context): Map<String, Int> =
    read(context, emptyMap()) { database ->
      database.rawQuery(
        "SELECT track_id, track_number FROM track_metadata WHERE track_number IS NOT NULL",
        null
      ).use { cursor ->
        buildMap { while (cursor.moveToNext()) put(cursor.getString(0), cursor.getInt(1)) }
      }
    }
}
