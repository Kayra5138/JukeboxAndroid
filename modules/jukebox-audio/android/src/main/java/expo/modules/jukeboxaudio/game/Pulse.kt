package expo.modules.jukeboxaudio.game

import kotlin.math.ln
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * The pulse of a recording: how long its smallest steady step is, and where
 * every one of them falls.
 *
 * The grid used to be a guess laid from the first millisecond of the file. The
 * step was searched for five milliseconds at a time and every line was a
 * multiple of it counted from nought, which is right only for a song whose
 * beat happens to be a multiple of five milliseconds and happens to start
 * exactly when the file does. Measured on thirteen records, the lines of that
 * grid were no nearer the onsets than lines drawn at random.
 *
 * Two things are done here instead, and they are separate questions.
 *
 * How long a step is asks what the onsets repeat at, and is answered from the
 * autocorrelation of the onset strength -- which does not care where the beat
 * starts, only how far apart its hits are.
 *
 * Where the steps fall is answered by following them. A band does not keep
 * time like a clock: over three minutes a drummer drifts by more than a beat,
 * and a fixed grid that is right in the first bar is half a step out by the
 * last chorus. So a line is laid on every step by dynamic programming (Ellis,
 * 2007), which wants each line on an onset and each gap near the step, and
 * settles the two against each other along the whole song at once.
 */
internal object Pulse {
  /** The shortest and longest step looked for, in milliseconds. */
  private const val SHORTEST_MS = 160.0
  private const val LONGEST_MS = 440.0

  /** How far out the step's multiples are asked whether they agree. */
  private const val REACH_MS = 3_000.0

  /** How much of what its even multiples show a step has to show at itself. */
  private const val AT_ITSELF = 0.35

  /**
   * How hard a line is held to the step.
   *
   * High enough that a missing onset does not pull a line off the beat to the
   * nearest thing that is there, and low enough that the grid still follows a
   * band that speeds up through a chorus.
   */
  private const val TIGHTNESS = 400.0

  /** How far either side the usual level of the onset strength is taken from. */
  private const val SWELL_MS = 500.0

  /**
   * Onset strength with the slow swell taken out of it.
   *
   * As a share of the level around it, so the hits of a quiet verse count for
   * as much as those of a loud chorus. Left as it is measured, the chorus
   * alone decides the tempo.
   */
  fun envelope(flux: FloatArray, frameMs: Double): FloatArray {
    val n = flux.size
    val span = max(3, (SWELL_MS / frameMs).roundToInt())
    val sums = DoubleArray(n + 1)
    for (i in 0 until n) sums[i + 1] = sums[i] + flux[i]
    return FloatArray(n) { i ->
      val from = max(0, i - span)
      val to = minOf(n, i + span + 1)
      val local = (sums[to] - sums[from]) / (2 * span + 1)
      if (local <= 0.0) 0f else (max(flux[i] - local, 0.0) / (local + 1e-9)).toFloat()
    }
  }

  /** How alike the envelope is to itself slid along by each number of frames. */
  private fun autocorrelation(envelope: FloatArray, upTo: Int): DoubleArray {
    val n = envelope.size
    val mean = envelope.average()
    val centred = DoubleArray(n) { envelope[it] - mean }
    val out = DoubleArray(upTo + 1)
    for (lag in 0..minOf(upTo, n - 1)) {
      var sum = 0.0
      for (t in 0 until n - lag) sum += centred[t] * centred[t + lag]
      out[lag] = sum
    }
    val whole = out[0]
    if (whole > 0.0) for (lag in out.indices) out[lag] /= whole
    return out
  }

  /**
   * The step the song is built on, in milliseconds, or nought if it has none.
   *
   * The spacing whose every multiple the onsets agree with. Even multiples
   * count double, because a swung or dotted rhythm splits the odd ones in two
   * and leaves the even ones where they were. And a step has to show at
   * itself: one and a half times the real step scores well on its even
   * multiples, which are the real step's, and has nothing happening on it.
   */
  fun step(envelope: FloatArray, frameMs: Double): Double {
    val reach = (REACH_MS / frameMs).toInt() + 3
    if (envelope.size < reach * 2) return 0.0
    val acf = autocorrelation(envelope, reach)

    // The best within a frame and a half: a multiple is rarely on a frame.
    fun at(ms: Double): Double {
      var best = Double.NEGATIVE_INFINITY
      var shift = -1.5
      while (shift <= 1.5) {
        val position = ms / frameMs + shift
        val low = position.toInt()
        if (low >= 0 && low + 1 < acf.size) {
          val part = position - low
          best = max(best, acf[low] * (1 - part) + acf[low + 1] * part)
        }
        shift += 0.75
      }
      return if (best == Double.NEGATIVE_INFINITY) 0.0 else best
    }

    var best = 0.0
    var bestScore = Double.NEGATIVE_INFINITY
    var loose = 0.0
    var looseScore = Double.NEGATIVE_INFINITY

    var step = SHORTEST_MS
    while (step < LONGEST_MS) {
      val multiples = (REACH_MS / step).toInt()
      var odd = 0.0
      var even = 0.0
      var odds = 0
      var evens = 0
      var first = 0.0
      for (k in 1..multiples) {
        val value = at(k * step)
        if (k == 1) first = value
        if (k % 2 == 0) {
          even += value
          evens++
        } else {
          odd += value
          odds++
        }
      }
      val score = (0.5 * odd + even) / (0.5 * odds + evens)
      if (score > looseScore) {
        looseScore = score
        loose = step
      }
      if (evens > 0 && first >= AT_ITSELF * (even / evens) && score > bestScore) {
        bestScore = score
        best = step
      }
      step += 0.25
    }
    return if (best > 0.0) best else loose
  }

