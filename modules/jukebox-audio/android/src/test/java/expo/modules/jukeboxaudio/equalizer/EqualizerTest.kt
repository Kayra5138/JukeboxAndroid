package expo.modules.jukeboxaudio.equalizer

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import expo.modules.jukeboxaudio.equalizer.Parametric.Band
import expo.modules.jukeboxaudio.equalizer.Parametric.Curve
import expo.modules.jukeboxaudio.equalizer.Parametric.Type
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Random
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * A steady tone on both channels, peaking at [amplitude] of full scale.
 *
 * [from] is the frame it starts at, so a tone played a piece at a time is one
 * unbroken tone and not one with a kink at each join.
 */
private fun tone(hz: Double, frames: Int, rate: Int, amplitude: Double = 0.1, from: Int = 0): ShortArray =
  ShortArray(frames * 2) {
    (amplitude * 32767 * sin(2.0 * PI * hz * (from + it / 2) / rate)).toInt().toShort()
  }

/** Something with content everywhere, the same every time it is asked for. */
private fun noise(frames: Int, amplitude: Double = 0.2): ShortArray {
  val random = Random(20_261_007L)
  return ShortArray(frames * 2) { ((random.nextDouble() * 2 - 1) * amplitude * 32767).toInt().toShort() }
}

private fun bytes(samples: ShortArray): ByteBuffer =
  ByteBuffer.allocateDirect(samples.size * 2).order(ByteOrder.nativeOrder()).apply {
    asShortBuffer().put(samples)
  }

private fun shorts(buffer: ByteBuffer): ShortArray =
  ShortArray(buffer.remaining() / 2).also { buffer.order(ByteOrder.nativeOrder()).asShortBuffer().get(it) }

/** How loud the left channel is over the last [share] of a run, by which time a filter has settled. */
private fun level(samples: ShortArray, share: Double = 0.25): Double {
  val frames = samples.size / 2
  val start = (frames * (1 - share)).toInt()
  var sum = 0.0
  for (frame in start until frames) sum += samples[frame * 2].toDouble() * samples[frame * 2]
  return sqrt(sum / (frames - start))
}

private fun decibels(ratio: Double): Double = 20.0 * log10(ratio)

/** One player's equalizer, as the sink would set it up. */
private class Line(val rate: Int = 48_000, channels: Int = 2, encoding: Int = C.ENCODING_PCM_16BIT) {
  val processor = EqualizerProcessor().apply {
    configure(AudioProcessor.AudioFormat(rate, channels, encoding))
    flush()
  }

  fun play(samples: ShortArray): ShortArray {
    processor.queueInput(bytes(samples))
    return shorts(processor.output)
  }

  /** How many decibels a tone at [hz] comes out changed by, once everything has settled. */
  fun measure(hz: Double, seconds: Double = 1.0, amplitude: Double = 0.1): Double {
    val sent = tone(hz, (rate * seconds).toInt(), rate, amplitude)
    return decibels(level(play(sent)) / level(sent))
  }
}

/** Switched on, with the preamp out of the way so that what is measured is the bands. */
private fun set(vararg bands: Band, preampDb: Double? = 0.0) =
  Parametric.publish(Curve(enabled = true, bands = bands.toList(), preampDb = preampDb))

