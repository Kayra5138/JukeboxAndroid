package expo.modules.jukeboxaudio.lists

import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.MimeTypeMap
import expo.modules.jukeboxaudio.R
import expo.modules.jukeboxaudio.Told
import expo.modules.jukeboxaudio.lyrics.EXTERNAL_STORAGE
import expo.modules.jukeboxaudio.lyrics.folderLabel
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

/**
 * The largest playlist that is read. Ten thousand entries of long paths come
 * to about two megabytes; this is twice that, and little enough that a film
 * picked by mistake is turned away rather than sent across the bridge.
 */
internal const val LARGEST_LIST = 4 * 1024 * 1024

/**
 * The largest of Spotify's files of playlists that is read, or of Apple's XML
 * of a library: a song is a few hundred bytes in the one and a kilobyte or
 * two in the other, so this is tens of thousands of songs, which a library
 * kept on a phone does not come near.
 */
internal const val LARGEST_SPOTIFY = 32 * 1024 * 1024

/** The largest playlist written as a table, Apple's in UTF-16 being twice the size of the text in it. */
internal const val LARGEST_TABLE = 16 * 1024 * 1024

/** The files in Spotify's zip that are playlists, of all the account's data in it: see `src/lib/playlists/spotify.ts`. */
private val SPOTIFY_LISTS = Regex("(?i)^(Playlist\\d*|YourLibrary)\\.json$")

/**
 * What the picker is asked to offer. Every name the playlist formats go by,
 * since which one a file manager or a cloud folder gives an `.m3u` depends on
 * who wrote its table of types; plain text for the ones that call it that,
 * and no type at all for a file that has come through a chat app and lost
 * its name for what it is. Whether it is a playlist is decided by reading it.
 */
private val LIST_TYPES = arrayOf(
  "audio/x-mpegurl",
  "audio/mpegurl",
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "text/plain",
  // Spotify's playlists, as the zip of the account's data or the file taken out of it.
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  // Apple's, as its Music app writes them out, and those of the services that move playlists between apps.
  "text/xml",
  "application/xml",
  "text/csv",
  "text/comma-separated-values",
  "text/tab-separated-values",
  "application/octet-stream"
)

/**
 * The type an `.m3u8` is saved as: whatever this phone's own table says that
 * ending is. The storage provider gives a new file the ending of its type
 * when the name's ending is not that type's, so a type of the app's choosing
 * that the phone files under another ending would come out as `Mix.m3u8.m3u`.
 * Asking the same table it asks keeps the name as given.
 */
internal fun listType(): String =
  MimeTypeMap.getSingleton().getMimeTypeFromExtension("m3u8") ?: "application/octet-stream"

/**
 * The media store row a document of the media store's own views stands for,
 * by its id: `audio:123`, `document:123`, `msf:123` from the Downloads view,
 * or the bare number. Null for an id that is a path or anything else.
 */
internal fun mediaRowId(documentId: String?): Long? {
  if (documentId == null) return null
  val number = documentId.substringAfter(':')
  val kind = documentId.substringBefore(':', "")
  if (kind.isNotEmpty() && kind !in setOf("audio", "document", "msf")) return null
  return number.toLongOrNull()
}

/** Choosing playlists to bring in, one or several at once. */
class ListFilesOpen : AppContextActivityResultContract<ListFilesOpen.Input, List<String>> {
  class Input : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType("*/*")
      .putExtra(Intent.EXTRA_MIME_TYPES, LIST_TYPES)
      .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): List<String> {
    if (resultCode != Activity.RESULT_OK || intent == null) return emptyList()
    val clips = intent.clipData
    if (clips != null && clips.itemCount > 0) {
      return (0 until clips.itemCount).mapNotNull { clips.getItemAt(it).uri?.toString() }
    }
    return listOfNotNull(intent.data?.toString())
  }
}

/** Asking where one playlist should be saved: the system's own "save as", as a backup is. */
class ListFileSave : AppContextActivityResultContract<ListFileSave.Input, String?> {
  class Input(val name: String) : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_CREATE_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType(listType())
      .putExtra(Intent.EXTRA_TITLE, input.name)

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): String? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.toString() else null
}

/**
 * Asking for a folder to save every list into.
 *
 * A folder rather than a zip of them. A zip would be one "save as" and no
 * folder grant, but nothing on a phone plays a playlist out of a zip: it
 * would have to be unpacked first, by hand, before any of it was of use.
 * Files written straight into a folder are seen by every other player on the
 * phone as they are. The grant is used at once and not kept.
 */
