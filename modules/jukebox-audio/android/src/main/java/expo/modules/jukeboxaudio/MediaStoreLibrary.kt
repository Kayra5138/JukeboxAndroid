package expo.modules.jukeboxaudio

import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import java.io.File

private val COLLECTION: Uri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)

/**
 * Reads the device music library straight out of the media store.
 *
 * Files are selected by *path* rather than by the `IS_MUSIC` column. That column
 * looks like the obvious filter but is not trustworthy: WhatsApp voice notes are
 * flagged `IS_MUSIC = 1`, and on a normal phone there are thousands of them. A
 * path prefix is predictable — everything under `Music/`, nothing else — and it
 * recurses into subfolders, which the bucket/album model cannot express.
 */
object MediaStoreLibrary {
  private val PROJECTION = arrayOf(
    MediaStore.Audio.Media._ID,
    MediaStore.Audio.Media.TITLE,
    MediaStore.Audio.Media.ARTIST,
    MediaStore.Audio.Media.ALBUM,
    MediaStore.Audio.Media.DURATION,
    MediaStore.Audio.Media.TRACK,
    MediaStore.Audio.Media.DISPLAY_NAME,
    MediaStore.Audio.Media.RELATIVE_PATH,
    // Unlike DATE_MODIFIED below, this one is read for every row of the scan.
    // It is the only record anywhere of when a file arrived — nothing the app
    // writes down remembers it, and by the time a track is first played it is
    // far too late to start — so a library that can be ordered by what is new
    // has to carry it from here.
    MediaStore.Audio.Media.DATE_ADDED
  )

  /**
   * `%` and `_` are wildcards inside LIKE and folder names are allowed to
   * contain both, so `Live_Sets` would otherwise also match `Live Sets`.
   */
  private fun escapeLike(value: String): String =
    value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

  private val UNDER_FOLDER = "${MediaStore.Audio.Media.RELATIVE_PATH} LIKE ? ESCAPE '\\'"

  /**
   * RELATIVE_PATH values keep their trailing slash ("Music/x d/"), and a bare
   * "Music/" has to match too, so the wildcard has to allow zero characters.
   */
  private fun underFolderArg(rootFolder: String): String =
    "${escapeLike(rootFolder.trim('/'))}/%"

  /**
   * @param rootFolder a media store relative path such as `Music`. Matched as a
   *   prefix, so `Music` also returns everything in `Music/Artist/Album`.
   */
  fun queryTracks(context: Context, rootFolder: String): List<Map<String, Any?>> {
    val sortOrder = listOf(
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.TRACK,
      MediaStore.Audio.Media.TITLE
    ).joinToString(", ") { "$it COLLATE NOCASE ASC" }

    val tracks = mutableListOf<Map<String, Any?>>()

    context.contentResolver.query(
      COLLECTION,
      PROJECTION,
      UNDER_FOLDER,
      arrayOf(underFolderArg(rootFolder)),
      sortOrder
    )?.use { cursor ->
      val row = TrackRow(cursor)
      while (cursor.moveToNext()) {
        tracks.add(row.read())
      }
    }

    return tracks
  }

  /**
   * One track by media store id, or null when there is no such row.
   *
   * [rootFolder] is applied here exactly as it is in [queryTracks], so a track
   * the library does not cover comes back as null rather than as a row: a
   * lookup that could reach outside the chosen root would resolve tracks the
   * library never listed.
   */
  fun queryTrack(context: Context, trackId: String, rootFolder: String): Map<String, Any?>? {
    val id = trackId.toLongOrNull() ?: return null

    return context.contentResolver.query(
      COLLECTION,
      PROJECTION,
      "${MediaStore.Audio.Media._ID} = ? AND $UNDER_FOLDER",
      arrayOf(id.toString(), underFolderArg(rootFolder)),
      null
    )?.use { cursor ->
      if (cursor.moveToFirst()) TrackRow(cursor).read() else null
    }
  }