class ResponseTest {
  @Test
  fun `a peak is its gain at its centre and fades to nothing either side`() {
    val bands = listOf(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    assertEquals(6.0, Response.gainDb(bands, 1_000.0), 0.001)
    assertTrue(abs(Response.gainDb(bands, 250.0)) < 0.5)
    assertTrue(abs(Response.gainDb(bands, 4_000.0)) < 0.5)
    // And a cut is the same shape upside down.
    val cut = listOf(Band(Type.PEAK, 1_000.0, -6.0, 1.4))
    for (hz in listOf(300.0, 800.0, 1_000.0, 1_500.0, 6_000.0)) {
      assertEquals(-Response.gainDb(bands, hz), Response.gainDb(cut, hz), 0.001)
    }
  }

  @Test
  fun `a shelf is its gain on its own side, half of it at the corner and nothing on the other`() {
    val low = listOf(Band(Type.LOW_SHELF, 200.0, 8.0, 0.7))
    assertEquals(8.0, Response.gainDb(low, 20.0), 0.1)
    assertEquals(4.0, Response.gainDb(low, 200.0), 0.01)
    assertEquals(0.0, Response.gainDb(low, 5_000.0), 0.05)

    val high = listOf(Band(Type.HIGH_SHELF, 4_000.0, -5.0, 0.7))
    assertEquals(0.0, Response.gainDb(high, 100.0), 0.05)
    assertEquals(-2.5, Response.gainDb(high, 4_000.0), 0.01)
    assertEquals(-5.0, Response.gainDb(high, 20_000.0), 0.1)
  }

  @Test
  fun `bands add up in decibels`() {
    val one = Band(Type.PEAK, 500.0, 4.0, 1.0)
    val other = Band(Type.HIGH_SHELF, 3_000.0, -3.0, 0.7)
    for (hz in listOf(60.0, 500.0, 1_200.0, 3_000.0, 12_000.0)) {
      assertEquals(
        Response.gainDb(listOf(one), hz) + Response.gainDb(listOf(other), hz),
        Response.gainDb(listOf(one, other), hz),
        1e-9
      )
    }
  }

  @Test
  fun `a band at nought decibels is no filter`() {
    assertNull(Response.section(Band(Type.PEAK, 1_000.0, 0.0, 1.0), 48_000))
    assertNull(Response.section(Band(Type.LOW_SHELF, 80.0, 0.0, 0.7), 48_000))
    assertEquals(0.0, Response.gainDb(listOf(Band(gainDb = 0.0)), 1_000.0), 0.0)
  }

  @Test
  fun `numbers from outside the limits are brought inside them`() {
    val wild = Band(Type.PEAK, 5.0, 90.0, 400.0).held()
    assertEquals(Parametric.MIN_HZ, wild.frequencyHz, 0.0)
    assertEquals(Parametric.MAX_GAIN_DB, wild.gainDb, 0.0)
    assertEquals(Parametric.MAX_Q, wild.q, 0.0)
    val broken = Band(Type.PEAK, Double.NaN, Double.POSITIVE_INFINITY, Double.NaN).held()
    assertTrue(broken.frequencyHz.isFinite() && broken.gainDb.isFinite() && broken.q.isFinite())
  }

  @Test
  fun `the automatic preamp is the highest point of the curve, turned over`() {
    val bands = listOf(
      Band(Type.LOW_SHELF, 105.0, 5.5, 0.7),
      Band(Type.PEAK, 2_400.0, 3.0, 2.0),
      Band(Type.PEAK, 6_000.0, -4.0, 3.0)
    )
    val highest = (0..2_000).maxOf { Response.gainDb(bands, 20.0 * Math.pow(1_000.0, it / 2_000.0)) }
    assertEquals(-highest, Response.autoPreampDb(bands), 0.01)
    assertTrue(Response.autoPreampDb(bands) < -5.0)
  }

  @Test
  fun `says the same as the screen does`() {
    // The figures the screen's copy of this arithmetic (bands.ts) is held to
    // for this same curve, in its own tests. The curve that is drawn and the
    // one that is heard stay one curve by both being held to these.
    val bands = listOf(
      Band(Type.LOW_SHELF, 105.0, 5.5, 0.7),
      Band(Type.PEAK, 2_400.0, 3.0, 2.0),
      Band(Type.PEAK, 6_000.0, -4.0, 3.0)
    )
    assertEquals(5.1942, Response.gainDb(bands, 50.0), 0.0001)
    assertEquals(2.7513, Response.gainDb(bands, 105.0), 0.0001)
    assertEquals(2.9101, Response.gainDb(bands, 2_400.0), 0.0001)
    assertEquals(-3.8543, Response.gainDb(bands, 6_000.0), 0.0001)
    assertEquals(-0.0322, Response.gainDb(bands, 15_000.0), 0.0001)
    assertEquals(-5.4882, Response.autoPreampDb(bands), 0.0001)
  }

  @Test
  fun `the top of a narrow peak is not stepped over`() {
    // Between two steps of the walk, and a tenth of an octave wide.
    val bands = listOf(Band(Type.PEAK, 1_013.0, 12.0, 10.0))
    assertEquals(-12.0, Response.autoPreampDb(bands), 0.001)
  }

  @Test
  fun `a curve that only cuts is not turned back up`() {
    assertEquals(0.0, Response.autoPreampDb(listOf(Band(Type.PEAK, 3_000.0, -6.0, 1.0))), 0.0)
    assertEquals(0.0, Response.autoPreampDb(emptyList()), 0.0)
  }

  @Test
  fun `a band the stream has no room for is left out, or is a plain gain`() {
    // A 16 kHz stream holds nothing above eight.
    assertNull(Response.section(Band(Type.PEAK, 12_000.0, 6.0, 1.0), 16_000))
    assertNull(Response.section(Band(Type.HIGH_SHELF, 10_000.0, 6.0, 0.7), 16_000))
    // A low shelf with its corner above everything is lifting everything.
    val all = listOf(Band(Type.LOW_SHELF, 12_000.0, 6.0, 0.7))
    assertEquals(6.0, Response.gainDb(all, 100.0, 16_000), 1e-9)
    assertEquals(6.0, Response.gainDb(all, 7_000.0, 16_000), 1e-9)
    assertEquals(-6.0, Response.autoPreampDb(all, 16_000), 1e-9)
  }

  @Test
  fun `every filter the limits allow dies away rather than grows`() {
    for (rate in listOf(8_000, 44_100, 48_000, 96_000, 192_000)) {
      for (type in Type.entries) {
        for (hz in listOf(20.0, 31.5, 1_000.0, 20_000.0)) {
          for (gain in listOf(-20.0, -0.1, 0.1, 20.0)) {
            for (q in listOf(0.1, 0.7, 10.0)) {
              val made = Response.section(Band(type, hz, gain, q), rate) ?: continue
              assertTrue("$type $hz Hz $gain dB Q $q at $rate", abs(made[4]) < 1.0 && abs(made[3]) < 1.0 + made[4])
            }
          }
        }
      }
    }
  }

  @Test
  fun `nothing is idle until something is asked for`() {
    assertTrue(Curve().idle)
    assertTrue(Curve(enabled = false, bands = listOf(Band(gainDb = 6.0))).idle)
    assertTrue(Curve(enabled = true, bands = listOf(Band(gainDb = 0.0), Band(Type.LOW_SHELF, 90.0, 0.0, 0.7))).idle)
    assertFalse(Curve(enabled = true, bands = listOf(Band(gainDb = 0.5))).idle)
    // A preamp somebody set is a gain even over a flat curve.
    assertFalse(Curve(enabled = true, preampDb = -3.0).idle)
    assertTrue(Curve(enabled = true, preampDb = 0.0).idle)
  }
}

class EqualizerProcessorTest {
  @After
  fun flat() = Parametric.publish(Curve())

