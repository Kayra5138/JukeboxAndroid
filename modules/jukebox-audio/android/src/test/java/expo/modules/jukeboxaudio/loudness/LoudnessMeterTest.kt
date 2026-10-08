package expo.modules.jukeboxaudio.loudness

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Random
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.sin

/**
 * A sine wave being fed to a meter, a second at a time.
 *
 * The standard's own test signals run to eighty seconds, and eighty seconds of
 * stereo is thirty megabytes held for no reason. This keeps its place in the
 * wave between calls, so a level can change mid-signal without the click a
 * restart would put there -- which a meter would, rightly, measure.
 */
private class Tone(private val meter: LoudnessMeter, private val hz: Double) {
  private var frame = 0L

  /** [dbfs] is the level of the sine's peak, which is how EBU states its signals. */
  fun play(dbfs: Double, seconds: Double, into: IntRange = 0 until meter.channels) {
    val amplitude = 10.0.pow(dbfs / 20.0)
    var left = (seconds * meter.rate).toLong()
    val chunk = FloatArray(meter.rate * meter.channels)
    while (left > 0) {
      val frames = minOf(left, meter.rate.toLong()).toInt()
      for (index in 0 until frames) {
        val value = (amplitude * sin(2.0 * PI * hz * frame / meter.rate)).toFloat()
        for (channel in 0 until meter.channels) {
          chunk[index * meter.channels + channel] = if (channel in into) value else 0f
        }
        frame++
      }
      meter.add(chunk, frames * meter.channels)
      left -= frames
    }
  }
}

private fun reading(rate: Int, channels: Int, hz: Double, dbfs: Double, seconds: Double = 10.0): Double {
  val meter = LoudnessMeter(rate, channels)
  Tone(meter, hz).play(dbfs, seconds)
  return meter.loudness()
}

/**
 * What the K filter does to one frequency, in decibels, worked out from the
 * coefficients the standard prints for 48 kHz rather than from anything in the
 * meter. It is what the meter's own filters are held against.
 */
private fun printedGainDb(hz: Double): Double {
  fun magnitude(b: DoubleArray, a: DoubleArray): Double {
    val w = 2.0 * PI * hz / 48_000.0
    val topReal = b[0] + b[1] * cos(w) + b[2] * cos(2 * w)
    val topImaginary = -(b[1] * sin(w) + b[2] * sin(2 * w))
    val bottomReal = 1.0 + a[0] * cos(w) + a[1] * cos(2 * w)
    val bottomImaginary = -(a[0] * sin(w) + a[1] * sin(2 * w))
    return hypot(topReal, topImaginary) / hypot(bottomReal, bottomImaginary)
  }
  val shelf = magnitude(
    doubleArrayOf(1.53512485958697, -2.69169618940638, 1.19839281085285),
    doubleArrayOf(-1.69065929318241, 0.73248077421585)
  )
  val highPass = magnitude(
    doubleArrayOf(1.0, -2.0, 1.0),
    doubleArrayOf(-1.99004745483398, 0.99007225036621)
  )
  return 20.0 * log10(shelf * highPass)
}

class LoudnessMeterTest {
  // ---- the filter ----

  @Test
  fun `at 48 kHz the filters are the ones the standard prints`() {
    val (shelf, highPass) = LoudnessMeter.kWeighting(48_000)
    assertEquals(1.53512485958697, shelf.b0, 1e-8)
    assertEquals(-2.69169618940638, shelf.b1, 1e-8)
    assertEquals(1.19839281085285, shelf.b2, 1e-8)
    assertEquals(-1.69065929318241, shelf.a1, 1e-8)
    assertEquals(0.73248077421585, shelf.a2, 1e-8)
    assertEquals(-1.99004745483398, highPass.a1, 1e-8)
    assertEquals(0.99007225036621, highPass.a2, 1e-8)
  }