  /**
   * The cover stored inside the file itself, written to the cache and returned
   * as a file uri.
   *
   * Extraction opens and parses the file, so it is deliberately not part of the
   * library scan — the result is cached and only fetched for tracks actually
   * being shown.
   */
  fun embeddedArtwork(context: Context, trackId: String): String? {
    val id = trackId.toLongOrNull() ?: return null
    val cacheDir = File(context.cacheDir, "artwork")
    if (!cacheDir.isDirectory && !cacheDir.mkdirs()) return null

    // The media store keeps a row's `_ID` when the file behind it is rewritten
    // in place, so an entry keyed on the id alone could never go stale: tag a
    // cover onto a file with another app and the miss marker below would hide
    // it for good, and a replaced cover would keep serving the old one. Naming
    // the entry after the modification time retires it instead.
    //
    // DATE_MODIFIED is asked for here rather than added to PROJECTION because
    // no track field is derived from it, and PROJECTION is what the library
    // scan reads for every row on the device; this is one indexed lookup, made
    // only for a cover actually being drawn.
    val modified = dateModified(context, id)

    val cached = File(cacheDir, "$id-$modified.jpg")
    if (cached.exists()) return Uri.fromFile(cached).toString()
    // Files with no cover are remembered too, under a name that cannot be
    // mistaken for a half-written jpg. Without the marker every cold start
    // would reopen and reparse the whole file to learn the same nothing.
    val miss = File(cacheDir, "$id-$modified.none")
    if (miss.exists()) return null

    // Anything cached for an earlier revision of this track is dead weight now.
    // `.part` files are left alone: they belong to extractions still running,
    // and pulling one out from under its writer would fail that writer's
    // rename for no reason. This revision's own names are excluded for a
    // sharper reason — two threads routinely extract the same cover at once
    // (see the note below), and without the exclusion the one that arrived
    // second would delete the entry the first had already handed to the image
    // loader, leaving a permanently blank cover.
    runCatching {
      cacheDir.listFiles { file ->
        file.name.startsWith("$id-") &&
          file.name != cached.name && file.name != miss.name &&
          (file.name.endsWith(".jpg") || file.name.endsWith(".none"))
      }?.forEach { it.delete() }
    }

    // The other thread may have published while the sweep ran.
    if (cached.exists()) return Uri.fromFile(cached).toString()

    val uri = ContentUris.withAppendedId(COLLECTION, id)
    val picture = MediaMetadataRetriever().use { retriever ->
      runCatching {
        retriever.setDataSource(context, uri)
        retriever.embeddedPicture
      }.getOrNull()
    }

    if (picture == null) {
      runCatching { miss.createNewFile() }
      return null
    }

    // Written aside and renamed, because a crash part way through a direct
    // write leaves a truncated jpg that `exists()` then vouches for forever.
    //
    // The scratch name is unique per call rather than derived from the id.
    // Extraction runs on a thread pool, and the same cover is routinely asked
    // for by two components at once — a shared scratch file would have each
    // truncating what the other is still writing, and whichever rename won
    // would publish a permanently corrupt jpg. Two winners racing to rename
    // over each other is harmless by comparison: the bytes are identical.
    return runCatching {
      val part = File.createTempFile("art-$id-", ".jpg.part", cacheDir)
      try {
        part.writeBytes(picture)
        if (part.renameTo(cached)) Uri.fromFile(cached).toString() else null
      } finally {
        part.delete()
      }
    }.getOrNull()
  }

  /**
   * What one track is called, without reading the rest of the library.
   *
   * One indexed lookup, for the tile a song with no artwork is drawn. Scanning
   * every row to learn a single title would cost more than the picture it is
   * for, and this is asked only when a cover is actually missing.
   */
  fun titleOf(context: Context, trackId: String): String? {
    val id = trackId.toLongOrNull() ?: return null
    return context.contentResolver.query(
      COLLECTION,
      arrayOf(MediaStore.Audio.Media.TITLE, MediaStore.Audio.Media.DISPLAY_NAME),
      "${MediaStore.Audio.Media._ID} = ?",
      arrayOf(id.toString()),
      null
    )?.use { cursor ->
      if (!cursor.moveToFirst()) null
      else cursor.getStringOrNull(0)?.takeIf { it.isNotBlank() } ?: cursor.getStringOrNull(1)
    }
  }

  /**
   * When the media store last saw the file change, in seconds, or -1 when it
   * will not say — in which case the artwork cache falls back to being keyed on
   * the id alone, which is what it did before.
   */
  private fun dateModified(context: Context, id: Long): Long =
    context.contentResolver.query(
      COLLECTION,
      arrayOf(MediaStore.Audio.Media.DATE_MODIFIED),
      "${MediaStore.Audio.Media._ID} = ?",
      arrayOf(id.toString()),
      null
    )?.use { cursor ->
      if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else -1L
    } ?: -1L

