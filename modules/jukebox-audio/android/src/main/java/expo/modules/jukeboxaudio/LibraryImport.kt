package expo.modules.jukeboxaudio

import android.content.ContentResolver
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import java.io.InputStream
import java.io.File
import java.io.OutputStream

/**
 * Puts an audio file into the music library.
 *
 * The library lives in shared storage, which since Android 10 an app cannot
 * simply write a file into. A row is created in the media store first — marked
 * pending so nothing reads a half-written file — the bytes are streamed into the
 * handle it hands back, and only then is the row published. That is also what
 * makes the file appear in the library at once: the media store already knows
 * about it, so there is nothing to scan.
 */
object LibraryImport {
  /** Native-only entry point. Never accepts a filesystem path from JavaScript. */
  fun fromDownload(context: Context, file: File, folder: String, filename: String, onReserved: (String) -> Unit): String {
    val root = File(context.cacheDir, "youtube").canonicalFile
    val discovery = File(context.noBackupFilesDir, "discover").canonicalFile
    require(file.canonicalFile.toPath().startsWith(root.toPath()) || file.canonicalFile.toPath().startsWith(discovery.toPath()))
    return store(context, folder, filename, onReserved) { output ->
      file.inputStream().use { pump(it, output, file.length()) }
    }
  }
  /** Buffer for the copy; a network read rarely fills more than this. */
  private const val CHUNK = 64 * 1024

  private const val CONNECT_TIMEOUT_MS = 15_000
  private const val READ_TIMEOUT_MS = 30_000

  /** Guards against a mistyped link filling the phone. */
  private const val MAX_BYTES = 300L * 1024 * 1024

  private const val MAX_REDIRECTS = 5

  /** Longest stem a name is trimmed to; the extension is kept on top of this. */
  private const val MAX_STEM = 120

  private val AUDIO_EXTENSIONS =
    setOf("mp3", "m4a", "aac", "flac", "ogg", "opus", "wav", "wma", "mp4", "m4b")

  private val COLLECTION: Uri =
    MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)

  private fun mimeFor(filename: String): String {
    val extension = filename.substringAfterLast('.', "").lowercase()
    return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension) ?: "audio/mpeg"
  }

  /**
   * Strips a name down to something a filesystem will accept.
   *
   * Titles carry slashes and colons often enough — `AC/DC`, `Re:Zero` — that
   * this is the ordinary case rather than a defensive one. Hyphens survive: the
   * `Artist - Title` convention is what the metadata reader splits on, so
   * flattening them loses information nothing can get back.
   *
   * The extension is held aside while the rest is shortened. Trimming the whole
   * name instead would cut `.flac` down to something unrecognisable and the file
   * would then be filed, and typed, as an mp3.
   */
  private fun safeName(name: String): String {
    val extension = name.substringAfterLast('.', "").lowercase()
    val known = extension in AUDIO_EXTENSIONS
    val stem = if (known) name.substringBeforeLast('.') else name

    val cleaned = stem.replace(Regex("""[\\/:*?"<>|]"""), " ")
      .replace(Regex("\\s+"), " ")
      .trim()
      .take(MAX_STEM)
      .dropDanglingSurrogate()
      .trim()
      .ifBlank { "track" }

    return "$cleaned.${if (known) extension else "mp3"}"
  }

  /**
   * `take` counts UTF-16 code units, so a cut that lands between the halves of
   * an emoji or an astral character leaves an unpaired surrogate — which is not
   * text, and goes on to be stored as a filename.
   */
  private fun String.dropDanglingSurrogate(): String =
    if (isNotEmpty() && last().isHighSurrogate()) dropLast(1) else this

  private fun store(
    context: Context,
    folder: String,
    filename: String,
    onReserved: ((String) -> Unit)? = null,
    write: (OutputStream) -> Unit
  ): String {
    val resolver = context.contentResolver
    val name = safeName(filename)

    val values = ContentValues().apply {
      put(MediaStore.Audio.Media.DISPLAY_NAME, name)
      put(MediaStore.Audio.Media.MIME_TYPE, mimeFor(name))
      put(MediaStore.Audio.Media.IS_MUSIC, 1)
      put(MediaStore.Audio.Media.RELATIVE_PATH, folder.trim('/'))
      put(MediaStore.Audio.Media.IS_PENDING, 1)
    }

    val uri = resolver.insert(COLLECTION, values)
      ?: throw IllegalStateException("The music library would not accept a new file.")

    try {
      onReserved?.invoke(ContentUris.parseId(uri).toString())
      resolver.openOutputStream(uri)?.use(write)
        ?: throw IllegalStateException("Could not write into the music library.")
      check(resolver.update(uri, ContentValues().apply {
        put(MediaStore.Audio.Media.IS_PENDING, 0)
      }, null, null) == 1) { "Could not publish the audio file." }
    } catch (error: Throwable) {
      runCatching { resolver.delete(uri, null, null) }
      throw error
    }

    return ContentUris.parseId(uri).toString()
  }

  /**
   * Copies with a ceiling, so a wrong link cannot run away with the storage.
   *
   * [expected] is the length the source committed to, or -1 when it committed
   * to none. Checking it is what separates a finished download from a socket
   * that died half way: both end in a clean EOF, and without the comparison the
   * truncated one is published into the library as an ordinary track that plays
   * for a minute and then errors, with nothing to tell it apart from a good one.
   */
  private fun pump(input: InputStream, output: OutputStream, expected: Long = -1L) {
    val buffer = ByteArray(CHUNK)
    var total = 0L
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      total += read
      if (total > MAX_BYTES) throw IllegalStateException("That file is too large to be a song.")
      output.write(buffer, 0, read)
    }
    if (total == 0L) throw IllegalStateException("The file was empty.")
    if (expected >= 0 && total != expected) {
      throw IllegalStateException("That download did not arrive in one piece.")
    }
  }

  /**
   * Refuses anything that resolves to the device itself or to the network it is
   * sitting on.
   *
   * The url arrives from outside — the app answers a `jukebox://` deep link —
   * and a phone can reach a great deal that the sender cannot. Without this,
   * `http://127.0.0.1:8080/…` or an RFC1918 address would be fetched with the
   * phone's own reachability and the answer parked in the shared music library.
   *
   * Knowingly incomplete: this resolves the name and the connection resolves it
   * again, so a host with a short TTL can answer public here and `127.0.0.1` a
   * moment later. Closing that needs the check and the connect to share one
   * address, which means replacing HttpURLConnection with a socket factory that
   * pins the address it validated — a large amount of new surface, on the
   * download path, to defend against an attacker who already has to talk the
   * user into pasting their link. The residual risk is accepted.
   */
}