  @Test
  fun `a peak lifts a tone at its centre by its gain and leaves one two octaves off alone`() {
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    assertEquals(6.0, Line().measure(1_000.0), 0.2)
    assertEquals(0.0, Line().measure(250.0), 0.5)
    assertEquals(0.0, Line().measure(4_000.0), 0.5)

    set(Band(Type.PEAK, 1_000.0, -9.0, 1.4))
    assertEquals(-9.0, Line().measure(1_000.0), 0.2)
  }

  @Test
  fun `a low shelf lifts what is under it and a high shelf what is over it`() {
    set(Band(Type.LOW_SHELF, 200.0, 6.0, 0.7))
    assertEquals(6.0, Line().measure(30.0), 0.2)
    assertEquals(0.0, Line().measure(5_000.0), 0.2)

    set(Band(Type.HIGH_SHELF, 4_000.0, -8.0, 0.7))
    assertEquals(-8.0, Line().measure(16_000.0), 0.2)
    assertEquals(0.0, Line().measure(200.0), 0.2)
  }

  @Test
  fun `what comes out is what the response said would`() {
    // The shape of a headphone correction: a shelf and a spread of peaks.
    val bands = listOf(
      Band(Type.LOW_SHELF, 105.0, 5.5, 0.7),
      Band(Type.PEAK, 180.0, -3.4, 0.7),
      Band(Type.PEAK, 1_450.0, 2.1, 1.8),
      Band(Type.PEAK, 3_300.0, -4.6, 3.1),
      Band(Type.PEAK, 5_800.0, 4.0, 4.5),
      Band(Type.HIGH_SHELF, 10_000.0, -2.1, 0.7)
    )
    set(*bands.toTypedArray())
    for (rate in listOf(44_100, 48_000)) {
      for (hz in listOf(40.0, 105.0, 180.0, 700.0, 1_450.0, 3_300.0, 5_800.0, 9_000.0, 15_000.0)) {
        assertEquals("$hz Hz at $rate", Response.gainDb(bands, hz, rate), Line(rate).measure(hz), 0.2)
      }
    }
  }

