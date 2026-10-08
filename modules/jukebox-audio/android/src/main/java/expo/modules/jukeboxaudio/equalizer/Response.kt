package expo.modules.jukeboxaudio.equalizer

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * The filters a set of bands comes to, and what they do to each frequency.
 *
 * Arithmetic and nothing else -- no player, no settings -- so the tests can
 * ask it for numbers and then render audio through the real thing to see
 * whether the numbers were true.
 *
 * Every band is one biquad, a filter that remembers two samples, designed
 * from Robert Bristow-Johnson's Audio EQ Cookbook. Those are the formulas
 * Equalizer APO uses and the ones AutoEQ fits its corrections against, so a
 * file made for one is the same curve in the other.
 */
object Response {
  /**
   * The rate the curve is worked out at where no stream is there to say.
   *
   * A digital filter's shape depends a little on the sample rate, most of all
   * in the top octave. The screen draws at this one; the player uses the rate
   * of what it is actually playing.
   */
  const val REFERENCE_RATE = 48_000

  /**
   * How close to half the sample rate a band may sit and still be a filter.
   *
   * At half the rate there is no such frequency left to turn, and past it the
   * design formulas describe a filter for a mirror image of the one asked
   * for. Only a stream at a low rate -- speech at 16 kHz, an old rip at
   * 22.05 -- ever gets here: at 44.1 kHz the top of the range is still under
   * this.
   */
  private const val NYQUIST_SHARE = 0.49

  /** How finely the range is walked when looking for the loudest point. */
  private const val STEPS_PER_OCTAVE = 24