  @Test
  fun `the filter is the same filter at every rate music comes in`() {
    /*
      The reason the coefficients are derived and not copied. A tone is read
      at each rate and compared with what the printed 48 kHz filter does to
      that frequency. Low and middle frequencies agree closely everywhere; at
      the top the bilinear transform bends the shelf a little as the rate
      comes down, and the looser figure for 8 kHz is that bend being owned up
      to rather than a meter that is nearly right.
    */
    val level = -23.0
    for (rate in listOf(44_100, 48_000, 88_200, 96_000)) {
      for ((hz, within) in listOf(60.0 to 0.1, 250.0 to 0.1, 1_000.0 to 0.1, 4_000.0 to 0.1, 8_000.0 to 0.2)) {
        val expected = level + printedGainDb(hz) - 0.691
        assertEquals("$hz Hz at $rate", expected, reading(rate, 2, hz, level), within)
      }
    }
  }

  @Test
  fun `reusing the 48 kHz numbers at 44_1 would have been heard`() {
    // Not a test of the meter so much as of the claim above: the printed
    // filter run at the wrong rate is the filter of a frequency 8.8% higher,
    // and in the region where the shelf is climbing that is a real fraction
    // of a decibel -- more than the whole tolerance a loudness meter is
    // allowed.
    val moved = printedGainDb(2_000.0 * 48_000 / 44_100) - printedGainDb(2_000.0)
    assertTrue("only $moved dB", moved > 0.15)
  }

  // ---- levels ----

  @Test
  fun `a stereo 1 kHz sine reads its own level`() {
    // EBU Tech 3341, the first two of its test signals: a 1 kHz sine in both
    // channels, whose peak is at the stated level, reads that level in LUFS.
    assertEquals(-23.0, reading(48_000, 2, 1_000.0, -23.0, seconds = 20.0), 0.1)
    assertEquals(-33.0, reading(48_000, 2, 1_000.0, -33.0, seconds = 20.0), 0.1)
    assertEquals(-23.0, reading(44_100, 2, 1_000.0, -23.0, seconds = 20.0), 0.1)
  }

  @Test
  fun `a sine at full scale in one channel reads its RMS`() {
    assertEquals(-3.01, reading(48_000, 1, 1_000.0, 0.0), 0.1)
  }

  @Test
  fun `the same sound in two channels is three decibels more than in one`() {
    val mono = reading(48_000, 1, 1_000.0, -20.0)
    val stereo = reading(48_000, 2, 1_000.0, -20.0)
    assertEquals(3.01, stereo - mono, 0.02)

    // And a stereo file with one side empty is the mono reading, not half way.
    val meter = LoudnessMeter(48_000, 2)
    Tone(meter, 1_000.0).play(-20.0, 10.0, into = 0..0)
    assertEquals(mono, meter.loudness(), 0.02)
  }

  @Test
  fun `a level change is followed decibel for decibel`() {
    val quiet = reading(44_100, 2, 440.0, -30.0)
    val loud = reading(44_100, 2, 440.0, -12.0)
    assertEquals(18.0, loud - quiet, 0.01)
  }

  // ---- the gates ----

  @Test
  fun `silence has no loudness`() {
    val meter = LoudnessMeter(44_100, 2)
    meter.add(FloatArray(44_100 * 2 * 5))
    assertEquals(Double.NEGATIVE_INFINITY, meter.loudness(), 0.0)
    assertEquals(0f, meter.peak, 0f)
  }

  @Test
  fun `neither has something too short to make a block`() {
    val meter = LoudnessMeter(48_000, 2)
    Tone(meter, 1_000.0).play(-10.0, 0.3)
    assertEquals(Double.NEGATIVE_INFINITY, meter.loudness(), 0.0)
  }

  @Test
  fun `sound under the absolute gate is not counted`() {
    assertEquals(Double.NEGATIVE_INFINITY, reading(48_000, 2, 1_000.0, -80.0), 0.0)

    // Twenty seconds of song and twenty of nothing is as loud as the song.
    val meter = LoudnessMeter(48_000, 2)
    val tone = Tone(meter, 1_000.0)
    tone.play(-23.0, 20.0)
    meter.add(FloatArray(48_000 * 2 * 20))
    assertEquals(-23.0, meter.loudness(), 0.1)
  }