  @Test
  fun `the same band is the same band at every sample rate`() {
    set(Band(Type.PEAK, 3_000.0, 8.0, 2.0), Band(Type.LOW_SHELF, 120.0, -4.0, 0.7))
    for (rate in listOf(44_100, 48_000, 96_000)) {
      assertEquals("3 kHz at $rate", 8.0, Line(rate).measure(3_000.0), 0.2)
      assertEquals("40 Hz at $rate", -4.0, Line(rate).measure(40.0), 0.2)
      // Half an octave off the peak, where a filter made for the wrong rate
      // would have put the peak instead.
      assertEquals(
        "4.2 kHz at $rate",
        Response.gainDb(listOf(Band(Type.PEAK, 3_000.0, 8.0, 2.0)), 4_243.0, rate),
        Line(rate).measure(4_243.0),
        0.2
      )
    }
  }

  @Test
  fun `one player moving to another rate makes its filters again`() {
    set(Band(Type.PEAK, 3_000.0, 8.0, 2.0))
    val line = Line(44_100)
    assertEquals(8.0, line.measure(3_000.0), 0.2)

    line.processor.configure(AudioProcessor.AudioFormat(96_000, 2, C.ENCODING_PCM_16BIT))
    line.processor.flush()
    val sent = tone(3_000.0, 96_000, 96_000)
    assertEquals(8.0, decibels(level(line.play(sent)) / level(sent)), 0.2)
  }

  @Test
  fun `switched off or flat it hands the audio on untouched`() {
    val sent = noise(4_800, amplitude = 0.9)

    Parametric.publish(Curve(enabled = false, bands = listOf(Band(Type.PEAK, 1_000.0, 12.0, 1.0))))
    assertArrayEquals(sent, Line().play(sent))

    Parametric.publish(Curve(enabled = true))
    assertArrayEquals(sent, Line().play(sent))

    Parametric.publish(
      Curve(enabled = true, bands = listOf(Band(Type.PEAK, 60.0, 0.0, 1.0), Band(Type.HIGH_SHELF, 8_000.0, 0.0, 0.7)))
    )
    assertArrayEquals(sent, Line().play(sent))
  }

  @Test
  fun `the narrowest band at the lowest frequency rings down and does not run away`() {
    for (rate in listOf(44_100, 96_000)) {
      set(Band(Type.PEAK, 20.0, 20.0, 10.0), preampDb = -20.0)
      val line = Line(rate)

      // The tone it is tuned to, long enough for a filter this narrow to get there.
      assertEquals("at $rate", 0.0, line.measure(20.0, seconds = 4.0, amplitude = 0.5), 0.2)

      // Then everything at once, which is what would set off a filter that was going to go.
      val loud = line.play(noise(rate * 2, amplitude = 0.9))
      assertTrue(loud.any { abs(it.toInt()) > 100 })

      // And then nothing: it has to come back to nothing, and stay there.
      line.play(ShortArray(rate * 2 * 4))
      val after = line.play(ShortArray(rate * 2))
      assertTrue("at $rate", after.all { it.toInt() == 0 })
    }
  }

  @Test
  fun `a boost that would pass full scale is held there and not wrapped`() {
    set(Band(Type.PEAK, 1_000.0, 12.0, 1.0))
    val out = Line().play(tone(1_000.0, 48_000, 48_000, amplitude = 0.9))
    assertEquals(32_767, out.maxOf { it.toInt() })
    assertEquals(-32_768, out.minOf { it.toInt() })
    // Wrapping would put a sample of the opposite sign next to the ceiling.
    for (frame in 1 until 48_000) {
      assertTrue(abs(out[frame * 2] - out[(frame - 1) * 2]) < 20_000)
    }
  }

  @Test
  fun `left to itself the preamp makes exactly enough room`() {
    val bands = arrayOf(Band(Type.LOW_SHELF, 105.0, 5.5, 0.7), Band(Type.PEAK, 2_400.0, 9.0, 2.0))
    set(*bands, preampDb = null)

    // Full scale in, at the frequency the curve lifts most: full scale out, and
    // no more. Read once the tone is steady -- its first instant is not a tone.
    val steady = Line().play(tone(2_400.0, 48_000, 48_000, amplitude = 1.0)).drop(48_000)
    val peak = steady.maxOf { abs(it.toInt()) }
    assertTrue("peak $peak", peak in 32_000..32_767)
    assertFalse(steady.any { it.toInt() == -32_768 })

    // And everything else is down by what that took.
    val expected = Response.autoPreampDb(bands.toList()) + Response.gainDb(bands.toList(), 500.0)
    assertEquals(expected, Line().measure(500.0), 0.2)
  }

