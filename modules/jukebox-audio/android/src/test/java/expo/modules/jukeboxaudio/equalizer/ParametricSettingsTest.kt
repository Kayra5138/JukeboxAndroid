package expo.modules.jukeboxaudio.equalizer

import expo.modules.jukeboxaudio.equalizer.Parametric.Band
import expo.modules.jukeboxaudio.equalizer.Parametric.Type
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class ParametricSettingsTest {
  private val correction = listOf(
    Band(Type.LOW_SHELF, 105.0, 5.5, 0.7),
    Band(Type.PEAK, 1_447.0, -3.4, 1.83),
    Band(Type.HIGH_SHELF, 10_000.0, -2.1, 0.7)
  )

  @Test
  fun `what is written down is what is read back`() {
    val sent = ParametricSettings(
      bands = correction,
      preampDb = -6.2,
      presets = listOf(
        ParametricSettings.Preset("HD 650", -6.2, correction),
        ParametricSettings.Preset("Car", null, listOf(Band(Type.LOW_SHELF, 80.0, 4.0, 0.7)))
      ),
      notice = ParametricSettings.CARRIED
    )
    // Through text, as the file is.
    assertEquals(sent, ParametricSettings.fromJson(JSONObject(sent.toJson().toString())))
  }

  @Test
  fun `what is sent to the screen is what the screen sends back`() {
    val sent = ParametricSettings(
      bands = correction,
      preampDb = null,
      presets = listOf(ParametricSettings.Preset("HD 650", -6.2, correction))
    )
    assertEquals(sent, ParametricSettings.fromMap(sent.toMap()))
    // To the digit: a gain that came back as -3.4000000953 would no longer be
    // the preset it was chosen from.
    val band = (sent.toMap()["bands"] as List<*>)[1] as Map<*, *>
    assertEquals(-3.4, band["gainDb"])
    assertEquals("peak", band["type"])
  }

  @Test
  fun `an automatic preamp stays automatic`() {
    val back = ParametricSettings.fromJson(JSONObject(ParametricSettings(bands = correction).toJson().toString()))
    assertNull(back.preampDb)
    assertNull(ParametricSettings.fromMap(mapOf("bands" to emptyList<Any>(), "preampDb" to null))!!.preampDb)
    assertNull(ParametricSettings.fromMap(mapOf("bands" to emptyList<Any>()))!!.preampDb)
  }

  @Test
  fun `nothing at all is a flat equalizer`() {
    assertEquals(ParametricSettings(), ParametricSettings.fromJson(JSONObject()))
    assertEquals(ParametricSettings(), ParametricSettings.fromMap(emptyMap<String, Any?>()))
  }

  @Test
  fun `whatever arrives is held inside the limits`() {
    val wild = ParametricSettings.fromMap(
      mapOf(
        "preampDb" to -400,
        "bands" to List(30) { mapOf("type" to "notch", "frequencyHz" to 3, "gainDb" to 99, "q" to 0) } + listOf("junk", 7),
        "presets" to listOf(
          mapOf("name" to "  ", "bands" to emptyList<Any>()),
          mapOf("name" to "x".repeat(200), "preampDb" to 99, "bands" to listOf(mapOf("gainDb" to -99))),
          "junk"
        ),
        "notice" to "anything"
      )
    )!!
    assertEquals(Parametric.MIN_PREAMP_DB, wild.preampDb!!, 0.0)
    assertEquals(Parametric.MAX_BANDS, wild.bands.size)
    assertEquals(Band(Type.PEAK, Parametric.MIN_HZ, Parametric.MAX_GAIN_DB, Parametric.MIN_Q), wild.bands[0])
    // The one with no name is not kept, and the long one is cut to fit.
    assertEquals(1, wild.presets.size)
    assertEquals(40, wild.presets[0].name.length)
    assertEquals(Parametric.MAX_PREAMP_DB, wild.presets[0].preampDb!!, 0.0)
    assertEquals(-Parametric.MAX_GAIN_DB, wild.presets[0].bands[0].gainDb, 0.0)
    assertNull(wild.notice)
  }

  @Test
  fun `two curves cannot be kept under one name`() {
    val twice = ParametricSettings.fromMap(
      mapOf(
        "presets" to listOf(
          mapOf("name" to "Car", "bands" to listOf(mapOf("gainDb" to 1))),
          mapOf("name" to "car ", "bands" to listOf(mapOf("gainDb" to 2)))
        )
      )
    )!!
    assertEquals(listOf("Car"), twice.presets.map { it.name })
    assertEquals(1.0, twice.presets[0].bands[0].gainDb, 0.0)
  }

  @Test
  fun `the switch is not part of it`() {
    val settings = ParametricSettings(bands = correction, preampDb = -3.0)
    assertFalse(settings.curve(enabled = false).enabled)
    assertTrue(settings.curve(enabled = false).idle)
    val on = settings.curve(enabled = true)
    assertEquals(correction, on.bands)
    assertEquals(-3.0, on.preampDb!!, 0.0)
  }
}

