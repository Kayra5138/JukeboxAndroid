package expo.modules.jukeboxaudio.spectrum

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

class SpectrumAnalyzerTest {
  private val size = SpectrumAnalyzer.SIZE
  private val bands = SpectrumAnalyzer.BANDS

  /** The bands [samples] come out as, through the same window the analyzer uses. */
  private fun bandsOf(samples: FloatArray): FloatArray {
    val real = FloatArray(size) { samples[it] * (0.5 - 0.5 * cos(2 * PI * it / (size - 1))).toFloat() }
    val imaginary = FloatArray(size)
    SpectrumAnalyzer.fft(real, imaginary)
    return FloatArray(bands).also { SpectrumAnalyzer.bandsOf(real, imaginary, 44100, it) }
  }

  private fun sine(hz: Double, loud: Float, rate: Int = 44100) = FloatArray(size) { (loud * sin(2 * PI * hz * it / rate)).toFloat() }

  /** The band a pitch falls in, the bands being even by octave from 40 Hz to 16 kHz. */
  private fun bandOf(hz: Double): Int = (kotlin.math.ln(hz / 40.0) / kotlin.math.ln(16000.0 / 40.0) * bands).toInt()

  @Test
  fun silenceIsNothing() {
    assertTrue(bandsOf(FloatArray(size)).all { it == 0f })
  }

  @Test
  fun aToneIsLoudInItsOwnBandAndQuietFarFromIt() {
    val found = bandsOf(sine(1000.0, 0.5f))
    val loudest = found.indices.maxByOrNull { found[it] }!!
    assertTrue("loudest in band $loudest", kotlin.math.abs(loudest - bandOf(1000.0)) <= 1)
    assertTrue(found[loudest] > 0.8f)
    assertTrue(found[bandOf(100.0)] < 0.2f)
    assertTrue(found[bandOf(10000.0)] < 0.2f)
  }

  @Test
  fun aQuieterToneIsLower() {
    // Both below the top of the range, where a tone near full scale is held.
    val loud = bandsOf(sine(440.0, 0.05f))[bandOf(440.0)]
    val quiet = bandsOf(sine(440.0, 0.005f))[bandOf(440.0)]
    assertTrue(quiet < loud)
    // Twenty decibels down is a little over a third of the range of fifty-four.
    assertEquals(20f / 54f, loud - quiet, 0.03f)
  }

  @Test
  fun everyBandIsBetweenNoughtAndOne() {
    val noise = java.util.Random(7).let { random -> FloatArray(size) { random.nextFloat() * 2 - 1 } }
    assertTrue(bandsOf(noise).all { it in 0f..1f })
  }
}
