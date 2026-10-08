package expo.modules.jukeboxaudio.loudness

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.tan

/**
 * How loud a recording is, as one number, the way broadcasters measure it.
 *
 * ITU-R BS.1770 / EBU R 128 "integrated loudness", in LUFS. It is the measure
 * ReplayGain 2.0 is defined in, and it is worth the trouble over a plain RMS
 * because of the two things it does that RMS does not: it weighs the sound the
 * way an ear does before measuring it, so a bass-heavy master is not counted
 * as louder than it is heard, and it leaves the quiet parts out, so a song
 * with a long hushed introduction is judged by the part of it that is the
 * song.
 *
 * The recipe, each step of which is somewhere below:
 *
 *   1. every channel through the "K" filter -- a high shelf and a high-pass;
 *   2. the mean square of that over 400 ms blocks, a new block every 100 ms;
 *   3. the channels of a block added together;
 *   4. blocks under -70 LUFS thrown out (silence is not part of the song);
 *   5. blocks more than 10 LU under the mean of what is left thrown out too;
 *   6. the mean of the remainder, in decibels, less 0.691.
 *
 * Fed a piece at a time and asked once at the end, so that a whole file never
 * has to be in memory to be measured. Nothing in here knows about Android,
 * which is what lets the tests hand it a sine wave and check the answer.
 *
 * Not safe to share between threads, and has no reason to be.
 */
class LoudnessMeter(val rate: Int, val channels: Int) {
  init {
    require(rate > 0 && channels > 0) { "A meter needs a sample rate and at least one channel." }
  }

  private val shelf: Biquad
  private val highPass: Biquad

  init {
    val (first, second) = kWeighting(rate)
    shelf = first
    highPass = second
  }

  /*
    What each filter remembers, two numbers per channel per filter. Kept as
    flat arrays of doubles and not as objects, because this is the one loop in
    the whole feature that runs once per sample of every song.

    Doubles, and not for show: the high-pass sits at 38 Hz, which at 48 kHz
    puts its poles a hair inside the unit circle, and in single precision the
    rounding in its feedback is audible to a meter as a floor of noise.
  */
  private val shelfA = DoubleArray(channels)
  private val shelfB = DoubleArray(channels)
  private val passA = DoubleArray(channels)
  private val passB = DoubleArray(channels)

  private val weights = DoubleArray(channels) { weight(channels, it) }

  /**
   * A tenth of a second, in frames.
   *
   * The blocks are 400 ms and overlap by three quarters, which is the same as
   * saying a block is four consecutive tenths and a new one starts every
   * tenth. So only the tenths are kept -- ten numbers a second -- and the
   * blocks are put together from them when the answer is asked for.
   */
  private val hop = (rate / 10.0).roundToInt().coerceAtLeast(1)
  private var inHop = 0
  private var energy = 0.0

  private var hops = DoubleArray(10 * 60 * 5)
  private var hopCount = 0

  /** The largest sample seen, as a fraction of full scale. */
  var peak = 0f
    private set

  /** How many frames have been fed in. */
  var frames = 0L
    private set

  /** Interleaved samples, full scale at one. [count] is in samples, not frames. */
  fun add(samples: FloatArray, count: Int = samples.size) {
    var at = 0
    while (at + channels <= count) {
      for (channel in 0 until channels) feed(channel, samples[at + channel])
      at += channels
      endFrame()
    }
  }

  /** The same for sixteen-bit samples, which is what a decoder hands over. */
  fun add(samples: ShortArray, count: Int = samples.size) {
    var at = 0
    while (at + channels <= count) {
      for (channel in 0 until channels) feed(channel, samples[at + channel] / 32768f)
      at += channels
      endFrame()
    }
  }

  private fun feed(channel: Int, sample: Float) {
    val magnitude = abs(sample)
    if (magnitude > peak) peak = magnitude

    // Two biquads one after the other, each in the transposed form, which
    // needs two remembered numbers apiece and no history of its input.
    val x = sample.toDouble()
    val shelved = shelf.b0 * x + shelfA[channel]
    shelfA[channel] = shelf.b1 * x - shelf.a1 * shelved + shelfB[channel]
    shelfB[channel] = shelf.b2 * x - shelf.a2 * shelved

    val weighted = highPass.b0 * shelved + passA[channel]
    passA[channel] = highPass.b1 * shelved - highPass.a1 * weighted + passB[channel]
    passB[channel] = highPass.b2 * shelved - highPass.a2 * weighted

    energy += weights[channel] * weighted * weighted
  }

  private fun endFrame() {
    frames++
    if (++inHop < hop) return
    if (hopCount == hops.size) hops = hops.copyOf(hops.size * 2)
    hops[hopCount++] = energy / hop
    energy = 0.0
    inHop = 0
  }

