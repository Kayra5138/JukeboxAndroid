package expo.modules.jukeboxaudio.game

import kotlin.math.sqrt

/**
 * Finding the bars of a song that are the same music.
 *
 * A chorus that comes round three times is played three times, and a player
 * who has learned it the first time should find it where they left it. Charted
 * afresh each time it never is: the same passage gives slightly different
 * numbers on every hearing, and a chart read off those numbers gives slightly
 * different keys. Measured on thirteen records, two bars that were the same
 * music agreed on barely more than half their keys.
 *
 * So bars are gathered into kinds, by ear rather than by position: two bars
 * are the same kind when they have the same harmony, the same sound and the
 * same rhythm, step for step. Everything the chart then says about one bar of
 * a kind it says about all of them.
 *
 * All three have to agree, and that is the point of having three. Most songs
 * keep their chords from verse to chorus, so harmony alone calls the whole
 * record one bar; the sound of the arrangement and the pattern of its hits are
 * what tell the verse from the chorus.
 */
internal object Bars {
  /** How alike two bars must be in harmony, in sound and in rhythm to be one kind. */
  private const val SAME_HARMONY = 0.7
  private const val SAME_SOUND = 0.7
  private const val SAME_RHYTHM = 0.5

  /** What each step of the grid sounds like, each row made ready to be compared. */
  class Steps(
    val harmony: Array<FloatArray>,
    val sound: Array<FloatArray>,
    val onset: FloatArray
  ) {
    val count: Int get() = onset.size
  }

  /** Each row less its own mean and scaled to length one, so a dot product is how alike two are. */
  private fun unit(rows: Array<FloatArray>): Array<FloatArray> = Array(rows.size) { index ->
    val row = rows[index]
    val mean = row.average().toFloat()
    var length = 0.0
    for (value in row) length += (value - mean) * (value - mean)
    val scale = (sqrt(length) + 1e-9).toFloat()
    FloatArray(row.size) { (row[it] - mean) / scale }
  }

  fun steps(harmony: Array<FloatArray>, sound: Array<FloatArray>, onset: FloatArray): Steps {
    val count = onset.size
    // The sound is judged against the song's own: each band less what that
    // band usually holds, so what is compared is how a step differs from the
    // rest of the record and not the shape every step of it shares.
    val bands = if (count > 0) sound[0].size else 0
    val mean = DoubleArray(bands)
    val spread = DoubleArray(bands)
    for (row in sound) for (band in 0 until bands) mean[band] += row[band]
    for (band in 0 until bands) mean[band] /= maxOf(1, count)
    for (row in sound) for (band in 0 until bands) {
      spread[band] += (row[band] - mean[band]) * (row[band] - mean[band])
    }
    for (band in 0 until bands) spread[band] = sqrt(spread[band] / maxOf(1, count)) + 1e-9
    val scored = Array(count) { index ->
      val row = FloatArray(bands) { ((sound[index][it] - mean[it]) / spread[it]).toFloat() }
      var length = 0.0
      for (value in row) length += value * value
      val scale = (sqrt(length) + 1e-9).toFloat()
      FloatArray(bands) { row[it] / scale }
    }

    val onsetMean = if (count > 0) onset.average() else 0.0
    var onsetSpread = 0.0
    for (value in onset) onsetSpread += (value - onsetMean) * (value - onsetMean)
    onsetSpread = sqrt(onsetSpread / maxOf(1, count)) + 1e-9
    return Steps(
      unit(harmony),
      scored,
      FloatArray(count) { ((onset[it] - onsetMean) / onsetSpread).toFloat() }
    )
  }

  private fun dot(a: FloatArray, b: FloatArray): Double {
    var sum = 0.0
    for (i in a.indices) sum += a[i] * b[i]
    return sum
  }

  /** How alike the song is to itself slid along by [lag] steps. */
  private fun alike(steps: Steps, lag: Int): Double {
    val pairs = steps.count - lag
    if (pairs <= 0) return 0.0
    var harmony = 0.0
    var sound = 0.0
    var onset = 0.0
    for (i in 0 until pairs) {
      harmony += dot(steps.harmony[i + lag], steps.harmony[i])
      sound += dot(steps.sound[i + lag], steps.sound[i])
      onset += steps.onset[i + lag] * steps.onset[i]
    }
    return (harmony / pairs + sound / pairs) / 2 + 0.5 * (onset / pairs)
  }

