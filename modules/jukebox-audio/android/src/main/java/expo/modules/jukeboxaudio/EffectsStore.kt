package expo.modules.jukeboxaudio

import android.content.Context
import expo.modules.jukeboxaudio.equalizer.ParametricSettings
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * The equalizer and tone settings, written where the service can read them.
 *
 * For the same reason the queue is: pressing play on the home screen widget
 * after the app has been killed starts [PlaybackService] with no JavaScript in
 * the process and no database open, and the music should still come out sounding
 * the way it was left. A small JSON file is something the service can read on
 * its own.
 *
 * Held in memory once read, because these are consulted on every attach and the
 * file is a few hundred bytes that only this app ever writes.
 */
object EffectsStore {
  private const val FILE = "effects.json"

  /** Where the app's own equalizer is kept in the document. */
  private const val PARAMETRIC = "parametric"

  /** The layout Android has shipped since Eclair, used where a device never said otherwise. */
  private val DEFAULT_BANDS = Bands(
    count = 5,
    minMb = -1_500,
    maxMb = 1_500,
    centresHz = listOf(60, 230, 910, 3_600, 14_000),
    presets = emptyList()
  )

  /**
   * What the phone's own equalizer could do, as it was written down while
   * this app still drove it.
   *
   * Nothing writes it any more. It is read once, by [parametric], to find
   * out which frequencies the old band levels belonged to.
   */
  data class Bands(
    val count: Int,
    val minMb: Int,
    val maxMb: Int,
    val centresHz: List<Int>,
    val presets: List<String>
  )

  /**
   * The switch, and the three effects that are still the phone's.
   *
   * [enabled] is the one switch at the top of the screen, for all of it: the
   * app's own equalizer answers to it as well, which is why it is not kept
   * with the bands.
   */
  data class Settings(
    val enabled: Boolean = false,
    /** 0..1000, Android's own scale for both of these. */
    val bass: Int = 0,
    val virtualizer: Int = 0,
    /** Millibels of make-up gain. */
    val loudness: Int = 0
  )

  private var cached: JSONObject? = null

  private fun file(context: Context) = File(context.filesDir, FILE)

  private fun document(context: Context): JSONObject {
    cached?.let { return it }
    val loaded = runCatching {
      val target = file(context)
      if (target.isFile) JSONObject(target.readText()) else JSONObject()
    }.getOrDefault(JSONObject())
    cached = loaded
    return loaded
  }

  private fun save(context: Context, document: JSONObject) {
    cached = document
    runCatching {
      // Through a temporary file, so a write interrupted by a kill leaves the
      // settings that were there rather than half of the new ones.
      val target = file(context)
      val temporary = File(target.parentFile, "$FILE.part")
      temporary.writeText(document.toString())
      if (!temporary.renameTo(target)) temporary.delete()
    }
  }

  @Synchronized
  fun read(context: Context): Settings {
    val body = document(context)
    return Settings(
      enabled = body.optBoolean("enabled", false),
      bass = body.optInt("bass", 0),
      virtualizer = body.optInt("virtualizer", 0),
      loudness = body.optInt("loudness", 0)
    )
  }

  /*
    Each write starts from a copy of the whole document and changes its own
    keys, so the two halves -- these and the bands -- can be written
    separately without either losing the other, and so that what an older
    version left behind ("preset", "bands", "capabilities": the phone's
    equalizer as it was last set) stays where it was.
  */
  @Synchronized
  fun write(context: Context, settings: Settings) {
    val body = document(context)
    save(
      context,
      JSONObject(body.toString())
        .put("enabled", settings.enabled)
        .put("bass", settings.bass)
        .put("virtualizer", settings.virtualizer)
        .put("loudness", settings.loudness)
    )
  }

  /**
   * The app's own equalizer, as it was left.
   *
   * The first time this is asked on a phone that had the old equalizer set
   * up, there is nothing of the new one in the file and the old band levels
   * are: they are carried over ([ParametricSettings.fromDevice]) and the
   * result written down, so it happens once. Whichever asks first does it --
   * the service coming up to play, or the screen being opened -- and it
   * needs nothing but the file, so it is the same either way.
   *
   * The old levels are trusted as they stand. With one of the phone's own
   * presets chosen they are what the phone said that preset came to, read
   * back at the time; the phone is not asked again.
   */
  @Synchronized
  fun parametric(context: Context): ParametricSettings {
    val body = document(context)
    body.optJSONObject(PARAMETRIC)?.let { return ParametricSettings.fromJson(it) }
    val carried = ParametricSettings.fromDevice(
      centresHz = readBands(context).centresHz,
      levelsMb = body.optJSONArray("bands").toIntList(),
      // Named once, as it is carried, in the language the app is in then. It
      // is the user's preset from that moment and is not renamed after.
      name = Localised.text(context, R.string.jukebox_equalizer_carried)
    )
    writeParametric(context, carried)
    return carried
  }

  @Synchronized
  fun writeParametric(context: Context, settings: ParametricSettings) {
    val body = document(context)
    save(context, JSONObject(body.toString()).put(PARAMETRIC, settings.toJson()))
  }

  private fun readBands(context: Context): Bands {
    val body = document(context).optJSONObject("capabilities") ?: return DEFAULT_BANDS
    val count = body.optInt("count", 0)
    if (count <= 0) return DEFAULT_BANDS
    return Bands(
      count = count,
      minMb = body.optInt("minMb", DEFAULT_BANDS.minMb),
      maxMb = body.optInt("maxMb", DEFAULT_BANDS.maxMb),
      centresHz = body.optJSONArray("centresHz").toIntList(),
      presets = body.optJSONArray("presets").toStringList()
    )
  }

  private fun JSONArray?.toIntList(): List<Int> =
    if (this == null) emptyList() else (0 until length()).map { optInt(it, 0) }

  private fun JSONArray?.toStringList(): List<String> =
    if (this == null) emptyList() else (0 until length()).map { optString(it) }
}
