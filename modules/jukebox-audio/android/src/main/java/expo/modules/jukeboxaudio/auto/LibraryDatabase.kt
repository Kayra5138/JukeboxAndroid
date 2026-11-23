package expo.modules.jukeboxaudio.auto

import android.content.Context
import android.database.sqlite.SQLiteDatabase

/**
 * What the app knows about the library, read from the service.
 *
 * Everything the car needs to show — which folder the library is, what the
 * lists are called, which record a track belongs to — is written by the
 * JavaScript half of the app into `jukebox.db`. The car does not start that
 * half: a head unit connects to the media service and nothing else, so the
 * service has to read for itself.
 *
 * It does not read that file. It reads a copy the other half writes out for
 * it, `car.db`, and the reason is worth keeping in front of anybody who thinks
 * of going back. This opens with Android's SQLite. The other half writes with
 * the SQLite that expo-sqlite carries. Two copies of SQLite in one process do
 * not see each other's locks, so this one took itself to be alone with the
 * file, and on closing it folded the write-ahead log away and deleted it —
 * from under a connection that was still writing to it. Every write after
 * that went to a file with no name and was lost when the app next stopped.
 * It was reproduced on a desk with the two libraries and a ten-line program:
 * one read from here, and nothing written afterwards survived.
 *
 * The copy is a plain database nobody else has open, replaced whole by a
 * rename, and opened read-only. It can be a minute behind. It cannot lose
 * anything.
 *
 * Nothing is cached. A browse in a car is a handful of queries against a few
 * hundred rows, and a cache would be a third copy of the library to keep in
 * step with a screen the driver cannot see.
 */
internal object LibraryDatabase {
  /**
   * Where expo-sqlite keeps its databases, which is not where Android does.
   *
   * `getDatabasePath` answers with `databases/`, and that is where a database
   * opened by the platform would live. Expo puts its own under the documents
   * directory instead, and the copy is written beside it.
   */
  private fun folder(context: Context) = java.io.File(context.filesDir, "SQLite")

  private fun file(context: Context) = java.io.File(folder(context), "car.db")

  /**
   * Puts a newly written copy in place of the old one.
   *
   * Renamed rather than copied: a rename within one folder happens at once,
   * so a read that is under way keeps the old file to the end and the next
   * one opens the new. False where there was no new copy waiting.
   */
  fun adopt(context: Context): Boolean {
    val next = java.io.File(folder(context), "car.next.db")
    if (!next.isFile) return false
    // Whatever the writer left beside it belongs to a file that is moving.
    java.io.File(folder(context), "car.next.db-journal").delete()
    return next.renameTo(file(context))
  }

  /**
   * Which copy is in place, in a few characters: it is replaced whole (see
   * [adopt]), so a new one has a new date. For what is worked out from it
   * and kept, to know when to work it out again.
   */
  fun version(context: Context): String {
    val target = file(context)
    return "${target.lastModified()}:${target.length()}"
  }

  private fun <T> read(context: Context, fallback: T, body: (SQLiteDatabase) -> T): T =
    runCatching {
      val target = file(context)
      if (!target.isFile) return fallback
      SQLiteDatabase.openDatabase(target.path, null, SQLiteDatabase.OPEN_READONLY).use(body)
    }.getOrDefault(fallback)

  /** What the app knows of a song beyond what its file says: see [described]. */
  data class Described(val title: String?, val artist: String?, val album: String?, val albumArtist: String?, val genre: String?)

  /**
   * A song as a lookup or a hand left it, and its genre the way the app has
   * it: the one written down for it, or else the first of its tags. Null
   * where the copy has nothing on it.
   */
  fun described(context: Context, trackId: String): Described? = read(context, null as Described?) { database ->
    fun row(columns: String) = database.rawQuery(
      "SELECT $columns FROM track_metadata WHERE track_id = ? AND status != 'not_found'",
      arrayOf(trackId)
    ).use { cursor -> if (cursor.moveToFirst()) Array(cursor.columnCount) { cursor.getString(it) } else null }
    // A copy made before the genre went across has no such column.
    val found = runCatching { row("title, artist, album, album_artist, genre") }.getOrElse { row("title, artist, album, album_artist") }
    val tag = database.rawQuery("SELECT tag FROM track_tags WHERE track_id = ? ORDER BY position LIMIT 1", arrayOf(trackId))
      .use { if (it.moveToFirst()) it.getString(0) else null }
    if (found == null && tag == null) return@read null
    fun given(text: String?) = text?.takeIf { it.isNotBlank() }
    Described(given(found?.getOrNull(0)), given(found?.getOrNull(1)), given(found?.getOrNull(2)), given(found?.getOrNull(3)),
      given(found?.getOrNull(4)) ?: given(tag))
  }

