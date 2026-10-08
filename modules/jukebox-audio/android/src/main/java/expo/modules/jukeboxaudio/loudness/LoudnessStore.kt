package expo.modules.jukeboxaudio.loudness

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * What each file's gain turned out to be, kept so it is only found out once.
 *
 * Measuring a song means decoding all of it, and reading its tags means
 * opening it; neither is something to repeat every time the song comes round.
 * One small JSON file of the service's own, like the queue and the settings
 * beside it, and for the reason they are: the service reads it with no
 * JavaScript running and without going near the app's database.
 *
 * Under the directory Android does not back up, rather than under the cache.
 * Nothing in here is precious -- every line can be made again from the file
 * it describes -- but making them again is an evening's battery for a large
 * library, and "clear cache" should not cost that. It is left out of the
 * app's own export for the same reason it is left out of Android's: it
 * describes this phone's copies of the files, and another phone will make its
 * own.
 *
 * Entries are never removed. A file that changes gets a new line under a new
 * fingerprint (see [Measure.fingerprint]) and the old one is a hundred bytes
 * nobody reads again.
 */
internal object LoudnessStore {
  private const val FILE = "loudness-gains.json"

  private var entries: HashMap<String, FileGain>? = null

  private fun file(context: Context) = File(context.noBackupFilesDir, FILE)

  private fun loaded(context: Context): HashMap<String, FileGain> {
    entries?.let { return it }
    val read = HashMap<String, FileGain>()
    runCatching {
      val target = file(context)
      if (target.isFile) {
        val body = JSONObject(target.readText())
        for (key in body.keys()) fromJson(body.optJSONObject(key))?.let { read[key] = it }
      }
    }
    entries = read
    return read
  }

  @Synchronized
  fun get(context: Context, fingerprint: String): FileGain? = loaded(context)[fingerprint]

  /**
   * Remembers one file, and writes the lot.
   *
   * All of it each time, which for a library of thousands is a few hundred
   * kilobytes, once per file ever, on the thread that has just spent seconds
   * decoding that file. Through a temporary file: this is written while music
   * plays and read after a kill, and half of it would parse as nothing.
   */
  @Synchronized
  fun put(context: Context, fingerprint: String, gain: FileGain) {
    val all = loaded(context)
    all[fingerprint] = gain
    runCatching {
      val body = JSONObject()
      for ((key, value) in all) body.put(key, toJson(value))
      val target = file(context)
      val temporary = File(target.parentFile, "$FILE.part")
      temporary.writeText(body.toString())
      if (!temporary.renameTo(target)) temporary.delete()
    }
  }

  /** Short names, because there is one of these per song in the library. */
  fun toJson(gain: FileGain): JSONObject = JSONObject()
    .put("t", gain.trackDb.toDouble())
    .apply {
      gain.trackPeak?.let { put("p", it.toDouble()) }
      gain.albumDb?.let { put("a", it.toDouble()) }
      gain.albumPeak?.let { put("ap", it.toDouble()) }
      if (gain.measured) put("m", true)
    }

  fun fromJson(json: JSONObject?): FileGain? {
    if (json == null || !json.has("t")) return null
    fun number(name: String): Float? =
      if (json.has(name)) json.optDouble(name).toFloat().takeIf { it.isFinite() } else null
    return FileGain(
      trackDb = number("t") ?: return null,
      trackPeak = number("p"),
      albumDb = number("a"),
      albumPeak = number("ap"),
      measured = json.optBoolean("m", false)
    )
  }
}
