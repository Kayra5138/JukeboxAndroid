package expo.modules.jukeboxaudio.equalizer

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.log2
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Everything about the app's equalizer that is written down.
 *
 * The bands and preamp in force, and the curves the user has kept under
 * names of their own. Not whether it is switched on: that is the one switch
 * at the top of the screen, which the bass boost and the rest answer to as
 * well, and it is kept with them.
 *
 * The starting points the screen offers -- "Warm" and the others -- are not
 * here either. Choosing one sends its bands like any other change, so the
 * player never needs to know what they are.
 */
data class ParametricSettings(
  val bands: List<Parametric.Band> = emptyList(),
  /** Null for the preamp worked out from the bands. */
  val preampDb: Double? = null,
  val presets: List<Preset> = emptyList(),
  /**
   * Something the screen should tell the user once: [CARRIED] or [LOST],
   * about the phone's equalizer this one took over from. See [fromDevice].
   */
  val notice: String? = null
) {
  data class Preset(val name: String, val preampDb: Double?, val bands: List<Parametric.Band>)

  /** What the audio thread is shown of this. */
  fun curve(enabled: Boolean) = Parametric.Curve(enabled, bands, preampDb)

  fun toMap(): Map<String, Any?> = mapOf(
    "bands" to bands.map(::bandMap),
    "preampDb" to preampDb,
    "presets" to presets.map {
      mapOf("name" to it.name, "preampDb" to it.preampDb, "bands" to it.bands.map(::bandMap))
    },
    "notice" to notice
  )

  fun toJson(): JSONObject = JSONObject()
    .put("bands", bandsJson(bands))
    .put("preampDb", preampDb ?: JSONObject.NULL)
    .put(
      "presets",
      JSONArray().also { all ->
        for (preset in presets) {
          all.put(
            JSONObject()
              .put("name", preset.name)
              .put("preampDb", preset.preampDb ?: JSONObject.NULL)
              .put("bands", bandsJson(preset.bands))
          )
        }
      }
    )
    .put("notice", notice ?: JSONObject.NULL)

  companion object {
    const val CARRIED = "carried"
    const val LOST = "lost"

    /** What the curve carried over from the phone's equalizer is kept as. */
    const val CARRIED_NAME = "Phone equalizer"

    private const val MAX_PRESETS = 40
    private const val MAX_NAME = 40

    private fun bandMap(band: Parametric.Band): Map<String, Any?> = mapOf(
      "type" to band.type.key,
      "frequencyHz" to band.frequencyHz,
      "gainDb" to band.gainDb,
      "q" to band.q
    )

    private fun bandsJson(bands: List<Parametric.Band>) = JSONArray().also { all ->
      for (band in bands) {
        all.put(
          JSONObject()
            .put("type", band.type.key)
            .put("frequencyHz", band.frequencyHz)
            .put("gainDb", band.gainDb)
            .put("q", band.q)
        )
      }
    }

    /**
     * Read from the file, or from what JavaScript sent, which is the same
     * shape. Everything is held inside its limits on the way in, whichever it
     * was: the file is only ever written from here, but a backup made on
     * another version of the app comes in through the same door.
     */
    fun fromJson(json: JSONObject): ParametricSettings {
      val names = HashSet<String>()
      val presets = ArrayList<Preset>()
      val listed = json.optJSONArray("presets")
      for (index in 0 until (listed?.length() ?: 0)) {
        val entry = listed?.optJSONObject(index) ?: continue
        val name = entry.optString("name").trim().take(MAX_NAME)
        // Two with one name would be two chips nobody could tell apart.
        if (name.isEmpty() || !names.add(name.lowercase())) continue
        presets.add(Preset(name, preamp(entry), bands(entry.optJSONArray("bands"))))
      }
      return ParametricSettings(
        bands = bands(json.optJSONArray("bands")),
        preampDb = preamp(json),
        presets = presets.takeLast(MAX_PRESETS),
        notice = json.optString("notice").takeIf { it == CARRIED || it == LOST }
      )
    }

    /** From the bridge. Null where what arrived could not be read as settings at all. */
    fun fromMap(map: Map<*, *>): ParametricSettings? =
      runCatching { fromJson(JSONObject(map)) }.getOrNull()

    private fun preamp(json: JSONObject): Double? {
      if (!json.has("preampDb") || json.isNull("preampDb")) return null
      return json.optDouble("preampDb").takeIf { it.isFinite() }
        ?.coerceIn(Parametric.MIN_PREAMP_DB, Parametric.MAX_PREAMP_DB)
    }

    private fun bands(listed: JSONArray?): List<Parametric.Band> {
      val bands = ArrayList<Parametric.Band>()
      for (index in 0 until (listed?.length() ?: 0)) {
        if (bands.size >= Parametric.MAX_BANDS) break
        val entry = listed?.optJSONObject(index) ?: continue
        bands.add(
          Parametric.Band(
            type = Parametric.Type.of(entry.optString("type")),
            frequencyHz = entry.optDouble("frequencyHz", 1_000.0),
            gainDb = entry.optDouble("gainDb", 0.0),
            q = entry.optDouble("q", 1.0)
          ).held()
        )
      }
      return bands
    }

    /**
     * The phone's equalizer, as it was left, turned into this one.
     *
     * That equalizer was a row of bands at frequencies the phone chose --
     * [centresHz] -- each with a level in hundredths of a decibel,
     * [levelsMb]. Each becomes a peak at the same frequency with the same
     * gain, as wide as the gap to its neighbours, so that two bands beside
     * each other meet about half way down as the phone's did. It is not the
     * same filter: what a phone's equalizer does between its bands is the
     * manufacturer's business and is not published. It is the same shape,
     * near enough that somebody who had the bass up still has the bass up.
     *
     * The curve is put in force and also kept under a name, so that trying
     * something else is not a way to lose it.
     *
     * Where the two lists cannot be matched up -- the levels were stored but
     * the frequencies they belong to never were, or there are more of them
     * than this has bands -- nothing is invented. The result is flat and
     * says [LOST], and the old levels stay in the file where they were.
     */
    fun fromDevice(centresHz: List<Int>, levelsMb: List<Int>, name: String = CARRIED_NAME): ParametricSettings {
      // Never touched, which is nearly everybody: nothing to carry and nothing to say.
      if (levelsMb.all { it == 0 }) return ParametricSettings()

      val usable = centresHz.size == levelsMb.size &&
        centresHz.size <= Parametric.MAX_BANDS &&
        centresHz.all { it >= Parametric.MIN_HZ && it <= Parametric.MAX_HZ }
      if (!usable) return ParametricSettings(notice = LOST)

      val bands = centresHz.indices.map { index ->
        Parametric.Band(
          type = Parametric.Type.PEAK,
          frequencyHz = centresHz[index].toDouble(),
          gainDb = levelsMb[index] / 100.0,
          q = widthBetween(centresHz, index)
        ).held()
      }
      return ParametricSettings(
        bands = bands,
        presets = listOf(Preset(name, null, bands)),
        notice = CARRIED
      )
    }

    /**
     * The Q of a peak whose width is the distance to its neighbours.
     *
     * The cookbook's relation between a bandwidth in octaves and a Q. For
     * the five bands nearly every phone has, two octaves apart, it comes to
     * two thirds; for a ten-band layout an octave apart, to 1.4.
     */
    private fun widthBetween(centresHz: List<Int>, index: Int): Double {
      val gaps = ArrayList<Double>()
      if (index > 0) gaps.add(abs(log2(centresHz[index].toDouble() / centresHz[index - 1])))
      if (index < centresHz.size - 1) gaps.add(abs(log2(centresHz[index + 1].toDouble() / centresHz[index])))
      // One band on its own has no neighbours to be as wide as; two octaves is what the usual five are.
      val octaves = (if (gaps.isEmpty()) 2.0 else gaps.average()).coerceIn(0.25, 4.0)
      val ratio = 2.0.pow(octaves)
      // To two figures, so the screen shows 0.67 and not 0.6666666666666666.
      return Math.round(sqrt(ratio) / (ratio - 1.0) * 100.0) / 100.0
    }
  }
}