  /** The folder the library is read from, defaulting the way the app does. */
  fun libraryRoot(context: Context): String = read(context, "Music") { database ->
    database.rawQuery("SELECT value FROM settings WHERE key = 'library:root'", null).use {
      if (it.moveToFirst()) it.getString(0) else "Music"
    }
  }

  /**
   * What the library leaves out of that folder, as the phone set it: see
   * [LibraryHiding]. Nothing left out where the copy says nothing, or cannot
   * be read, which is how the phone reads an absent setting too.
   */
  fun hiding(context: Context): LibraryHiding {
    val root = libraryRoot(context)
    val (leftOut, shortest) = read(context, emptyList<String>() to 0) { database ->
      database.rawQuery(
        "SELECT key, value FROM settings WHERE key IN ('library:leftOut', 'library:shortest')", null
      ).use { cursor ->
        var folders = emptyList<String>()
        var seconds = 0
        while (cursor.moveToNext()) {
          val value = cursor.getString(1) ?: continue
          when (cursor.getString(0)) {
            "library:leftOut" -> folders = runCatching {
              val list = org.json.JSONArray(value)
              (0 until list.length()).mapNotNull { list.optString(it, "").takeIf(String::isNotBlank) }
            }.getOrDefault(emptyList())
            "library:shortest" -> seconds = value.toIntOrNull() ?: 0
          }
        }
        folders to seconds
      }
    }
    return LibraryHiding(root, leftOut, shortest)
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
   * What the app's shuffle button plays, as the app worked it out and wrote
   * into the copy (`src/lib/db/carCopy.ts`): the songs of the list it plays,
   * in the list's order, none for everything; and what the button says, the
   * car's tile in words and the widget's beside its icon, null for the icon
   * alone. Null where the copy has none of it -- before the app has read its
   * library, or written by an app from before -- and then everything is
   * shuffled, under the words the car always had.
   */
  data class Shuffle(val ids: List<String>, val carTitle: String, val widgetText: String?)

  fun shuffle(context: Context): Shuffle? = read(context, null) { database ->
    val words = wordsOf(database) ?: return@read null
    val ids = database.rawQuery("SELECT track_id FROM shuffle_tracks ORDER BY position", null).use { cursor ->
      buildList { while (cursor.moveToNext()) add(cursor.getString(0)) }
    }
    Shuffle(ids, words.carTitle, words.widgetText)
  }

  /** What the shuffle button says, without the songs it plays: [Shuffle], for what shows only its words. */
  data class ShuffleWords(val carTitle: String, val widgetText: String?)

  fun shuffleWords(context: Context): ShuffleWords? = read(context, null) { wordsOf(it) }

  private fun wordsOf(database: SQLiteDatabase): ShuffleWords? =
    database.rawQuery("SELECT car_title, widget_text FROM shuffle_words", null).use { cursor ->
      if (cursor.moveToFirst()) ShuffleWords(cursor.getString(0) ?: "", if (cursor.isNull(1)) null else cursor.getString(1)) else null
    }

  /**
   * The songs set aside on the phone, by id: kept out of the car's Tracks and
   * of shuffling everything, as they are out of the phone's. Worked out by the
   * app, which files songs under records and artists as it alone can. None
   * where the copy is from before there was any setting aside, or cannot be
   * read.
   */
  fun setAside(context: Context): Set<String> = read(context, emptySet()) { database ->
    database.rawQuery("SELECT track_id FROM set_aside_tracks", null).use { cursor ->
      buildSet { while (cursor.moveToNext()) add(cursor.getString(0)) }
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

  /**
   * The shows followed, as the name each keeps for its folder of the Tapes
   * folder to the name it is shown by. None where the copy has none, which
   * a copy written by an app from before the car showed tapes does not: the
   * car then shows a show's folder as a folder of tapes, and nothing worse.
   */
  fun followed(context: Context): List<Pair<String, String>> =
    read(context, emptyList()) { database ->
      database.rawQuery("SELECT title, folder FROM podcasts", null).use { cursor ->
        buildList {
          while (cursor.moveToNext()) {
            val title = cursor.getString(0) ?: continue
            add((cursor.getString(1)?.takeIf { it.isNotBlank() } ?: title) to title)
          }
        }
      }
    }

  /** How often each track has been listened to, and when it last was. */
  fun plays(context: Context): Map<String, Pair<Int, Long>> =
    read(context, emptyMap()) { database ->
      database.rawQuery(
        "SELECT track_id, COUNT(*), MAX(started_at) FROM plays GROUP BY track_id", null
      ).use { cursor ->
        buildMap { while (cursor.moveToNext()) put(cursor.getString(0), cursor.getInt(1) to cursor.getLong(2)) }
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
   * What the app knows about each track beyond what its file says.
   *
   * One query for the lot rather than one per track. A track that was looked
   * for and not found is left out: a note that nothing was found says nothing
   * about the track.
   */
  fun kept(context: Context): Map<String, Kept> =
    read(context, emptyMap()) { database ->
      // A copy written before the album artist was carried has no such
      // column, and asking for it would lose every correction with it.
      val albumArtist = runCatching {
        database.rawQuery("SELECT album_artist FROM track_metadata LIMIT 0", null).close()
      }.isSuccess
      database.rawQuery(
        """SELECT track_id, status, title, artist, album, track_number
                  ${if (albumArtist) ", album_artist" else ""}
           FROM track_metadata WHERE status != 'not_found'""",
        null
      ).use { cursor ->
        buildMap {
          while (cursor.moveToNext()) {
            put(
              cursor.getString(0),
              Kept(
                manual = cursor.getString(1) == "manual",
                title = cursor.getString(2),
                artist = cursor.getString(3),
                album = cursor.getString(4),
                position = if (cursor.isNull(5)) null else cursor.getInt(5),
                albumArtist = if (albumArtist && !cursor.isNull(6)) cursor.getString(6) else null
              )
            )
          }
        }
      }
    }

  /**
   * The tracks the app keeps a cover of its own for — on their row, or given
   * by the rest of their record — read at once for a whole shelf of records.
   */
  fun covered(context: Context): Set<String> = read(context, emptySet()) { database ->
    buildSet {
      database.rawQuery(
        "SELECT track_id FROM track_metadata WHERE status != 'not_found' AND artwork_url LIKE 'file://%'",
        null
      ).use { while (it.moveToNext()) add(it.getString(0)) }
      runCatching {
        database.rawQuery(
          """SELECT s.track_id FROM shared_covers s
             WHERE NOT EXISTS (SELECT 1 FROM track_metadata m
                               WHERE m.track_id = s.track_id AND m.cover_removed_at IS NOT NULL)""",
          null
        ).use { while (it.moveToNext()) add(it.getString(0)) }
      }
    }
  }

  /**
   * The cover the app keeps for a track, as an address, or null.
   *
   * What a lookup found or somebody picked from their gallery, which is most
   * covers: files that arrive without a picture inside them get theirs this
   * way. Usually a `file://` in the app's own folder. Sometimes still the web
   * address the catalogue gave, where the picture has not been fetched yet;
   * the phone's screens show those straight from the web, so they count.
   */
  fun cover(context: Context, trackId: String): String? = read(context, null as String?) { database ->
    val own = database.rawQuery(
      """SELECT artwork_url FROM track_metadata
         WHERE track_id = ? AND status != 'not_found' AND artwork_url IS NOT NULL AND artwork_url <> ''""",
      arrayOf(trackId)
    ).use { if (it.moveToFirst()) it.getString(0) else null }
    if (own != null && own.startsWith("file://")) return@read own
    // The cover the rest of its record gave it, where it has no row of its
    // own to hold one; a copy from before those were kept has no such table.
    val shared = runCatching {
      database.rawQuery(
        """SELECT artwork_url FROM shared_covers WHERE track_id = ?
           AND NOT EXISTS (SELECT 1 FROM track_metadata WHERE track_id = ? AND cover_removed_at IS NOT NULL)""",
        arrayOf(trackId, trackId)
      ).use { if (it.moveToFirst()) it.getString(0) else null }
    }.getOrNull()
    shared ?: own
  }
}