  /**
   * One band as five coefficients -- b0, b1, b2, a1, a2, already divided by
   * a0 -- for a stream at [rate], or null where the band does nothing.
   *
   * Null for a gain of nought, so a band left flat costs no arithmetic at
   * all. And null or a plain gain for a band the stream has no room for: a
   * peak or a high shelf up there is acting on frequencies the stream does
   * not hold, and a low shelf whose corner is above everything in it is
   * lifting all of it.
   */
  fun section(band: Parametric.Band, rate: Int): DoubleArray? {
    val held = band.held()
    if (held.gainDb == 0.0 || rate <= 0) return null

    if (held.frequencyHz >= rate * NYQUIST_SHARE) {
      return if (held.type == Parametric.Type.LOW_SHELF) {
        doubleArrayOf(10.0.pow(held.gainDb / 20.0), 0.0, 0.0, 0.0, 0.0)
      } else null
    }

    // Amplitude as the cookbook has it: the square root of the gain, because
    // each design below applies it once on the way up and once on the way down.
    val a = 10.0.pow(held.gainDb / 40.0)
    val w0 = 2.0 * PI * held.frequencyHz / rate
    val cosine = cos(w0)
    val alpha = sin(w0) / (2.0 * held.q)

    val b0: Double
    val b1: Double
    val b2: Double
    val a0: Double
    val a1: Double
    val a2: Double

    when (held.type) {
      Parametric.Type.PEAK -> {
        b0 = 1.0 + alpha * a
        b1 = -2.0 * cosine
        b2 = 1.0 - alpha * a
        a0 = 1.0 + alpha / a
        a1 = -2.0 * cosine
        a2 = 1.0 - alpha / a
      }
      Parametric.Type.LOW_SHELF -> {
        val edge = 2.0 * sqrt(a) * alpha
        b0 = a * ((a + 1.0) - (a - 1.0) * cosine + edge)
        b1 = 2.0 * a * ((a - 1.0) - (a + 1.0) * cosine)
        b2 = a * ((a + 1.0) - (a - 1.0) * cosine - edge)
        a0 = (a + 1.0) + (a - 1.0) * cosine + edge
        a1 = -2.0 * ((a - 1.0) + (a + 1.0) * cosine)
        a2 = (a + 1.0) + (a - 1.0) * cosine - edge
      }
      Parametric.Type.HIGH_SHELF -> {
        val edge = 2.0 * sqrt(a) * alpha
        b0 = a * ((a + 1.0) + (a - 1.0) * cosine + edge)
        b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cosine)
        b2 = a * ((a + 1.0) + (a - 1.0) * cosine - edge)
        a0 = (a + 1.0) - (a - 1.0) * cosine + edge
        a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cosine)
        a2 = (a + 1.0) - (a - 1.0) * cosine - edge
      }
    }

    val made = doubleArrayOf(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0)

    /*
      The test every two-pole filter has to pass to die away rather than grow:
      its poles inside the unit circle. The formulas above always pass it for
      the numbers [Parametric.Band.held] lets through, in exact arithmetic. A
      narrow band at twenty hertz in a 96 kHz stream puts its poles within a
      hair of the circle, though, and a filter that is dropped is a flat spot
      in a curve where one that rings for ever is the loudest noise the phone
      can make. So it is checked rather than trusted.
    */
    val stable = made.all { it.isFinite() } && abs(made[4]) < 1.0 && abs(made[3]) < 1.0 + made[4]
    return if (stable) made else null
  }

  /** What one filter does to a tone at [hz], as a ratio of power. */
  private fun power(section: DoubleArray, hz: Double, rate: Int): Double {
    val w = 2.0 * PI * hz / rate
    val once = cos(w)
    val twice = cos(2.0 * w)
    val (b0, b1, b2, a1, a2) = section
    val above = b0 * b0 + b1 * b1 + b2 * b2 + 2.0 * (b0 * b1 + b1 * b2) * once + 2.0 * b0 * b2 * twice
    val below = 1.0 + a1 * a1 + a2 * a2 + 2.0 * (a1 + a1 * a2) * once + 2.0 * a2 * twice
    return if (below > 0.0) above / below else 1.0
  }

  private fun sections(bands: List<Parametric.Band>, rate: Int): List<DoubleArray> =
    bands.mapNotNull { section(it, rate) }

  private fun gainOf(sections: List<DoubleArray>, hz: Double, rate: Int): Double {
    var total = 0.0
    for (section in sections) total += 10.0 * log10(max(power(section, hz, rate), 1e-30))
    return total
  }

  /**
   * How many decibels [bands] together turn a tone at [hz] up or down.
   *
   * The bands only, without the preamp: this is the shape, and the preamp is
   * where the whole of it is then put.
   */
  fun gainDb(bands: List<Parametric.Band>, hz: Double, rate: Int = REFERENCE_RATE): Double =
    gainOf(sections(bands, rate), hz, rate)

  /**
   * The most [bands] turn anything up, across everything that can be heard.
   *
   * Looked for a twenty-fourth of an octave at a time, and at every band's
   * own frequency as well: the top of a narrow peak is at its centre, and a
   * walk in even steps would straddle it.
   *
   * The filters are designed once and asked about each frequency, not
   * designed again for each: this runs on the audio thread, whenever a curve
   * with an automatic preamp changes.
   */
  fun peakDb(bands: List<Parametric.Band>, rate: Int = REFERENCE_RATE): Double {
    val made = sections(bands, rate)
    val top = minOf(Parametric.MAX_HZ, rate * NYQUIST_SHARE)
    var highest = Double.NEGATIVE_INFINITY
    var hz = Parametric.MIN_HZ
    val ratio = 2.0.pow(1.0 / STEPS_PER_OCTAVE)
    while (hz <= top) {
      highest = max(highest, gainOf(made, hz, rate))
      hz *= ratio
    }
    for (band in bands) {
      val at = band.held().frequencyHz
      if (at <= top) highest = max(highest, gainOf(made, at, rate))
    }
    return if (highest.isFinite()) highest else 0.0
  }

  /**
   * The preamp that makes room for [bands], where nobody has chosen one.
   *
   * A band that boosts makes its part of the music bigger, and a recording
   * already at full scale has nowhere bigger to go: it clips. So the whole
   * signal is turned down by as much as the curve's highest point turns
   * anything up, and the boost becomes everything else being cut. Never
   * positive: a curve that only cuts is quieter, and turning it back up is
   * for the listener to ask for, not for this to presume.
   */
  fun autoPreampDb(bands: List<Parametric.Band>, rate: Int = REFERENCE_RATE): Double {
    val peak = peakDb(bands, rate)
    return if (peak > 0.0) -peak else 0.0
  }
}
