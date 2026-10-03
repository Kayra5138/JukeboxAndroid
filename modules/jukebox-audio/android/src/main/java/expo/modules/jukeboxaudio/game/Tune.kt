package expo.modules.jukeboxaudio.game

import kotlin.math.ln
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * What a recording sounds like, a little under fifty times a second: its
 * harmony, its timbre, and the tune on top of it.
 *
 * A second pass over the sound with a window four times as long as the one the
 * onsets are found with. The short window says when something happens and
 * cannot tell two neighbouring notes apart; this one can, and is too slow to
 * say when. Nothing is kept of a frame but what is drawn from it, so the whole
 * pass costs a few megabytes however long the song is.
 */
internal class Heard(
  /** How far apart the frames are, in milliseconds. */
  val frameMs: Double,
  /** Twelve to a frame: how much of each note of the scale is sounding, in any octave. */
  val chroma: Array<FloatArray>,
  /** How the energy is spread from low to high, which is what an arrangement sounds like. */
  val timbre: Array<FloatArray>,
  /** The pitch of the tune in each frame, in semitones (69 is the A above middle C). */
  val pitch: FloatArray,
  /** How strongly that pitch stood out, which is whether there was a tune at all. */
  val strength: FloatArray
) {
  val frames: Int get() = pitch.size
}

internal object Tune {
  /**
   * How long a window is, in samples, for a recording at [rate].
   *
   * A little under a tenth of a second whatever the rate, which is what it
   * takes to tell two neighbouring notes apart and is still short enough to
   * say which quarter of a step a note was in. The app listens at half the
   * rate a file is usually recorded at, and a window counted in samples would
   * be twice as long there: fine for pitch, and too slow to follow a tune.
   */
  fun windowFor(rate: Int): Int = if (rate < 32_000) 2048 else 4096

  /** The notes of the scale are told apart between these, where instruments and voices are. */
  private const val CHROMA_FROM_HZ = 110.0
  private const val CHROMA_TO_HZ = 3_500.0

  const val BANDS = 24
  private const val TIMBRE_FROM_HZ = 60.0
  private const val TIMBRE_TO_HZ = 8_000.0

  /**
   * Where a tune is looked for, and how finely.
   *
   * The C below middle C to the C two octaves above it: where a melody is sung
   * or played. Eighth-tones, because a voice is rarely on a semitone and a
   * coarser search snaps it back and forth between the two nearest.
   */
  private const val LOWEST_HZ = 130.0
  private const val HIGHEST_HZ = 1_050.0
  private const val PER_OCTAVE = 48

  /** How many of a pitch's harmonics vouch for it, and how much less each one counts. */
  private const val HARMONICS = 6
  private const val FALL = 0.75

  /**
   * What it costs the tune to move, for each semitone it moves.
   *
   * Without it the answer in every frame is whatever is loudest, which jumps
   * between the singer, the guitar and an overtone of the bass from one frame
   * to the next. With it the line moves the way a tune does. A leap is a leap
   * however far, though: past an octave the cost stops growing, or a real jump
   * to another part would be refused for ever.
   */
  private const val MOVE = 0.08
  private const val LEAP_SEMITONES = 12

  /** How wide a stretch of the spectrum its own smooth shape is taken over. */
  private const val SMOOTH = 41