  /**
   * How many steps make a bar: eight, or six.
   *
   * Whichever the song is more like itself at. Eight is four beats of two
   * steps; six is the two beats of three that a song in compound time is
   * built from. Nothing else is looked for, because the steps are already the
   * song's own smallest and these are the two ways a bar is made of them.
   */
  fun length(steps: Steps): Int {
    /*
      Half a bar along, one bar and two, and no further. Three bars of eight
      are four bars of six, so a song built in three-bar phrases is like itself
      at twenty-four steps whichever it is, and asking that far out lets the
      shape of the song answer a question about the shape of its bar. The half
      bar is the surest of the three: a bar of eight steps is alike at four,
      and a bar of six at three, almost whatever is played in it.
    */
    val even = alike(steps, 4) + alike(steps, 8) + alike(steps, 16)
    val triple = alike(steps, 3) + alike(steps, 6) + alike(steps, 12)
    return if (triple > even) 6 else 8
  }

  /**
   * Which step a bar starts on, from nought to one less than its length.
   *
   * Where the low end hits hardest, bar after bar: the kick and the bass come
   * down on the one. It need not be right to be useful -- the kinds below only
   * need every bar cut at the same place -- but cut at the real bar line, a bar
   * is a thing a player hears as one.
   */
  fun start(low: FloatArray, bar: Int): Int {
    var best = 0
    var bestMean = Double.NEGATIVE_INFINITY
    for (phase in 0 until bar) {
      var sum = 0.0
      var count = 0
      var step = phase
      while (step < low.size) {
        sum += low[step]
        count++
        step += bar
      }
      val mean = if (count > 0) sum / count else 0.0
      if (mean > bestMean) {
        bestMean = mean
        best = phase
      }
    }
    return best
  }

  /**
   * The kind of every whole bar: the number of the first bar it is the same
   * music as, which for a bar unlike any before it is its own.
   *
   * Compared with the first of each kind and never with its later members, so
   * a kind cannot drift: a chain of bars each a little unlike the last would
   * otherwise join a verse to a chorus by way of everything between them.
   */
  fun kinds(steps: Steps, bar: Int, start: Int): IntArray {
    val bars = if (steps.count > start) (steps.count - start) / bar else 0
    val kind = IntArray(bars)
    val firsts = ArrayList<Int>()

    // The rhythm of a bar, as a shape: its own steps less their mean, length one.
    val rhythm = Array(bars) { index ->
      val from = start + index * bar
      var mean = 0.0
      for (k in 0 until bar) mean += steps.onset[from + k]
      mean /= bar
      var length = 0.0
      for (k in 0 until bar) length += (steps.onset[from + k] - mean) * (steps.onset[from + k] - mean)
      val scale = sqrt(length) + 1e-9
      FloatArray(bar) { ((steps.onset[from + it] - mean) / scale).toFloat() }
    }

    for (index in 0 until bars) {
      val from = start + index * bar
      var best = -1
      var bestScore = 0.0
      for (first in firsts) {
        val other = start + first * bar
        var harmony = 0.0
        var sound = 0.0
        for (k in 0 until bar) {
          harmony += dot(steps.harmony[from + k], steps.harmony[other + k])
          sound += dot(steps.sound[from + k], steps.sound[other + k])
        }
        harmony /= bar
        sound /= bar
        val beat = dot(rhythm[index], rhythm[first])
        if (harmony >= SAME_HARMONY && sound >= SAME_SOUND && beat >= SAME_RHYTHM) {
          val score = harmony + sound + beat
          if (score > bestScore) {
            bestScore = score
            best = first
          }
        }
      }
      if (best < 0) {
        firsts.add(index)
        kind[index] = index
      } else {
        kind[index] = best
      }
    }
    return kind
  }

  /** The bars of each kind that has more than one, first bar first. */
  fun families(kind: IntArray): List<IntArray> {
    val members = HashMap<Int, ArrayList<Int>>()
    for (index in kind.indices) members.getOrPut(kind[index]) { ArrayList() }.add(index)
    return members.values.filter { it.size > 1 }.map { it.toIntArray() }
  }
}
