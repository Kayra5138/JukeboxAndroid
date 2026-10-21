package expo.modules.jukeboxaudio.lyrics

import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.storage.StorageManager
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.util.Base64
import expo.modules.jukeboxaudio.tags.AUDIO
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

/** The system's own provider for the phone's storage and its cards. */
internal const val EXTERNAL_STORAGE = "com.android.externalstorage.documents"

/**
 * The largest file that is read as somebody's lyrics. A long song's LRC is a
 * few kilobytes; this is room for a hundred of them, and little enough that a
 * file named like the song but holding something else entirely is turned
 * away rather than read into memory and sent across the bridge.
 */
internal const val LARGEST_WORDS = 512 * 1024

/**
 * Where a song's folder is, as a document of the folder tree that was granted,
 * or null when the song is not under it.
 *
 * The phone's storage provider names a document by its volume and its path
 * from the top of that volume -- `primary:Music/Album`, `1A2B-3C4D:Music` for
 * a card -- and the media store keeps the same two things for a song as a
 * volume name and a relative path. The two spell the volume differently: the
 * phone's own storage is `primary` to one and `external_primary` to the
 * other, and a card is the same identifier in upper case to one and lower to
 * the other. Paths are compared without regard to case because the shared
 * storage they live on does not regard it either.
 *
 * Built rather than found by walking down from the top of the tree. Walking
 * would ask for every folder on the way, and this is asked each time a song
 * starts.
 */
internal fun folderDocumentId(treeDocumentId: String, volumeName: String?, relativePath: String?): String? {
  val colon = treeDocumentId.indexOf(':')
  if (colon <= 0 || volumeName.isNullOrEmpty() || relativePath == null) return null
  val treeVolume = treeDocumentId.substring(0, colon)
  val sameVolume =
    if (treeVolume == "primary") volumeName == "external_primary"
    else treeVolume.equals(volumeName, ignoreCase = true)
  if (!sameVolume) return null

  val top = treeDocumentId.substring(colon + 1).trim('/')
  val path = relativePath.trim('/')
  return when {
    top.isEmpty() -> if (path.isEmpty()) "$treeVolume:" else "$treeVolume:$path"
    path.equals(top, ignoreCase = true) -> "$treeVolume:$top"
    path.startsWith("$top/", ignoreCase = true) -> "$treeVolume:$top/${path.substring(top.length + 1)}"
    else -> null
  }
}

/**
 * Whether a file in a song's folder could be its words, by name and size.
 *
 * Only a first sieve, so that a folder of three hundred songs does not cross
 * the bridge as three hundred names. Which of what is left belongs to which
 * song is decided in TypeScript (`siblingFor` in src/lib/lyrics/local.ts).
 */
internal fun mayHoldWords(name: String?, size: Long?): Boolean {
  if (name == null) return false
  if (size != null && size > LARGEST_WORDS) return false
  val lower = name.lowercase()
  return lower.endsWith(".lrc") || lower.endsWith(".txt")
}

/** A folder picked, as a name to show: its path on the volume, or the volume's own name at the top of one. */
internal fun folderLabel(treeDocumentId: String, volumeDescription: String?): String {
  val path = treeDocumentId.substringAfter(':', "").trim('/')
  return path.ifEmpty { volumeDescription ?: treeDocumentId.substringBefore(':') }
}

/**
 * Asking for the folder a library's songs are in, so that the `.lrc` files
 * beside them can be read.
 *
 * The system's folder picker, because nothing else will do on the Android
 * versions this runs on. Since Android 10 an app sees other apps' files on
 * shared storage only through the media store, and the media store answers
 * for sound, pictures and video: holding READ_MEDIA_AUDIO (or the storage
 * permission it replaced) shows the app every song and not one `.lrc` beside
 * them, since a text file is nobody's media. A folder the user picks here is
 * the one way in short of asking for all of storage, which this app does not.
 *
 * Opened at Music, which is where a library usually is; the user can go
 * anywhere from there.
 */
class FolderPick : AppContextActivityResultContract<FolderPick.Input, String?> {
  class Input : Serializable

  override fun createIntent(context: Context, input: Input): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
      .putExtra(DocumentsContract.EXTRA_INITIAL_URI, DocumentsContract.buildDocumentUri(EXTERNAL_STORAGE, "primary:Music"))

  override fun parseResult(input: Input, resultCode: Int, intent: Intent?): String? =
    if (resultCode == Activity.RESULT_OK) intent?.data?.toString() else null
}

/**
 * The folders granted for lyrics, and what is read from them.
 *
 * Which folders those are is kept by JavaScript, in the app's settings; the
 * grants themselves are the system's, kept across restarts by
 * `takePersistableUriPermission`. Every call checks the one against the other,
 * so a setting restored from a backup onto another phone, where nothing was
 * granted, reads as no folder at all rather than as an error.
 */
internal object LyricsFolders {
  private fun held(context: Context): Set<Uri> =
    context.contentResolver.persistedUriPermissions
      .filter { it.isReadPermission }
      .map { it.uri }
      .toSet()

