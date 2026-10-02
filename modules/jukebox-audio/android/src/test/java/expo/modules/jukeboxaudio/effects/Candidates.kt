package expo.modules.jukeboxaudio.effects

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Ways of colouring a finished mix, for choosing between by ear.
 *
 * Test-only on purpose: none of this is in the player yet. What survives being
 * listened to gets moved into the processor, and what does not costs nothing.
 *
 * What they have in common, and what the vocoder does not: every one of these
 * keeps the record's own harmonics and alters them. The vocoder throws them
 * away and rebuilds the sound from one tone, which is why it can turn a song
 * into a buzz — there is nothing of the song's pitch left in what comes out,
 * only how loud each band was.
 */
internal object Candidates {

  /**
   * Ring modulation: the sound multiplied by a tone.
   *
   * Every partial is replaced by a pair of them, one either side of the
   * carrier, so what comes out is inharmonic — bell-like, metallic, not of this
   * world. The classic robot voice of television, and one multiply a sample.
   * Rhythm and phrasing survive completely, which is why the song stays
   * recognisable while sounding like something else is producing it.
   */
  fun ringMod(input: FloatArray, rate: Int, hz: Double, mix: Float): FloatArray {
    var phase = 0.0
    return FloatArray(input.size) { index ->
      phase += hz / rate
      if (phase >= 1.0) phase -= 1.0
      val ring = input[index] * sin(phase * 2.0 * PI).toFloat()
      input[index] * (1f - mix) + ring * mix
    }
  }

  /**
   * Two ring modulators a little apart, which wobbles rather than hums.
   *
   * A single carrier is static and quickly tiring. Beating two against each
   * other gives it something alive, and is the difference between a machine
   * and a creature.
   */
  fun alien(input: FloatArray, rate: Int, hz: Double, spread: Double, mix: Float): FloatArray {
    var a = 0.0
    var b = 0.0
    return FloatArray(input.size) { index ->
      a += hz / rate
      b += (hz + spread) / rate
      if (a >= 1.0) a -= 1.0
      if (b >= 1.0) b -= 1.0
      val ring = input[index] *
        ((sin(a * 2.0 * PI) + sin(b * 2.0 * PI)) * 0.5).toFloat()
      input[index] * (1f - mix) + ring * mix
    }
  }

  /**
   * Fewer bits and a coarser clock: the sound of something cheap reproducing it.
   *
   * Quantising to a handful of levels adds harmonics that were never there, and
   * holding each sample for several periods folds the top of the spectrum back
   * down over the rest. Together they are the sound of a toy, a doorbell, a
   * 1980s speaking machine.
   */
  fun crush(input: FloatArray, rate: Int, bits: Int, holdHz: Int, mix: Float): FloatArray {
    val levels = (1 shl (bits - 1)).toFloat()
    val every = (rate / holdHz).coerceAtLeast(1)
    var held = 0f
    return FloatArray(input.size) { index ->
      if (index % every == 0) {
        held = (input[index] * levels).roundToInt() / levels
      }
      input[index] * (1f - mix) + held * mix
    }
  }

  /**
   * The sound added to a delayed copy of itself, the delay moving.
   *
   * Peaks and notches march up and down the spectrum as the delay changes —
   * a jet passing, a voice down a pipe. Keeps every note where it was, which is
   * why a song stays entirely itself underneath it.
   */
  fun comb(input: FloatArray, rate: Int, sweepHz: Double, depthMs: Double, mix: Float): FloatArray {
    val longest = (rate * depthMs / 1000.0).toInt().coerceAtLeast(2)
    val line = FloatArray(longest + 2)
    var at = 0
    var phase = 0.0
    return FloatArray(input.size) { index ->
      phase += sweepHz / rate
      if (phase >= 1.0) phase -= 1.0
      val wanted = (longest * 0.5) * (1.0 + sin(phase * 2.0 * PI))
      // Between two samples of the line, because a delay that jumps a whole
      // sample at a time clicks on every jump.
      val back = wanted.toInt().coerceIn(0, longest)
      val fraction = (wanted - back).toFloat()
      val first = line[(at - back + line.size) % line.size]
      val second = line[(at - back - 1 + line.size) % line.size]
      val delayed = first * (1f - fraction) + second * fraction

      line[at] = input[index] + delayed * 0.5f
      at = (at + 1) % line.size

      input[index] * (1f - mix) + (input[index] + delayed) * 0.5f * mix
    }
  }

  /**
   * Everything moved up in pitch, and nothing moved in time.
   *
   * Two readers running through a delay line faster than it is written, half a
   * window apart and faded between, so that where one runs out the other is in
   * the middle of its own pass. Crude next to what a phase vocoder would do,
   * and audible as a slight warble, but it is the shape of the chipmunk — and a
   * chipmunk is very nearly a cat.
   */
  fun pitchUp(input: FloatArray, rate: Int, semitones: Double, mix: Float): FloatArray {
    val step = Math.pow(2.0, semitones / 12.0)
    val window = (rate * 0.045).toInt().coerceAtLeast(64)
    val line = FloatArray(window * 2)
    var write = 0
    var read = 0.0

    return FloatArray(input.size) { index ->
      line[write] = input[index]
      write = (write + 1) % line.size

      read += step
      if (read >= line.size) read -= line.size

      fun tap(at: Double): Float {
        val whole = at.toInt() % line.size
        val next = (whole + 1) % line.size
        val fraction = (at - at.toInt()).toFloat()
        return line[whole] * (1f - fraction) + line[next] * fraction
      }

      // How far this reader is from the writer decides how much of it is heard:
      // it is faded out as it catches up, while the other, half a line away, is
      // fading in.
      val gap = ((write - read + line.size) % line.size) / line.size
      val fade = sin(gap * PI).toFloat()
      val other = (read + line.size / 2.0) % line.size
      val shifted = tap(read) * fade + tap(other) * (1f - fade)

      input[index] * (1f - mix) + shifted * mix
    }
  }

  /**
   * A plain one-pole roll-off.
   *
   * What [crush] needs after it. Holding a sample for several periods folds
   * everything above half the hold rate back down into the audible band as
   * frequencies that were never in the record — heard as hiss sitting on top of
   * the music rather than as part of it. Taking the top off afterwards removes
   * the folded-down part and leaves the character, which is the difference
   * between an old radio and a bad cable.
   */
  fun lowpass(input: FloatArray, rate: Int, hz: Double): FloatArray {
    val cut = (2.0 * PI * hz / rate).toFloat().coerceIn(0.001f, 0.95f)
    var held = 0f
    return FloatArray(input.size) { index ->
      held += (input[index] - held) * cut
      held
    }
  }

  /** Peak level, for putting variants at a comparable loudness. */
  fun normalise(samples: FloatArray, to: Float = 0.89f): FloatArray {
    var loudest = 0f
    for (sample in samples) loudest = maxOf(loudest, abs(sample))
    if (loudest < 1e-6f) return samples
    val scale = to / loudest
    return FloatArray(samples.size) { samples[it] * scale }
  }

  /** A gentle lift of the upper formants, which is what makes a voice small. */
  fun brighten(input: FloatArray, rate: Int, amount: Float): FloatArray {
    // One-pole high shelf, done as "the sound plus its own high end".
    var last = 0f
    val cut = (2.0 * PI * 1_800.0 / rate).toFloat().coerceAtMost(0.9f)
    return FloatArray(input.size) { index ->
      last += (input[index] - last) * cut
      val high = input[index] - last
      input[index] + high * amount
    }
  }
}