  @Test
  fun `a quiet opening and close are left out of a loud song`() {
    // EBU Tech 3341, test signal 3: -36, then a minute at -23, then -36. The
    // quiet ends are more than ten under the rest and the relative gate takes
    // them out. Without it this reads -23.7.
    val meter = LoudnessMeter(48_000, 2)
    val tone = Tone(meter, 1_000.0)
    tone.play(-36.0, 10.0)
    tone.play(-23.0, 60.0)
    tone.play(-36.0, 10.0)
    assertEquals(-23.0, meter.loudness(), 0.1)
  }

  @Test
  fun `both gates together`() {
    // Test signal 4: the same with ten seconds at -72 on either end, which
    // is the absolute gate's to remove before the relative one is worked out.
    val meter = LoudnessMeter(48_000, 2)
    val tone = Tone(meter, 1_000.0)
    tone.play(-72.0, 10.0)
    tone.play(-36.0, 10.0)
    tone.play(-23.0, 60.0)
    tone.play(-36.0, 10.0)
    tone.play(-72.0, 10.0)
    assertEquals(-23.0, meter.loudness(), 0.1)
  }

  @Test
  fun `parts within ten of each other are averaged as power`() {
    // Test signal 5: twenty seconds at -26, twenty point one at -20, twenty
    // at -26. Nothing is gated, and the answer is the mean of the powers.
    val meter = LoudnessMeter(48_000, 2)
    val tone = Tone(meter, 1_000.0)
    tone.play(-26.0, 20.0)
    tone.play(-20.0, 20.1)
    tone.play(-26.0, 20.0)
    assertEquals(-23.0, meter.loudness(), 0.1)
  }

  // ---- being fed ----

  @Test
  fun `how it is cut into pieces makes no difference`() {
    val random = Random(20_261_007L)
    val passage = FloatArray(44_100 * 2 * 6) {
      (sin(2.0 * PI * 220.0 * (it / 2) / 44_100) * 0.4 + (random.nextDouble() - 0.5) * 0.3).toFloat()
    }

    val whole = LoudnessMeter(44_100, 2).also { it.add(passage) }

    // A decoder hands over buffers of whatever length it likes, never a whole
    // number of blocks, and the reading must not depend on where they fell.
    val pieces = LoudnessMeter(44_100, 2)
    var at = 0
    while (at < passage.size) {
      val length = minOf(2 * (1 + random.nextInt(3_000)), passage.size - at)
      pieces.add(passage.copyOfRange(at, at + length))
      at += length
    }

    assertEquals(whole.loudness(), pieces.loudness(), 1e-9)
    assertEquals(whole.peak, pieces.peak, 0f)
    assertEquals(whole.frames, pieces.frames)
  }

  @Test
  fun `sixteen-bit samples read the same as the floats they stand for`() {
    val floats = FloatArray(48_000 * 2 * 4) { (0.25 * sin(2.0 * PI * 1_000.0 * (it / 2) / 48_000)).toFloat() }
    val shorts = ShortArray(floats.size) { (floats[it] * 32768f).toInt().toShort() }

    val fromFloats = LoudnessMeter(48_000, 2).also { it.add(floats) }
    val fromShorts = LoudnessMeter(48_000, 2).also { it.add(shorts) }
    assertEquals(fromFloats.loudness(), fromShorts.loudness(), 0.01)
  }

  @Test
  fun `the peak is the largest sample either way up`() {
    val meter = LoudnessMeter(48_000, 2)
    meter.add(floatArrayOf(0.1f, -0.2f, 0.5f, -0.8f, 0.3f, 0.0f))
    assertEquals(0.8f, meter.peak, 0f)
    assertEquals(3L, meter.frames)
  }
}