  /**
   * The integrated loudness of everything fed in so far, in LUFS.
   *
   * Negative infinity where there is nothing to measure: silence, or less
   * than one block of sound. That is an answer and not a failure, and the
   * caller is expected to read it as "leave this one alone".
   */
  fun loudness(): Double {
    val blocks = hopCount - 3
    if (blocks <= 0) return Double.NEGATIVE_INFINITY

    fun block(index: Int): Double =
      (hops[index] + hops[index + 1] + hops[index + 2] + hops[index + 3]) / 4.0

    // The absolute gate. Its mean is what the relative gate is hung from.
    val floor = energyAt(ABSOLUTE_GATE_LUFS)
    var sum = 0.0
    var kept = 0
    for (index in 0 until blocks) {
      val here = block(index)
      if (here > floor) {
        sum += here
        kept++
      }
    }
    if (kept == 0) return Double.NEGATIVE_INFINITY

    // Ten LU under a mean is a tenth of it, since these are powers.
    val relative = (sum / kept) * 10.0.pow(RELATIVE_GATE_LU / 10.0)
    val gate = maxOf(floor, relative)
    sum = 0.0
    kept = 0
    for (index in 0 until blocks) {
      val here = block(index)
      if (here > gate) {
        sum += here
        kept++
      }
    }
    if (kept == 0) return Double.NEGATIVE_INFINITY
    return OFFSET + 10.0 * log10(sum / kept)
  }

  /** The filters and their coefficients, which a test checks against the standard's. */
  data class Biquad(val b0: Double, val b1: Double, val b2: Double, val a1: Double, val a2: Double)

  companion object {
    /** Below this a block is silence, whatever the rest of the recording is doing. */
    const val ABSOLUTE_GATE_LUFS = -70.0

    /** How far under the recording's own level a block may be and still count. */
    const val RELATIVE_GATE_LU = -10.0

    /**
     * The standard's constant, which undoes the K filter's gain at 1 kHz --
     * so that a full-scale 1 kHz sine in one channel reads -3.01, its RMS.
     */
    private const val OFFSET = -0.691

    private fun energyAt(lufs: Double): Double = 10.0.pow((lufs - OFFSET) / 10.0)

    /**
     * The K filter for a given sample rate.
     *
     * The standard prints ten coefficients and says they are for 48 kHz. Used
     * as they stand at 44.1 kHz they describe a different filter -- every
     * frequency in it eight per cent lower -- and since nearly everything in
     * a music library is 44.1, that would be the usual case being the wrong
     * one. So the filters are designed here from what the printed numbers
     * *are*: a high shelf of about +4 dB turning at 1682 Hz, and a second-order
     * high-pass at 38 Hz. Those four parameters are the ones that reproduce
     * the standard's table at 48 kHz to eight decimal places (the test holds
     * them to that); they are the same ones libebur128 and ffmpeg use.
     *
     * Each is made by the bilinear transform, warped so that its own turning
     * frequency lands exactly where it should. What that cannot do is keep
     * the shape right all the way to the top: a rate much lower than 44.1 kHz
     * squeezes the shelf against half the sample rate. Music is never
     * measured at such a rate here, and where it matters the tests say by how
     * much the readings differ.
     */
    fun kWeighting(rate: Int): Pair<Biquad, Biquad> {
      val shelfTurn = tan(PI * 1681.974450955533 / rate)
      val shelfQ = 0.7071752369554196
      val high = 10.0.pow(3.999843853973347 / 20.0)
      val band = high.pow(0.4996667741545416)
      val shelfNorm = 1.0 + shelfTurn / shelfQ + shelfTurn * shelfTurn
      val shelf = Biquad(
        b0 = (high + band * shelfTurn / shelfQ + shelfTurn * shelfTurn) / shelfNorm,
        b1 = 2.0 * (shelfTurn * shelfTurn - high) / shelfNorm,
        b2 = (high - band * shelfTurn / shelfQ + shelfTurn * shelfTurn) / shelfNorm,
        a1 = 2.0 * (shelfTurn * shelfTurn - 1.0) / shelfNorm,
        a2 = (1.0 - shelfTurn / shelfQ + shelfTurn * shelfTurn) / shelfNorm
      )

      val passTurn = tan(PI * 38.13547087602444 / rate)
      val passQ = 0.5003270373238773
      val passNorm = 1.0 + passTurn / passQ + passTurn * passTurn
      // The numerator is left at one, minus two, one, as the standard has it,
      // rather than scaled to unity gain: the 0.691 above was chosen against
      // the filter as printed.
      val highPass = Biquad(
        b0 = 1.0,
        b1 = -2.0,
        b2 = 1.0,
        a1 = 2.0 * (passTurn * passTurn - 1.0) / passNorm,
        a2 = (1.0 - passTurn / passQ + passTurn * passTurn) / passNorm
      )
      return shelf to highPass
    }

    /**
     * How much a channel counts for.
     *
     * One for anything in front, 1.41 for the surrounds, nothing for the LFE.
     * Only the two layouts Android hands out with a subwoofer in them are
     * told apart; everything else, which is to say every music file there is,
     * counts each channel once.
     */
    private fun weight(channels: Int, index: Int): Double = when {
      channels != 6 && channels != 8 -> 1.0
      index == 3 -> 0.0
      index >= 4 -> 1.41
      else -> 1.0
    }
  }
}