  @Test
  fun `a preamp set by hand is the one used`() {
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4), preampDb = -4.0)
    assertEquals(2.0, Line().measure(1_000.0), 0.2)
    assertEquals(-4.0, Line().measure(60.0), 0.2)

    // Even with nothing else to do.
    set(preampDb = -6.0)
    assertEquals(-6.0, Line().measure(440.0), 0.1)
  }

  @Test
  fun `after a seek nothing of what came before rings on`() {
    set(Band(Type.PEAK, 40.0, 15.0, 8.0), preampDb = -15.0)
    val line = Line()
    line.play(tone(40.0, 48_000, 48_000, amplitude = 0.9))

    // Without the flush the filter is still sounding, a second's worth of bass in it.
    val ringing = Line().also { it.play(tone(40.0, 48_000, 48_000, amplitude = 0.9)) }.play(ShortArray(4_800 * 2))
    assertTrue(ringing.any { abs(it.toInt()) > 1_000 })

    line.processor.flush()
    assertTrue(line.play(ShortArray(4_800 * 2)).all { it.toInt() == 0 })
  }

  @Test
  fun `a change of curve is walked to and arrives`() {
    set(Band(Type.PEAK, 1_000.0, -12.0, 1.0))
    val line = Line()
    line.play(tone(1_000.0, 48_000, 48_000))

    set(Band(Type.PEAK, 1_000.0, 12.0, 1.0))
    val across = line.play(tone(1_000.0, 4_800, 48_000, from = 48_000))

    /*
      A 1 kHz tone at a tenth of full scale moves at most 430 counts a sample
      at its steepest; lifted twelve decibels, 1,700. A change made between
      two samples would be a step of some thousands on top of that.
    */
    for (frame in 1 until 4_800) {
      assertTrue("at $frame", abs(across[frame * 2] - across[(frame - 1) * 2]) < 1_900)
    }
    // Not there yet a hundredth of a second in, and there well inside the tenth.
    val early = across.copyOfRange(0, 480 * 2)
    assertTrue(early.maxOf { abs(it.toInt()) } < 9_000)

    val sent = tone(1_000.0, 48_000, 48_000, from = 52_800)
    assertEquals(12.0, decibels(level(line.play(sent)) / level(sent)), 0.2)
  }

  @Test
  fun `a slider being dragged is a string of small changes and none of them clicks`() {
    val line = Line()
    set(Band(Type.PEAK, 80.0, 0.0, 1.0))
    line.play(tone(80.0, 4_800, 48_000, amplitude = 0.2))

    // A change every forty milliseconds, as the screen sends them, from nought to twelve.
    var from = 4_800
    var worst = 0
    var last: Short? = null
    for (step in 1..24) {
      set(Band(Type.PEAK, 80.0, step * 0.5, 1.0))
      val out = line.play(tone(80.0, 1_920, 48_000, amplitude = 0.2, from = from))
      from += 1_920
      for (frame in 0 until 1_920) {
        last?.let { worst = maxOf(worst, abs(out[frame * 2] - it)) }
        last = out[frame * 2]
      }
    }
    // An 80 Hz tone at a fifth of full scale, lifted twelve decibels, moves 275 counts a sample.
    assertTrue("worst step $worst", worst < 330)

    // And the boost was building all the way along, not waiting for the finger to stop.
    val sent = tone(80.0, 4_800, 48_000, amplitude = 0.2, from = from)
    assertEquals(12.0, decibels(level(line.play(sent), share = 1.0) / level(sent, share = 1.0)), 0.5)
  }

  @Test
  fun `switching it off lets go without a click and then touches nothing`() {
    set(Band(Type.LOW_SHELF, 200.0, 10.0, 0.7))
    val line = Line()
    line.play(tone(100.0, 48_000, 48_000))

    Parametric.publish(Curve(enabled = false, bands = listOf(Band(Type.LOW_SHELF, 200.0, 10.0, 0.7))))
    val across = line.play(tone(100.0, 4_800, 48_000, from = 48_000))
    for (frame in 1 until 4_800) {
      assertTrue("at $frame", abs(across[frame * 2] - across[(frame - 1) * 2]) < 200)
    }

    val sent = noise(4_800)
    assertArrayEquals(sent, line.play(sent))
  }

  @Test
  fun `the same curve sent again is not a change`() {
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    val once = Line()
    val again = Line()
    val first = tone(1_000.0, 4_800, 48_000)
    val second = tone(1_000.0, 4_800, 48_000, from = 4_800)
    once.play(first)
    again.play(first)

    // A different object saying the same thing, as every drag of another slider sends.
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    assertArrayEquals(once.play(second), again.play(second))
  }

  @Test
  fun `each channel has a filter of its own`() {
    set(Band(Type.PEAK, 100.0, 12.0, 4.0), preampDb = -12.0)
    // A tone on the left and silence on the right.
    val sent = tone(100.0, 48_000, 48_000, amplitude = 0.5).also {
      for (frame in 0 until 48_000) it[frame * 2 + 1] = 0
    }
    val out = Line().play(sent)
    assertTrue((0 until 48_000).all { out[it * 2 + 1].toInt() == 0 })
    assertTrue(out.any { abs(it.toInt()) > 10_000 })
  }

  @Test
  fun `one channel or six are equalized as two are`() {
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    for (channels in listOf(1, 6)) {
      val line = Line(channels = channels)
      val sent = ShortArray(48_000 * channels) {
        (0.1 * 32767 * sin(2.0 * PI * 1_000.0 * (it / channels) / 48_000)).toInt().toShort()
      }
      val out = line.play(sent)
      // The last channel of each frame, over the last quarter.
      var before = 0.0
      var after = 0.0
      for (frame in 36_000 until 48_000) {
        val at = frame * channels + channels - 1
        before += sent[at].toDouble() * sent[at]
        after += out[at].toDouble() * out[at]
      }
      assertEquals("$channels channels", 6.0, decibels(sqrt(after / before)), 0.2)
    }
  }

  @Test
  fun `float audio is equalized the same way and not clipped`() {
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    val line = Line(encoding = C.ENCODING_PCM_FLOAT)
    val frames = 48_000
    val input = ByteBuffer.allocateDirect(frames * 2 * 4).order(ByteOrder.nativeOrder())
    for (frame in 0 until frames) {
      val value = (0.9 * sin(2.0 * PI * 1_000.0 * frame / 48_000)).toFloat()
      input.putFloat(value).putFloat(value)
    }
    input.flip()
    line.processor.queueInput(input)
    val out = line.processor.output.order(ByteOrder.nativeOrder()).asFloatBuffer()
    var peak = 0f
    for (index in frames until frames * 2) peak = maxOf(peak, abs(out.get(index)))
    assertEquals(0.9 * Math.pow(10.0, 6.0 / 20.0), peak.toDouble(), 0.02)
  }

  @Test
  fun `one sample that is not a number does not poison everything after it`() {
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    val line = Line(encoding = C.ENCODING_PCM_FLOAT)
    fun play(first: Float): FloatArray {
      val input = ByteBuffer.allocateDirect(4_800 * 2 * 4).order(ByteOrder.nativeOrder())
      for (frame in 0 until 4_800) {
        val value = if (frame == 0) first else (0.5 * sin(2.0 * PI * 1_000.0 * frame / 48_000)).toFloat()
        input.putFloat(value).putFloat(value)
      }
      input.flip()
      line.processor.queueInput(input)
      val out = line.processor.output.order(ByteOrder.nativeOrder()).asFloatBuffer()
      return FloatArray(out.remaining()).also { out.get(it) }
    }
    play(Float.NaN)
    assertTrue(play(0f).all { it.isFinite() })
  }

  @Test
  fun `a band the stream has no room for does no harm`() {
    set(Band(Type.PEAK, 18_000.0, 12.0, 1.0), Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    assertEquals(6.0, Line(22_050).measure(1_000.0), 0.2)
  }

  @Test
  fun `two players share the one curve`() {
    // The second player of a crossfade is built later and plays another track.
    set(Band(Type.PEAK, 1_000.0, 6.0, 1.4))
    val main = Line()
    val tail = Line()
    assertEquals(6.0, main.measure(1_000.0), 0.2)
    assertEquals(6.0, tail.measure(1_000.0), 0.2)

    set(Band(Type.PEAK, 1_000.0, -6.0, 1.4))
    main.play(tone(1_000.0, 4_800, 48_000))
    tail.play(tone(1_000.0, 4_800, 48_000))
    assertEquals(-6.0, main.measure(1_000.0), 0.2)
    assertEquals(-6.0, tail.measure(1_000.0), 0.2)
  }
}
