package expo.modules.jukeboxaudio.game

import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.math.PI

/**
 * Enough of a Fourier transform to see where a song's hits are.
 *
 * Its own rather than a library's: this is the one piece of arithmetic the
 * chart maker needs, it is forty lines, and taking a dependency for it would
 * mean the whole analysis could no longer be run and tested on a plain JVM in a
 * second — which is the only reason any of the tuning here could be judged.
 */
internal object Spectrum {
  /**
   * How loud each frequency is, for one window of samples.
   *
   * [samples] must be a power of two long. What comes back is half the length,
   * because a real signal's spectrum is a mirror and the other half says
   * nothing new.
   */
  fun magnitudes(samples: FloatArray): FloatArray {
    val n = samples.size
    require(n > 0 && n and (n - 1) == 0) { "the window has to be a power of two, not $n" }

    val real = DoubleArray(n) { samples[it].toDouble() }
    val imaginary = DoubleArray(n)
    transform(real, imaginary)

    return FloatArray(n / 2) { hypot(real[it], imaginary[it]).toFloat() }
  }

  /** A window that tapers to nothing at both ends, so its edges are not heard as a click. */
  fun hann(size: Int): FloatArray =
    FloatArray(size) { (0.5 - 0.5 * cos(2.0 * PI * it / (size - 1))).toFloat() }

  /**
   * In-place Cooley-Tukey, decimation in time.
   *
   * The pairs that are combined at each stage are the ones whose indices differ
   * in a single bit, so the whole thing is a bit-reversal followed by log2(n)
   * passes of butterflies.
   */
  private fun transform(real: DoubleArray, imaginary: DoubleArray) {
    val n = real.size

    var target = 0
    for (index in 1 until n) {
      var bit = n shr 1
      while (target and bit != 0) {
        target = target xor bit
        bit = bit shr 1
      }
      target = target or bit
      if (index < target) {
        real[index] = real[target].also { real[target] = real[index] }
        imaginary[index] = imaginary[target].also { imaginary[target] = imaginary[index] }
      }
    }

    var span = 2
    while (span <= n) {
      val angle = -2.0 * PI / span
      val stepReal = cos(angle)
      val stepImaginary = sin(angle)
      var start = 0
      while (start < n) {
        var turnReal = 1.0
        var turnImaginary = 0.0
        for (offset in 0 until span / 2) {
          val a = start + offset
          val b = a + span / 2
          val hereReal = real[b] * turnReal - imaginary[b] * turnImaginary
          val hereImaginary = real[b] * turnImaginary + imaginary[b] * turnReal
          real[b] = real[a] - hereReal
          imaginary[b] = imaginary[a] - hereImaginary
          real[a] += hereReal
          imaginary[a] += hereImaginary
          val nextReal = turnReal * stepReal - turnImaginary * stepImaginary
          turnImaginary = turnReal * stepImaginary + turnImaginary * stepReal
          turnReal = nextReal
        }
        start += span
      }
      span = span shl 1
    }
  }
}