  /**
   * A line on every step, in milliseconds from the start of the recording.
   *
   * Each frame is scored by its own onset strength plus the best line it could
   * follow on from, less a penalty for how far the gap between them is from
   * [stepMs] -- as a ratio, so too long and too short by the same factor cost
   * the same. The best chain is read backwards from the end.
   */
  fun follow(envelope: FloatArray, frameMs: Double, stepMs: Double): DoubleArray {
    val n = envelope.size
    val period = stepMs / frameMs
    val low = max(1, (period * 0.5).roundToInt())
    val high = max(low + 1, (period * 2.0).roundToInt())
    if (n <= high * 2) return DoubleArray(0)

    var mean = 0.0
    for (value in envelope) mean += value
    mean /= n
    var spread = 0.0
    for (value in envelope) spread += (value - mean) * (value - mean)
    spread = sqrt(spread / n) + 1e-9

    val penalty = DoubleArray(high - low + 1) { index ->
      val ratio = ln((low + index) / period)
      -TIGHTNESS * ratio * ratio
    }

    val score = DoubleArray(n) { envelope[it] / spread }
    val back = IntArray(n) { -1 }
    for (t in high until n) {
      var best = Double.NEGATIVE_INFINITY
      var from = -1
      for (index in penalty.indices) {
        val candidate = score[t - (low + index)] + penalty[index]
        if (candidate > best) {
          best = candidate
          from = t - (low + index)
        }
      }
      // A chain is only worth joining if it has found something. Before the
      // music starts there is nothing to follow on from.
      if (best > 0.0) {
        score[t] = envelope[t] / spread + best
        back[t] = from
      }
    }

    var last = max(0, n - 2 * high)
    for (t in last until n) if (score[t] > score[last]) last = t

    val lines = ArrayList<Double>()
    var t = last
    while (t >= 0) {
      lines.add(t * frameMs)
      t = back[t]
    }
    lines.reverse()
    return lines.toDoubleArray()
  }

  /**
   * The lines carried on at an even step to before the first moment of the
   * recording and past its last, so that every moment of it lies between two.
   */
  fun covering(lines: DoubleArray, stepMs: Double, endMs: Double): DoubleArray {
    if (lines.size < 2 || stepMs <= 0.0) return lines
    val before = ArrayList<Double>()
    var at = lines.first() - stepMs
    while (at > -stepMs) {
      before.add(at)
      at -= stepMs
    }
    before.reverse()
    val after = ArrayList<Double>()
    at = lines.last() + stepMs
    while (at < endMs + stepMs) {
      after.add(at)
      at += stepMs
    }
    return (before + lines.toList() + after).toDoubleArray()
  }
}

/**
 * Song time and grid time, and the way between them.
 *
 * The lines are where the steps fall in the recording, which is not evenly:
 * that is the whole reason they were followed rather than drawn. The board
 * needs them even -- a row is one height and one length -- so everything it is
 * given is written in grid time, where line number `i` is at exactly
 * `i * stepMs`, and it turns the player's position into grid time as it draws.
 * The tiles then fall a little faster where the band pushes and a little
 * slower where it drags, by an amount nobody could see, and land on the beat.
 */
internal class TimeMap(private val lines: DoubleArray, private val stepMs: Int) {
  val steps: Int get() = max(0, lines.size - 1)

  /** The line at or before [songMs], kept inside the lines there are. */
  fun lineBefore(songMs: Double): Int {
    var low = 0
    var high = lines.size - 1
    while (low < high) {
      val middle = (low + high + 1) ushr 1
      if (lines[middle] <= songMs) low = middle else high = middle - 1
    }
    return low.coerceIn(0, max(0, lines.size - 2))
  }

  /** The line nearest [songMs]. */
  fun nearestLine(songMs: Double): Int {
    val before = lineBefore(songMs)
    val after = minOf(before + 1, lines.size - 1)
    return if (songMs - lines[before] <= lines[after] - songMs) before else after
  }

  fun toGrid(songMs: Double): Double {
    if (lines.size < 2) return songMs
    val line = lineBefore(songMs)
    val gap = lines[line + 1] - lines[line]
    return (line + (songMs - lines[line]) / gap) * stepMs
  }

  /** Where in the recording a point of one step is: [line] and a share of the way to the next. */
  fun toSong(line: Int, share: Double): Double {
    val at = line.coerceIn(0, lines.size - 2)
    return lines[at] + (lines[at + 1] - lines[at]) * share
  }
}