  /**
   * Folders under [rootFolder] that hold at least one track, with how many each
   * holds, busiest first — the order the folder chooser lists them in.
   *
   * Only the path column is read: this is the one query in here that does not
   * want a track's metadata, and asking for all eight columns of every row in
   * the library to then keep one of them is what made calling this from
   * JavaScript not worth doing. The counting is done here rather than by the
   * provider because the media store validates the projection against its own
   * column list, so neither COUNT(*) nor a GROUP BY survives the trip.
   *
   * Trailing slashes are dropped, because the paths come back out as a library
   * root and a root is stored without one.
   */
  fun queryFolders(context: Context, rootFolder: String): List<Map<String, Any?>> {
    val counts = mutableMapOf<String, Int>()

    context.contentResolver.query(
      COLLECTION,
      arrayOf(MediaStore.Audio.Media.RELATIVE_PATH),
      UNDER_FOLDER,
      arrayOf(underFolderArg(rootFolder)),
      null
    )?.use { cursor ->
      val pathColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.RELATIVE_PATH)
      while (cursor.moveToNext()) {
        val path = cursor.getStringOrNull(pathColumn)?.trimEnd('/') ?: continue
        counts[path] = (counts[path] ?: 0) + 1
      }
    }

    // Ties broken by path so that two folders of the same size do not swap
    // places between one visit to the chooser and the next.
    return counts.entries
      .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
      .map { mapOf("path" to it.key, "trackCount" to it.value) }
  }
}

/**
 * Turns the rows of a library cursor into the shape the JavaScript side reads,
 * so that the one-track lookup and the whole-library scan cannot drift apart.
 *
 * The indices are resolved once for the cursor rather than once per row:
 * [MediaStoreLibrary.queryTracks] runs this over every track on the device, and
 * getColumnIndexOrThrow is a scan of the column names each time it is called.
 */
private class TrackRow(private val cursor: Cursor) {
  private val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
  private val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
  private val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
  private val albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
  private val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
  private val trackColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
  private val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
  private val pathColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.RELATIVE_PATH)
  private val addedColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)

  /**
   * The name of the folder a track sits in, which is what the media store
   * reaches for when a file carries no album tag of its own.
   */
  private fun containingFolder(): String? =
    cursor.getStringOrNull(pathColumn)?.trim('/')?.substringAfterLast('/')

  /**
   * Rejects a value the media store made up out of the folder name.
   *
   * An untagged file is not left blank: the album is filled in with the
   * directory holding it, and with a library kept in one folder that means
   * every song claims an album named after it — `Music` next to every artist,
   * and one album swallowing the whole collection. A folder is not an album,
   * so a value that only repeats it is no value at all.
   */
  private fun tagged(value: String?): String? {
    if (value == null || value == MediaStore.UNKNOWN_STRING) return null
    return value.takeUnless { it.equals(containingFolder(), ignoreCase = true) }
  }

  fun read(): Map<String, Any?> {
    val id = cursor.getLong(idColumn)

    return mapOf(
      "id" to id.toString(),
      "uri" to ContentUris.withAppendedId(COLLECTION, id).toString(),
      "title" to (cursor.getStringOrNull(titleColumn) ?: cursor.getStringOrNull(nameColumn) ?: "Unknown"),
      "artist" to tagged(cursor.getStringOrNull(artistColumn)),
      "album" to tagged(cursor.getStringOrNull(albumColumn)),
      // Deliberately never filled in. The media store's `albumart` provider was
      // never public API and stopped resolving around Android 10, so every value
      // it produced was a broken image; [MediaStoreLibrary.embeddedArtwork] is
      // the one path that works.
      "artworkUri" to null,
      // The media store reports duration in milliseconds.
      "durationSec" to cursor.getLong(durationColumn) / 1000.0,
      // TRACK encodes disc and track as disc * 1000 + track when a disc is known.
      "trackNumber" to cursor.getIntOrNull(trackColumn)?.let { if (it > 1000) it % 1000 else it },
      "filename" to cursor.getStringOrNull(nameColumn),
      "folder" to cursor.getStringOrNull(pathColumn),
      // The media store counts this one in whole seconds while everything on
      // the JavaScript side counts in milliseconds, listening history included.
      // Converting here rather than there means there is one place where the
      // unit is known, instead of a number whose scale depends on where it came
      // from. Null rather than zero for a row the store will not date: a file it
      // cannot place in time is not a file from 1970.
      "addedAt" to cursor.getLongOrNull(addedColumn)?.times(1000)
    )
  }
}

private fun Cursor.getStringOrNull(index: Int): String? =
  if (isNull(index)) null else getString(index)?.takeIf { it.isNotBlank() }

private fun Cursor.getIntOrNull(index: Int): Int? =
  if (isNull(index)) null else getInt(index).takeIf { it > 0 }

private fun Cursor.getLongOrNull(index: Int): Long? =
  if (isNull(index)) null else getLong(index).takeIf { it > 0 }