class ListFolderPick : AppContextActivityResultContract<ListFolderPick.Input, String?> {
  class Input : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      .putExtra(DocumentsContract.EXTRA_INITIAL_URI, DocumentsContract.buildDocumentUri(EXTERNAL_STORAGE, "primary:Music"))

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): String? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.toString() else null
}

/**
 * Reading playlists the user picked and writing the ones they export.
 *
 * Bytes go across as they are, in base64, and are made into text in
 * TypeScript (`src/lib/playlists/m3u/decode.ts`): what a playlist is written
 * in is a guess, and the guess is made where it is tested and where the
 * library is to hand to judge it by.
 */
internal object ListFiles {
  private val AUDIO: Uri = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
  private val FILES: Uri = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL)

  /**
   * One picked file: its name, what its address says about where it is, and
   * its bytes -- or why there are none, in a word JavaScript says in the
   * app's language. A zip of Spotify's account data is the playlists in it,
   * one apiece (see [spotifyZip]).
   */
  fun read(context: Context, picked: String): List<Map<String, Any?>> {
    val uri = Uri.parse(picked)
    val documentId = runCatching { if (DocumentsContract.isDocumentUri(context, uri)) DocumentsContract.getDocumentId(uri) else null }.getOrNull()
    val name = name(context, uri)
    val base = mapOf(
      "uri" to picked,
      "name" to name,
      "documentId" to documentId,
      "path" to path(context, uri, documentId)
    )
    if (isZip(context, uri)) return spotifyZip(context, uri, base)
    val ending = name?.substringAfterLast('.', "")?.lowercase()
    val largest = when (ending) {
      "json", "xml" -> LARGEST_SPOTIFY
      "txt", "csv", "tsv" -> LARGEST_TABLE
      else -> LARGEST_LIST
    }
    val bytes = runCatching {
      context.contentResolver.openInputStream(uri)?.use { stream ->
        bounded(stream, largest) ?: return listOf(base + ("problem" to "tooBig"))
      }
    }.getOrNull() ?: return listOf(base + ("problem" to "unreadable"))
    return listOf(base + ("bytes" to bytes))
  }

  /**
   * The playlists in a zip of Spotify's account data, a file each, under the
   * zip's own address. Only those are read: the zip holds the account's
   * payments, searches and addresses as well, and none of that is any
   * business of this app's. A zip with none of them is not a playlist.
   */
  private fun spotifyZip(context: Context, uri: Uri, base: Map<String, Any?>): List<Map<String, Any?>> {
    val found = runCatching {
      context.contentResolver.openInputStream(uri)?.buffered()?.use { stream ->
        val zip = java.util.zip.ZipInputStream(stream)
        val parts = mutableListOf<Map<String, Any?>>()
        while (true) {
          val entry = zip.nextEntry ?: break
          val entryName = entry.name.substringAfterLast('/')
          if (entry.isDirectory || !SPOTIFY_LISTS.matches(entryName)) continue
          val bytes = bounded(zip, LARGEST_SPOTIFY)
          parts += base + mapOf("name" to entryName, "documentId" to null, "path" to null) +
            (if (bytes == null) mapOf("problem" to "tooBig") else mapOf("bytes" to bytes))
        }
        parts
      }
    }.getOrNull()
    return if (found.isNullOrEmpty()) listOf(base + ("problem" to "unreadable")) else found
  }

  /** At most [largest] bytes of [stream], in base64; null where there are more. */
  private fun bounded(stream: java.io.InputStream, largest: Int): String? {
    val out = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(64 * 1024)
    while (true) {
      val got = stream.read(buffer)
      if (got < 0) break
      out.write(buffer, 0, got)
      if (out.size() > largest) return null
    }
    return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }

  /** A zip begins `PK` and two bytes that say what follows. */
  private fun isZip(context: Context, uri: Uri): Boolean = runCatching {
    context.contentResolver.openInputStream(uri)?.use { stream ->
      val head = ByteArray(4)
      var filled = 0
      while (filled < head.size) {
        val got = stream.read(head, filled, head.size - filled)
        if (got < 0) break
        filled += got
      }
      filled == 4 && head[0] == 'P'.code.toByte() && head[1] == 'K'.code.toByte() && head[2] == 3.toByte() && head[3] == 4.toByte()
    }
  }.getOrNull() == true

  private fun name(context: Context, uri: Uri): String? = runCatching {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    }
  }.getOrNull() ?: uri.lastPathSegment

  /**
   * Where the file is on the phone, for a document of the media store's own
   * views, whose address does not say. Asked of the media store by the row
   * the document stands for; null wherever it will not answer, which for a
   * playlist made by another app it often will not.
   */
  private fun path(context: Context, uri: Uri, documentId: String?): String? {
    if (uri.authority == EXTERNAL_STORAGE) return null
    val row = mediaRowId(documentId) ?: return null
    return runCatching {
      context.contentResolver.query(
        ContentUris.withAppendedId(FILES, row),
        arrayOf(MediaStore.MediaColumns.DATA),
        null, null, null
      )?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
    }.getOrNull()
  }

  /**
   * The whole path of every track under [rootFolder], by media store id, and
   * the path of the phone's own storage.
   *
   * The media store's `DATA` column, which an app may no longer write to but
   * may still read for the songs it can see. It is the one thing that names a
   * song on a memory card as a path another player understands: the relative
   * path the library is read by is the same on every volume.
   */
  fun trackPaths(context: Context, rootFolder: String): Map<String, Any?> {
    val paths = mutableMapOf<String, String>()
    runCatching {
      context.contentResolver.query(
        AUDIO,
        arrayOf(MediaStore.Audio.Media._ID, MediaStore.MediaColumns.DATA),
        "${MediaStore.Audio.Media.RELATIVE_PATH} LIKE ? ESCAPE '\\'",
        arrayOf("${escapeLike(rootFolder.trim('/'))}/%"),
        null
      )?.use { cursor ->
        while (cursor.moveToNext()) {
          val data = if (cursor.isNull(1)) null else cursor.getString(1)
          if (!data.isNullOrEmpty()) paths[cursor.getLong(0).toString()] = data
        }
      }
    }
    return mapOf(
      "primary" to Environment.getExternalStorageDirectory().absolutePath,
      "paths" to paths
    )
  }

  /** As the library's own query escapes a folder: `%` and `_` are wildcards in LIKE and allowed in names. */
  private fun escapeLike(value: String): String =
    value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

  /**
   * Writes [text] into [target]. A file made for it and left half-written is
   * removed, since it would look like a playlist; one that was already there
   * is left, as its old self is still worth more than nothing.
   */
  fun write(context: Context, target: String, text: String, made: Boolean = true) {
    val uri = Uri.parse(target)
    try {
      val out = context.contentResolver.openOutputStream(uri, "wt")
        ?: throw Told(R.string.jukebox_file_not_writable)
      out.use { it.write(text.toByteArray(Charsets.UTF_8)) }
    } catch (trouble: Exception) {
      if (made) runCatching { DocumentsContract.deleteDocument(context.contentResolver, uri) }
      throw trouble
    }
  }

  /**
   * Writes each of [names] with its text into the folder [tree], replacing a
   * file of the same name already there, and answers how many were written,
   * the names of any that were not, and what the folder is called.
   *
   * Replaced rather than written beside: exporting every list again after
   * changing some is the ordinary thing to do, and the provider's own answer
   * to a name that is taken -- `Mix (1).m3u8` -- would leave the folder
   * holding last week's playlists beside this week's, with nothing to say
   * which is which.
   */
  fun writeAll(context: Context, tree: String, names: List<String>, texts: List<String>): Map<String, Any?> {
    val treeUri = Uri.parse(tree)
    val top = DocumentsContract.getTreeDocumentId(treeUri)
    val parent = DocumentsContract.buildDocumentUriUsingTree(treeUri, top)
    val existing = mutableMapOf<String, String>()
    runCatching {
      context.contentResolver.query(
        DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, top),
        arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME),
        null, null, null
      )?.use { cursor ->
        while (cursor.moveToNext()) {
          val name = cursor.getString(1) ?: continue
          existing[name.lowercase()] = cursor.getString(0)
        }
      }
    }
    var written = 0
    val failed = mutableListOf<String>()
    names.zip(texts).forEach { (name, text) ->
      val done = runCatching {
        val there = existing[name.lowercase()]?.let { DocumentsContract.buildDocumentUriUsingTree(treeUri, it) }
        val document = there
          ?: DocumentsContract.createDocument(context.contentResolver, parent, listType(), name)
          ?: throw Told(R.string.jukebox_file_not_writable)
        write(context, document.toString(), text, made = there == null)
      }.isSuccess
      if (done) written += 1 else failed += name
    }
    return mapOf("written" to written, "failed" to failed, "folder" to folderLabel(top, null))
  }
}