  fun hear(samples: FloatArray, rate: Int): Heard {
    val size = windowFor(rate)
    val hop = size / 4
    val frames = if (samples.size < size) 0 else (samples.size - size) / hop
    val bins = size / 2
    val frameMs = hop * 1000.0 / rate
    if (frames <= 0) {
      return Heard(frameMs, emptyArray(), emptyArray(), FloatArray(0), FloatArray(0))
    }

    val window = Spectrum.hann(size)
    val hzOf = DoubleArray(bins) { it * rate.toDouble() / size }

    // Which note of the scale each bin belongs to, or none.
    val noteOf = IntArray(bins) { bin ->
      val hz = hzOf[bin]
      if (hz < CHROMA_FROM_HZ || hz > CHROMA_TO_HZ) -1
      else Math.floorMod((69 + 12 * (ln(hz / 440.0) / ln(2.0))).roundToInt(), 12)
    }

    // And which band of the timbre, on a scale that is even to the ear.
    fun mel(hz: Double) = 2595.0 * log10(1.0 + hz / 700.0)
    val melFrom = mel(TIMBRE_FROM_HZ)
    val melTo = mel(TIMBRE_TO_HZ)
    val bandOf = IntArray(bins) { bin ->
      val position = (mel(hzOf[bin]) - melFrom) / (melTo - melFrom) * BANDS
      if (position < 0.0 || position >= BANDS) -1 else position.toInt()
    }

    val candidates = (ln(HIGHEST_HZ / LOWEST_HZ) / ln(2.0) * PER_OCTAVE).toInt() + 1
    val candidateHz = DoubleArray(candidates) { LOWEST_HZ * 2.0.pow(it.toDouble() / PER_OCTAVE) }
    // Where each harmonic of each candidate sits in the spectrum, worked out once.
    val harmonicAt = Array(HARMONICS) { h ->
      DoubleArray(candidates) { candidateHz[it] * (h + 1) * size / rate }
    }
    val harmonicWeight = DoubleArray(HARMONICS) { FALL.pow(it) }

    val chroma = Array(frames) { FloatArray(12) }
    val timbre = Array(frames) { FloatArray(BANDS) }
    val salience = Array(frames) { FloatArray(candidates) }

    val piece = FloatArray(size)
    val compressed = FloatArray(bins)
    val sums = DoubleArray(bins + 1)
    val white = FloatArray(bins)
    val power = DoubleArray(BANDS)

    for (frame in 0 until frames) {
      val at = frame * hop
      for (i in 0 until size) piece[i] = samples[at + i] * window[i]
      val now = Spectrum.magnitudes(piece)

      java.util.Arrays.fill(power, 0.0)
      for (bin in 0 until bins) {
        // Compressed, so one loud partial does not own the frame.
        val value = ln(1.0 + 50.0 * now[bin]).toFloat()
        compressed[bin] = value
        sums[bin + 1] = sums[bin] + value
        val note = noteOf[bin]
        if (note >= 0) chroma[frame][note] += value
        val band = bandOf[bin]
        if (band >= 0) power[band] += now[bin].toDouble() * now[bin]
      }
      for (band in 0 until BANDS) timbre[frame][band] = ln(1.0 + power[band]).toFloat()

      /*
        Whitened: each bin less the smooth shape of the spectrum around it.
        Music keeps most of its energy low down, and a pitch judged by raw size
        is always the bass. What is left after the shape is taken away is what
        stands up out of it, which is the partials.
      */
      val half = SMOOTH / 2
      for (bin in 0 until bins) {
        val from = max(0, bin - half)
        val to = minOf(bins, bin + half + 1)
        val smooth = (sums[to] - sums[from]) / SMOOTH
        white[bin] = max(compressed[bin] - smooth, 0.0).toFloat()
      }

      val row = salience[frame]
      for (h in 0 until HARMONICS) {
        val positions = harmonicAt[h]
        val weight = harmonicWeight[h]
        for (candidate in 0 until candidates) {
          val position = positions[candidate]
          val low = position.toInt()
          if (low + 1 >= bins) continue
          val part = position - low
          row[candidate] += (weight * (white[low] * (1 - part) + white[low + 1] * part)).toFloat()
        }
      }
    }

    val path = followed(salience, candidates)
    val pitch = FloatArray(frames) { frame ->
      (69.0 + 12.0 * (ln(candidateHz[path[frame]] / 440.0) / ln(2.0))).toFloat()
    }
    val strength = FloatArray(frames) { salience[it][path[it]] }
    return Heard(frameMs, chroma, timbre, pitch, strength)
  }

  /**
   * One pitch a frame, chosen along the whole song at once (Viterbi).
   *
   * The best line through the frames, where being on a strong pitch is worth
   * having and moving costs. Looking at every pair of pitches in every frame
   * would be twenty thousand comparisons forty times a second of song; the
   * cost of moving is a straight line in the distance, so the best
   * predecessor of each pitch can be carried along in one pass up and one
   * pass down instead.
   */
  private fun followed(salience: Array<FloatArray>, candidates: Int): IntArray {
    val frames = salience.size
    val move = MOVE / (PER_OCTAVE / 12.0)
    val leap = MOVE * LEAP_SEMITONES

    val back = Array(frames) { ShortArray(candidates) }
    var score = DoubleArray(candidates)
    val reach = DoubleArray(candidates)
    val from = IntArray(candidates)

    fun own(frame: Int, candidate: Int, top: Float): Double =
      if (top > 0f) (salience[frame][candidate] / top).toDouble() else 0.0

    var top = salience[0].max()
    for (c in 0 until candidates) score[c] = own(0, c, top)

    for (frame in 1 until frames) {
      var bestAll = 0
      for (c in 1 until candidates) if (score[c] > score[bestAll]) bestAll = c

      for (c in 0 until candidates) {
        reach[c] = score[c]
        from[c] = c
      }
      for (c in 1 until candidates) {
        if (reach[c - 1] - move > reach[c]) {
          reach[c] = reach[c - 1] - move
          from[c] = from[c - 1]
        }
      }
      for (c in candidates - 2 downTo 0) {
        if (reach[c + 1] - move > reach[c]) {
          reach[c] = reach[c + 1] - move
          from[c] = from[c + 1]
        }
      }

      top = salience[frame].max()
      val next = DoubleArray(candidates)
      for (c in 0 until candidates) {
        var best = reach[c]
        var source = from[c]
        if (score[bestAll] - leap > best) {
          best = score[bestAll] - leap
          source = bestAll
        }
        next[c] = own(frame, c, top) + best
        back[frame][c] = source.toShort()
      }
      score = next
    }

    val path = IntArray(frames)
    var last = 0
    for (c in 1 until candidates) if (score[c] > score[last]) last = c
    path[frames - 1] = last
    for (frame in frames - 1 downTo 1) path[frame - 1] = back[frame][path[frame]].toInt()
    return path
  }
}
