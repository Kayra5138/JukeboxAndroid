package expo.modules.jukeboxaudio.effects

/**
 * A room the music is played into: Jezar's Freeverb, eight combs that ring
 * at lengths with no common factor, damped a little more on each pass so the
 * top dies first as it does off real walls, and four all-passes after them
 * that smear the echoes into a wash rather than a flutter.
 *
 * Written here rather than asked of the phone. Android has a reverb of its
 * own, but on a good many phones it is not there, or is there and silent, and
 * on this one it sits in the same chain as the maker's own processing; one
 * that is a few hundred lines of arithmetic sounds the same on every phone.
 *
 * Two of everything, one per ear, the right ear's lines a little longer than
 * the left's so the two are not the same echo, which is what gives the room
 * its width. Its lengths are for 44.1 kHz and scaled for any other rate, so
 * the same room is the same size whatever the file was made at.
 */
class Reverb(sampleRate: Int) {
  private val scale = sampleRate / 44_100f
  // Arrays, gone through by index: a list's loop made an iterator four times a sample, two hundred thousand a second.
  private val combsLeft = Array(COMBS.size) { Comb(length(COMBS[it])) }
  private val combsRight = Array(COMBS.size) { Comb(length(COMBS[it] + SPREAD)) }
  private val passesLeft = Array(PASSES.size) { AllPass(length(PASSES[it])) }
  private val passesRight = Array(PASSES.size) { AllPass(length(PASSES[it] + SPREAD)) }

  private fun length(samples: Int) = (samples * scale).toInt().coerceAtLeast(1)

  /** Nothing left ringing: a seek, a new song, or the room just turned on. */
  fun reset() {
    combsLeft.forEach { it.reset() }
    combsRight.forEach { it.reset() }
    passesLeft.forEach { it.reset() }
    passesRight.forEach { it.reset() }
  }

  /** The room's sound for one frame, left in [out]`[0]` and right in [out]`[1]`; only the reverb, not the music it was fed. */
  fun step(left: Float, right: Float, out: FloatArray) {
    val fed = (left + right) * INPUT_GAIN
    var wetLeft = 0f
    var wetRight = 0f
    for (index in combsLeft.indices) wetLeft += combsLeft[index].step(fed)
    for (index in combsRight.indices) wetRight += combsRight[index].step(fed)
    for (index in passesLeft.indices) wetLeft = passesLeft[index].step(wetLeft)
    for (index in passesRight.indices) wetRight = passesRight[index].step(wetRight)
    out[0] = wetLeft
    out[1] = wetRight
  }

  private class Comb(size: Int) {
    private val line = FloatArray(size)
    private var at = 0
    private var kept = 0f

    fun reset() {
      line.fill(0f)
      kept = 0f
    }

    fun step(input: Float): Float {
      val output = line[at]
      // Each pass back round a little duller than the last.
      kept = output * (1f - DAMP) + kept * DAMP
      line[at] = input + kept * FEEDBACK
      at = if (at + 1 == line.size) 0 else at + 1
      return output
    }
  }

  private class AllPass(size: Int) {
    private val line = FloatArray(size)
    private var at = 0

    fun reset() = line.fill(0f)

    fun step(input: Float): Float {
      val held = line[at]
      line[at] = input + held * 0.5f
      at = if (at + 1 == line.size) 0 else at + 1
      return held - input
    }
  }

  companion object {
    /** The lines' lengths at 44.1 kHz, Freeverb's own. */
    private val COMBS = intArrayOf(1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617)
    private val PASSES = intArrayOf(556, 441, 341, 225)

    /** How much longer the right ear's lines are. */
    private const val SPREAD = 23

    /** How much of each echo comes round again: a large room, which is what the slowed songs are played in. */
    private const val FEEDBACK = 0.84f * 0.28f + 0.7f

    /** How much of the top each pass round loses. */
    private const val DAMP = 0.35f

    /** Freeverb's own, which keeps eight combs summed from clipping. */
    private const val INPUT_GAIN = 0.015f
  }
}