  /**
   * Keeps the grant for a folder just picked, and says what it is called.
   *
   * A folder from anywhere but the phone's own storage -- a cloud drive, say,
   * which the picker offers as readily -- is not kept: the songs the library
   * plays are on the phone, and nothing in such a folder could be matched to
   * them.
   */
  fun adopt(context: Context, picked: String): Map<String, Any?> {
    val tree = Uri.parse(picked)
    if (tree.authority != EXTERNAL_STORAGE) return mapOf("status" to "elsewhere")
    context.contentResolver.takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    val id = DocumentsContract.getTreeDocumentId(tree)
    return mapOf("status" to "picked", "uri" to picked, "label" to folderLabel(id, volumeDescription(context, id)))
  }

  /** What the system calls the volume a folder is on: "SD card", say, in the phone's language. */
  private fun volumeDescription(context: Context, treeDocumentId: String): String? = runCatching {
    val volume = treeDocumentId.substringBefore(':')
    val storage = context.getSystemService(StorageManager::class.java)
    storage.storageVolumes
      .firstOrNull { if (volume == "primary") it.isPrimary else it.uuid.equals(volume, ignoreCase = true) }
      ?.getDescription(context)
  }.getOrNull()

  /** Which of [folders] the app may still read. */
  fun granted(context: Context, folders: List<String>): List<String> {
    val held = held(context)
    return folders.filter { Uri.parse(it) in held }
  }

  /** Gives a folder back. Nothing is thrown for one that was not held. */
  fun release(context: Context, folder: String) {
    runCatching {
      context.contentResolver.releasePersistableUriPermission(Uri.parse(folder), Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
  }

  private class Song(val name: String, val volume: String?, val path: String?)

  private fun song(context: Context, id: String): Song? {
    val number = id.toLongOrNull() ?: return null
    return context.contentResolver.query(
      ContentUris.withAppendedId(AUDIO, number),
      arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.VOLUME_NAME, MediaStore.MediaColumns.RELATIVE_PATH),
      null, null, null
    )?.use { cursor ->
      if (cursor.moveToFirst() && cursor.getString(0) != null) Song(cursor.getString(0), cursor.getString(1), cursor.getString(2))
      else null
    }
  }

  /**
   * The files beside track [id] that could be its words, from the first of
   * [folders] that holds it.
   *
   * Answers with the song's own file name, which is what the words are
   * matched against, and the candidates as name, address and size. The
   * status is `found` when the song's folder was read -- with or without
   * anything in it -- `outside` when no granted folder holds the song, and
   * `gone` for a track the media store no longer has.
   */
  fun siblings(context: Context, id: String, folders: List<String>): Map<String, Any?> {
    val song = runCatching { song(context, id) }.getOrNull() ?: return mapOf("status" to "gone")
    val held = held(context)
    for (folder in folders) {
      val tree = Uri.parse(folder)
      if (tree !in held) continue
      val top = runCatching { DocumentsContract.getTreeDocumentId(tree) }.getOrNull() ?: continue
      val parent = folderDocumentId(top, song.volume, song.path) ?: continue
      // A folder the song has since been moved out of, or one the provider
      // will not list, is no answer; the next granted folder may still be.
      val files = runCatching { list(context, tree, parent) }.getOrNull() ?: continue
      return mapOf("status" to "found", "name" to song.name, "files" to files)
    }
    return mapOf("status" to "outside", "name" to song.name, "files" to emptyList<Any>())
  }

  private fun list(context: Context, tree: Uri, parent: String): List<Map<String, Any?>> {
    val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent)
    val columns = arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_MIME_TYPE
    )
    val found = mutableListOf<Map<String, Any?>>()
    context.contentResolver.query(children, columns, null, null, null)?.use { cursor ->
      while (cursor.moveToNext()) {
        if (cursor.getString(3) == DocumentsContract.Document.MIME_TYPE_DIR) continue
        val name = cursor.getString(1)
        val size = if (cursor.isNull(2)) null else cursor.getLong(2)
        if (!mayHoldWords(name, size)) continue
        found += mapOf(
          "name" to name,
          "uri" to DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0)).toString(),
          "size" to size?.toDouble()
        )
      }
    } ?: throw IllegalStateException("The folder could not be listed.")
    return found
  }

  /**
   * One file's bytes, as base64, or null for one that cannot be read or is
   * too large to be anybody's lyrics.
   *
   * Bytes and not text: what a `.lrc` is written in is anybody's guess --
   * UTF-8 with a mark at the front or without, UTF-16 from Windows, an old
   * code page -- and the guessing is done in TypeScript, where it is tested
   * (src/lib/lyrics/decode.ts).
   */
  fun read(context: Context, document: String): String? = runCatching {
    context.contentResolver.openInputStream(Uri.parse(document))?.use { stream ->
      val held = ByteArray(LARGEST_WORDS + 1)
      var filled = 0
      while (filled < held.size) {
        val got = stream.read(held, filled, held.size - filled)
        if (got < 0) break
        filled += got
      }
      if (filled > LARGEST_WORDS) null else Base64.encodeToString(held, 0, filled, Base64.NO_WRAP)
    }
  }.getOrNull()
}