/** What had been set on the phone's own equalizer, carried into this one. */
class CarriedOverTest {
  private val usual = listOf(60, 230, 910, 3_600, 14_000)

  @Test
  fun `each band becomes a peak where it was, by as much as it was`() {
    val carried = ParametricSettings.fromDevice(usual, listOf(600, 300, 0, -200, 450))
    assertEquals(5, carried.bands.size)
    assertTrue(carried.bands.all { it.type == Type.PEAK })
    assertEquals(listOf(60.0, 230.0, 910.0, 3_600.0, 14_000.0), carried.bands.map { it.frequencyHz })
    assertEquals(listOf(6.0, 3.0, 0.0, -2.0, 4.5), carried.bands.map { it.gainDb })
    assertNull(carried.preampDb)
    assertEquals(ParametricSettings.CARRIED, carried.notice)
  }

  @Test
  fun `it is kept under a name as well as put in force`() {
    val carried = ParametricSettings.fromDevice(usual, listOf(600, 300, 0, -200, 450))
    assertEquals(1, carried.presets.size)
    assertEquals(ParametricSettings.CARRIED_NAME, carried.presets[0].name)
    assertEquals(carried.bands, carried.presets[0].bands)
  }

  @Test
  fun `the bands are as wide as the gaps between them`() {
    // Two octaves apart, which is what nearly every phone has.
    val five = ParametricSettings.fromDevice(usual, listOf(100, 100, 100, 100, 100))
    assertTrue(five.bands.all { abs(it.q - 0.67) < 0.03 })
    // An octave apart.
    val ten = ParametricSettings.fromDevice(
      listOf(31, 62, 125, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000),
      List(10) { 100 }
    )
    assertTrue(ten.bands.all { abs(it.q - 1.41) < 0.03 })
  }

  @Test
  fun `the shape is near enough the one that was set`() {
    val levels = listOf(600, 300, 0, -200, 450)
    val carried = ParametricSettings.fromDevice(usual, levels)
    // At each band the curve is about what that band was set to. Not exactly:
    // the bands either side of it reach this far, and what the phone's own
    // filters did between bands was never published to be matched.
    for (index in usual.indices) {
      val there = Response.gainDb(carried.bands, usual[index].toDouble())
      assertEquals("at ${usual[index]} Hz", levels[index] / 100.0, there, 2.0)
    }
    // And every band up together is everything up, without holes between them.
    val all = ParametricSettings.fromDevice(usual, List(5) { 600 })
    for (hz in listOf(60.0, 120.0, 460.0, 1_800.0, 7_000.0, 14_000.0)) {
      val there = Response.gainDb(all.bands, hz)
      assertTrue("$there dB at $hz Hz", there in 4.5..9.5)
    }
  }

  @Test
  fun `a level past what a band can hold is held`() {
    val carried = ParametricSettings.fromDevice(listOf(60, 230), listOf(2_500, -2_500))
    assertEquals(listOf(20.0, -20.0), carried.bands.map { it.gainDb })
  }

  @Test
  fun `an equalizer that was never touched carries nothing and says nothing`() {
    assertEquals(ParametricSettings(), ParametricSettings.fromDevice(usual, List(5) { 0 }))
    assertEquals(ParametricSettings(), ParametricSettings.fromDevice(usual, emptyList()))
    assertEquals(ParametricSettings(), ParametricSettings.fromDevice(emptyList(), emptyList()))
  }

  @Test
  fun `levels that cannot be matched to frequencies are not guessed at`() {
    // Ten levels, and only the usual five frequencies to put them at.
    val lost = ParametricSettings.fromDevice(usual, List(10) { 300 })
    assertTrue(lost.bands.isEmpty())
    assertTrue(lost.presets.isEmpty())
    assertEquals(ParametricSettings.LOST, lost.notice)

    // More bands than there is room for.
    val many = ParametricSettings.fromDevice(List(13) { 100 * (it + 1) }, List(13) { 300 })
    assertEquals(ParametricSettings.LOST, many.notice)

    // A frequency no band can sit at.
    val odd = ParametricSettings.fromDevice(listOf(0, 230), listOf(300, 300))
    assertEquals(ParametricSettings.LOST, odd.notice)
  }
}
