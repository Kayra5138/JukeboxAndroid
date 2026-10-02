package expo.modules.jukeboxaudio

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * The equalizer settings, written where the service can read them.
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

  /** The layout Android has shipped since Eclair, used until a device says otherwise. */
  private val DEFAULT_BANDS = Bands(
    count = 5,
    minMb = -1_500,
    maxMb = 1_500,
    centresHz = listOf(60, 230, 910, 3_600, 14_000),
    presets = emptyList()
  )

  /**
   * What the device's equalizer can do. Cached rather than asked for, so the
   * settings screen can be opened with nothing playing and still draw the right
   * sliders.
   */
  data class Bands(
    val count: Int,
    val minMb: Int,
    val maxMb: Int,
    val centresHz: List<Int>,
    val presets: List<String>
  )

  /**
   * What the user chose. [preset] is an index into the device's own presets, or
   * -1 for the band levels below — which is what moving any slider sets it to,
   * since a preset that no longer describes the bands is a lie about them.
   */
  data class Settings(
    val enabled: Boolean = false,
    val preset: Int = -1,
    /** Gains in millibels, one per band, in band order. */
    val bands: List<Int> = emptyList(),
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

  fun read(context: Context): Settings {
    val body = document(context)
    return Settings(
      enabled = body.optBoolean("enabled", false),
      preset = body.optInt("preset", -1),
      bands = body.optJSONArray("bands").toIntList(),
      bass = body.optInt("bass", 0),
      virtualizer = body.optInt("virtualizer", 0),
      loudness = body.optInt("loudness", 0)
    )
  }

  fun write(context: Context, settings: Settings) {
    val body = document(context)
    save(
      context,
      JSONObject(body.toString())
        .put("enabled", settings.enabled)
        .put("preset", settings.preset)
        .put("bands", JSONArray(settings.bands))
        .put("bass", settings.bass)
        .put("virtualizer", settings.virtualizer)
        .put("loudness", settings.loudness)
    )
  }

  fun readBands(context: Context): Bands {
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

  fun saveBands(context: Context, bands: Bands) {
    val body = document(context)
    save(
      context,
      JSONObject(body.toString()).put(
        "capabilities",
        JSONObject()
          .put("count", bands.count)
          .put("minMb", bands.minMb)
          .put("maxMb", bands.maxMb)
          .put("centresHz", JSONArray(bands.centresHz))
          .put("presets", JSONArray(bands.presets))
      )
    )
  }

  private fun JSONArray?.toIntList(): List<Int> =
    if (this == null) emptyList() else (0 until length()).map { optInt(it, 0) }

  private fun JSONArray?.toStringList(): List<String> =
    if (this == null) emptyList() else (0 until length()).map { optString(it) }
}
