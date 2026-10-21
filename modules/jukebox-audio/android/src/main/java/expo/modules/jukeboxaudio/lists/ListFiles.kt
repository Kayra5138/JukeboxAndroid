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
   * app's language.
   */
  fun read(context: Context, picked: String): Map<String, Any?> {
    val uri = Uri.parse(picked)
    val documentId = runCatching { if (DocumentsContract.isDocumentUri(context, uri)) DocumentsContract.getDocumentId(uri) else null }.getOrNull()
    val base = mapOf(
      "uri" to picked,
      "name" to name(context, uri),
      "documentId" to documentId,
      "path" to path(context, uri, documentId)
    )
    val bytes = runCatching {
      context.contentResolver.openInputStream(uri)?.use { stream ->
        val held = ByteArray(LARGEST_LIST + 1)
        var filled = 0
        while (filled < held.size) {
          val got = stream.read(held, filled, held.size - filled)
          if (got < 0) break
          filled += got
        }
        if (filled > LARGEST_LIST) return base + ("problem" to "tooBig")
        Base64.encodeToString(held, 0, filled, Base64.NO_WRAP)
      }
    }.getOrNull() ?: return base + ("problem" to "unreadable")
    return base + ("bytes" to bytes)
  }

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
