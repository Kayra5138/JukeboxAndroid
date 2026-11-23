package expo.modules.jukeboxaudio

import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.OpenableColumns
import java.io.File
import java.security.MessageDigest

/**
 * A sound file opened with Jukebox from another app — an MP3 sent on
 * WhatsApp, a recording pressed in Files — or shared to it.
 *
 * Such a file comes as an address the other app lends for as long as the
 * screen that was opened lasts. A file that is in the library already is
 * played as the library's own, by its id. Any other is copied into the app's
 * cache first and played from there: swiped away, the app keeps playing, and
 * a seek needs nothing of the app that lent it. The last few copies are kept;
 * older ones go.
 */
internal object OpenedAudio {
  /** The handled mark, so that an intent read once is not played again when the screen is made again. */
  private const val HANDLED = "expo.modules.jukeboxaudio.OPENED_HANDLED"
  /** Copies kept in the cache, the latest; and the largest a file may be to be copied rather than played where it is. */
  private const val COPIES_KEPT = 12
  private const val MOST_COPIED = 1024L * 1024 * 1024

  /** The sound files [intent] opens or shares, once: none for any other, or one read before. */
  fun take(intent: Intent?): List<String> {
    if (intent == null || intent.getBooleanExtra(HANDLED, false)) return emptyList()
    val found = when (intent.action) {
      Intent.ACTION_VIEW -> listOfNotNull(intent.data)
      Intent.ACTION_SEND -> listOfNotNull(stream(intent))
      Intent.ACTION_SEND_MULTIPLE -> streams(intent)
      else -> emptyList()
    }.filter { it.scheme == "content" || it.scheme == "file" }
    if (found.isNotEmpty()) intent.putExtra(HANDLED, true)
    return found.map { it.toString() }
  }

  @Suppress("DEPRECATION")
  private fun stream(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri

  @Suppress("DEPRECATION")
  private fun streams(intent: Intent): List<Uri> =
    (if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
    else intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)).orEmpty()

  /**
   * [address] made ready to play: the media store's id where it is one of the
   * store's sound files, which the library knows it by if it is in the
   * library; an address to play it at, the store's own or a copy's; and what
   * the file says it is.
   */
  fun read(context: Context, address: String): Map<String, Any?> {
    val uri = Uri.parse(address)
    /*
      A path handed over by another app is taken only where it is a plain
      file and not one of this app's own: a device, which never ends, was
      copied until the disk was full, and a path into the app's own folder
      would have it open its own database as a song.
    */
    if (uri.scheme == "file") {
      require(opensAsFile(uri.path, context.applicationInfo.dataDir)) { "Not a file that can be opened" }
    }
    val name = displayName(context, uri)
    // A file of the store's is read with the app's own right to the music, for good, wherever it lies; any other is copied.
    val id = mediaId(context, uri)
    val playable = id?.let { android.content.ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, it.toLong()) }
      ?: copy(context, uri, name) ?: uri
    val tags = tags(context, playable)
    return mapOf(
      "mediaId" to id,
      "uri" to playable.toString(),
      "filename" to name,
      "title" to (tags["title"] ?: name?.substringBeforeLast('.')?.takeIf { it.isNotBlank() } ?: name),
      "artist" to tags["artist"],
      "album" to tags["album"],
      "durationSec" to (tags["duration"]?.toLongOrNull()?.div(1000.0) ?: 0.0),
    )
  }

  /** The media store's id of [uri], where it is a file the store holds: its own address, or a document of Files that is one. */
  private fun mediaId(context: Context, uri: Uri): String? = runCatching {
    val media = when {
      uri.authority == MediaStore.AUTHORITY -> uri
      android.provider.DocumentsContract.isDocumentUri(context, uri) -> MediaStore.getMediaUri(context, uri)
      else -> null
    } ?: return null
    val id = media.lastPathSegment?.takeIf { it.isNotEmpty() && it.all(Char::isDigit) } ?: return null
    // Only one the store holds as a sound file: asked for under that name, it answers or it does not.
    val audio = android.content.ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id.toLong())
    context.contentResolver.query(audio, arrayOf(MediaStore.Audio.Media._ID), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) id else null
    }
  }.getOrNull()

  private fun displayName(context: Context, uri: Uri): String? = runCatching {
    if (uri.scheme == "file") return uri.lastPathSegment
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    }
  }.getOrNull()

  /** [uri] copied into the cache, named by a hash of where it came from so the same file opened again is one copy; null where it could not be. */
  private fun copy(context: Context, uri: Uri, name: String?): Uri? = runCatching {
    val size = runCatching {
      context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length }
    }.getOrNull() ?: -1L
    if (size > MOST_COPIED) return null
    val folder = File(context.cacheDir, "opened").apply { mkdirs() }
    val (hash, ending) = copyName(uri.toString(), size, name)
    val target = File(folder, "$hash.$ending")
    if (!target.exists() || target.length() == 0L) {
      val part = File(folder, "$hash.part")
      // Counted as it goes: a length that was not said, or was said wrong, is no limit at all.
      val whole = context.contentResolver.openInputStream(uri)?.use { input ->
        part.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          var copied = 0L
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            copied += read
            if (copied > MOST_COPIED) return@use false
            output.write(buffer, 0, read)
          }
          true
        }
      } ?: return null
      if (!whole) {
        part.delete()
        return null
      }
      if (!part.renameTo(target)) return null
    }
    target.setLastModified(System.currentTimeMillis())
    // The oldest let go, past the few kept.
    folder.listFiles()?.let { past(it.toList(), target) }?.forEach { it.delete() }
    Uri.fromFile(target)
  }.getOrNull()

  /** Whether [path], handed over as a plain path, is a file of its own and outside [ownDir], the app's own folder. */
  internal fun opensAsFile(path: String?, ownDir: String?): Boolean {
    val file = runCatching { File(path ?: "").canonicalFile }.getOrNull() ?: return false
    val own = ownDir?.let { runCatching { File(it).canonicalPath }.getOrNull() }
    return file.isFile && (own == null || !file.path.startsWith("$own/"))
  }

  /**
   * The name a copy of [address] is kept under, without and with its ending:
   * a hash of where it came from, how long it is and what it was called, so
   * that the same file opened again is the one copy; and the ending of
   * [name] where it is a plain one, for what plays it to know it by.
   */
  internal fun copyName(address: String, size: Long, name: String?): Pair<String, String> {
    val ending = name?.substringAfterLast('.', "")?.lowercase()?.takeIf { it.length in 1..5 && it.all(Char::isLetterOrDigit) } ?: "audio"
    val hash = MessageDigest.getInstance("SHA-256").digest("$address|$size|$name".toByteArray()).take(10).joinToString("") { "%02x".format(it) }
    return hash to ending
  }

  /** Of the files in the copies' folder, those to let go once [kept] has been made: all but the latest few, [kept] among them. */
  internal fun past(files: List<File>, kept: File): List<File> =
    files.filter { it.isFile && it != kept }.sortedByDescending { it.lastModified() }.drop(COPIES_KEPT - 1)

  /** What [uri]'s file says it is: its title, artist, album and length in milliseconds, where it says. */
  private fun tags(context: Context, uri: Uri): Map<String, String?> = runCatching {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, uri)
      mapOf(
        "title" to retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.trim()?.takeIf { it.isNotEmpty() },
        "artist" to retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.trim()?.takeIf { it.isNotEmpty() },
        "album" to retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)?.trim()?.takeIf { it.isNotEmpty() },
        "duration" to retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION),
      )
    } finally {
      retriever.release()
    }
  }.getOrDefault(emptyMap())
}
