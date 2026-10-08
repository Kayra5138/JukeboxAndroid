package expo.modules.jukeboxaudio

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns

/**
 * Reading a small text file the user picked.
 *
 * For one thing so far: a headphone correction saved from AutoEQ, which is
 * a dozen lines. The file is chosen with the same system picker a backup is
 * ([BackupOpen]), so there is no new permission and nothing new to register;
 * what differs is only what is done with the file once it is chosen.
 */
internal object TextDocument {
  /**
   * More than any file of settings will ever be, and little enough that a
   * film picked by mistake is turned away rather than read into memory and
   * sent across the bridge as a string.
   */
  private const val LIMIT = 256 * 1024

  /** The file's text and the name it goes by. Throws, in words a person can use, if it cannot be read. */
  fun read(context: Context, uri: Uri): Map<String, Any?> {
    val input = context.contentResolver.openInputStream(uri)
      ?: throw Told(R.string.jukebox_file_not_opened)
    val bytes = input.use { stream ->
      val held = ByteArray(LIMIT + 1)
      var filled = 0
      while (filled < held.size) {
        val read = stream.read(held, filled, held.size - filled)
        if (read < 0) break
        filled += read
      }
      if (filled > LIMIT) throw Told(R.string.jukebox_file_too_big_for_equalizer)
      held.copyOf(filled)
    }
    return mapOf("text" to String(bytes, Charsets.UTF_8), "name" to name(context, uri))
  }

  /** What the file is called, where whoever is serving it will say. */
  private fun name(context: Context, uri: Uri): String? = runCatching {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) cursor.getString(0) else null
    }
  }.getOrNull()
}
