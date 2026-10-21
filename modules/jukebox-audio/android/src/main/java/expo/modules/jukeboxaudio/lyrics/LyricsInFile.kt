package expo.modules.jukeboxaudio.lyrics

import android.content.ContentUris
import android.content.Context
import android.util.Log
import expo.modules.jukeboxaudio.tags.AUDIO
import expo.modules.jukeboxaudio.tags.Tags

private const val TAG = "JukeboxLyrics"

/**
 * What the native side said, as JavaScript is to have it: names and values one
 * after the other, or null where the file could not be read at all. A file
 * with no words in it is an empty list and not a null; JavaScript treats the
 * two alike, but a log reading this should not.
 */
internal fun wordsFrom(said: Array<String>?): List<String>? {
  if (said == null) return null
  if (said.size >= 2 && said[0] == "error") return null
  return said.toList()
}

/**
 * The words a track's own file carries, by way of TagLib. See
 * `src/main/cpp/tags/jukebox_lyrics.cpp` for which fields of which formats.
 *
 * Opened through the media store, the same way the player opens it, so
 * nothing beyond the permission to play the song is needed to read its words.
 */
internal object LyricsInFile {
  fun read(context: Context, id: String): List<String>? {
    if (!Tags.ready) return null
    val number = id.toLongOrNull() ?: return null
    return try {
      val descriptor = context.contentResolver.openFileDescriptor(ContentUris.withAppendedId(AUDIO, number), "r")
        ?: return null
      // Let go of here and closed on the native side, whatever it finds.
      wordsFrom(Tags.lyrics(descriptor.detachFd()))
    } catch (error: Exception) {
      // A song deleted since the library was read, or one the app may no
      // longer open, simply has no words to give.
      Log.w(TAG, "Reading the words in track $id failed", error)
      null
    }
  }
}
