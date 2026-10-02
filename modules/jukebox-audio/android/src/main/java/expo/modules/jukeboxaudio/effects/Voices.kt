package expo.modules.jukeboxaudio.effects

import java.util.Arrays
import kotlin.math.PI
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * The four treatments a record can be played through, and the state each needs.
 *
 * Every one of these keeps the record's own harmonics and alters them, which is
 * the whole difference between these and the vocoder they replace: a vocoder
 * throws the harmonics away and rebuilds the sound from one tone, so a finished
 * mix comes out of it as a buzz with the song's rhythm and none of its pitch.
 * These were chosen by rendering a passage through each and listening — the
 * numbers below are the ones that survived that, not ones arrived at by
 * reasoning, and they should not be moved without hearing the result.
 *
 * ## Why these are classes rather than functions over an array
 *
 * The listening harness works on a whole passage at once. The player does not:
 * [EffectsProcessor.queueInput] is handed one buffer after another, a few tens
 * of milliseconds each, and the sound has to run through the join as if there
 * were no join. So everything that a function over an array would have kept in
 * a local — the carrier's phase, the delay line and where it is being written,
 * the pitch shifter's two readers, the filter's last output — is a field here,
 * and one chain lives on the processor for the whole of a stream. Building
 * these per buffer would put a click on every buffer boundary.
 */
object VoiceKind {
  const val NONE = 0
  const val ROBOT = 1
  const val VINTAGE = 2
  const val SWIRL = 3
  const val CHIPMUNK = 4
  const val SQUEAK = 5

  /**
   * Resolved once per buffer rather than per sample.
   *
   * The setting is a string because that is what crosses from JavaScript and
   * what is written to the file; comparing strings a few thousand times a
   * buffer is not.
   */
  fun of(voice: String): Int = when (voice) {
    Effects.ROBOT -> ROBOT
    Effects.VINTAGE -> VINTAGE
    Effects.SWIRL -> SWIRL
    Effects.CHIPMUNK -> CHIPMUNK
    Effects.SQUEAK -> SQUEAK
    else -> NONE
  }
}

/**
 * One channel's worth of every voice.
 *
 * One of these per channel, never one shared between two. Three of the four
 * have memory — a delay line, a held sample, a filter's last output — and two
 * channels taking turns to read and write one line would hear each other's
 * sound half a sample late, which is a comb filter nobody asked for.
 *
 * Running a separate copy per channel keeps the stereo image: the carrier, the
 * sweep and the sample clock are all driven by nothing but a count of samples,
 * so two copies stepped once per frame each from the same starting point stay
 * in lockstep for the whole of a stream. Both ears therefore get the same
 * treatment, applied to what each of them actually contains.
 *
 * Every block is built once, when the stream is flushed, because each of them
 * owns an array and the audio thread is not a place to be allocating.
 */
class VoiceChain(sampleRate: Int) {
  /*
    Guarded because every one of these divides by it. A rate of zero would put
    an infinity in a phase accumulator and never get it out again.
  */
  private val rate = sampleRate.coerceAtLeast(8_000)

  private val ring = RingMod(rate, ROBOT_CARRIER_HZ)
  private val crush = Crush(rate, VINTAGE_BITS, VINTAGE_HOLD_HZ)
  private val vintageTop = OnePole(rate, VINTAGE_CUT_HZ)
  private val comb = Comb(rate, SWIRL_SWEEP_HZ, SWIRL_DEPTH_MS)
  private val pitch = PitchUp(rate, CHIPMUNK_SEMITONES)
  private val pitchMore = PitchUp(rate, SQUEAK_SEMITONES)

  /** Empties every line and returns every clock to its beginning. */
  fun reset() {
    ring.reset()
    crush.reset()
    vintageTop.reset()
    comb.reset()
    pitch.reset()
    pitchMore.reset()
  }

  /**
   * One sample in, one out.
   *
   * [kind] is one of [VoiceKind]; [mix] is how much of the treated sound is
   * heard against the record it was made from. At a mix of nought the sample
   * comes back exactly as it arrived, which is what makes the control safe to
   * drag to the bottom.
   */
  fun step(kind: Int, sample: Float, mix: Float): Float {
    val wet = when (kind) {
      VoiceKind.ROBOT -> ring.step(sample)
      // The low-pass is not optional. Holding a sample for several periods
      // folds everything above half the hold rate back down into the audible
      // band, and without the top taken off afterwards that folded-down part
      // is heard as hiss sitting on the music rather than as character.
      VoiceKind.VINTAGE -> vintageTop.step(crush.step(sample))
      VoiceKind.SWIRL -> comb.step(sample)
      VoiceKind.CHIPMUNK -> pitch.step(sample)
      VoiceKind.SQUEAK -> pitchMore.step(sample)
      else -> return sample
    }
    return sample * (1f - mix) + wet * mix
  }

  companion object {
    /** Low enough to be a tone in its own right rather than a tremble. */
    const val ROBOT_CARRIER_HZ = 50.0

    /* A handful of levels and a coarse clock, then the top taken off. */
    const val VINTAGE_BITS = 5
    const val VINTAGE_HOLD_HZ = 9_000
    const val VINTAGE_CUT_HZ = 3_000.0

    /**
     * Slow enough that a turn is heard as a turn.
     *
     * The two that were listened to sat at 0.2 Hz and 0.35 Hz; this is between
     * them, at the depth the shallower of the two used.
     */
    const val SWIRL_SWEEP_HZ = 0.35
    const val SWIRL_DEPTH_MS = 6.0

    /**
     * A fifth, and an octave.
     *
     * Both were listened to and both were wanted: the fifth still sounds like
     * someone singing, where the octave has left being a voice behind. Two
     * settings of one effect rather than one compromise between them.
     */
    const val CHIPMUNK_SEMITONES = 7.0
    const val SQUEAK_SEMITONES = 12.0
  }
}

/**
 * Ring modulation: the sound multiplied by a tone.
 *
 * Every partial is replaced by a pair of them, one either side of the carrier,
 * so what comes out is inharmonic — bell-like, metallic, not of this world.
 * Rhythm and phrasing survive completely, which is why the song stays
 * recognisable while sounding like something else is producing it.
 */
private class RingMod(rate: Int, hz: Double) {
  private val advance = hz / rate
  private var phase = 0.0

  fun reset() {
    phase = 0.0
  }

  fun step(sample: Float): Float {
    phase += advance
    if (phase >= 1.0) phase -= 1.0
    return sample * sin(phase * 2.0 * PI).toFloat()
  }
}

/**
 * Fewer bits and a coarser clock: the sound of something cheap reproducing it.
 *
 * Quantising to a handful of levels adds harmonics that were never there, and
 * holding each sample for several periods folds the top of the spectrum back
 * down over the rest. Together they are the sound of a toy, a doorbell, a 1980s
 * speaking machine.
 */
private class Crush(rate: Int, bits: Int, holdHz: Int) {
  private val levels = (1 shl (bits - 1)).toFloat()
  private val every = (rate / holdHz).coerceAtLeast(1)

  /*
    A count rather than the sample's position in the buffer. The harness could
    use the index into the passage because it had the whole passage; here the
    clock has to carry on over a buffer boundary, and a count that restarts
    with each buffer would re-time the hold on every one of them.
  */
  private var since = 0
  private var held = 0f

  fun reset() {
    since = 0
    held = 0f
  }

  fun step(sample: Float): Float {
    if (since == 0) held = (sample * levels).roundToInt() / levels
    since += 1
    if (since >= every) since = 0
    return held
  }
}

/**
 * A plain one-pole roll-off.
 *
 * What [Crush] needs after it, and nothing more than that: the difference
 * between an old radio and a bad cable.
 */
private class OnePole(rate: Int, hz: Double) {
  private val cut = (2.0 * PI * hz / rate).toFloat().coerceIn(0.001f, 0.95f)
  private var held = 0f

  fun reset() {
    held = 0f
  }

  fun step(sample: Float): Float {
    held += (sample - held) * cut
    return held
  }
}

/**
 * The sound added to a delayed copy of itself, the delay moving.
 *
 * Peaks and notches march up and down the spectrum as the delay changes — a jet
 * passing, a voice down a pipe. Keeps every note where it was, which is why a
 * song stays entirely itself underneath it.
 */
private class Comb(rate: Int, sweepHz: Double, depthMs: Double) {
  private val longest = (rate * depthMs / 1000.0).toInt().coerceAtLeast(2)
  private val line = FloatArray(longest + 2)
  private val advance = sweepHz / rate
  private var at = 0
  private var phase = 0.0

  fun reset() {
    Arrays.fill(line, 0f)
    at = 0
    phase = 0.0
  }

  fun step(sample: Float): Float {
    phase += advance
    if (phase >= 1.0) phase -= 1.0
    val wanted = (longest * 0.5) * (1.0 + sin(phase * 2.0 * PI))
    // Between two samples of the line, because a delay that jumps a whole
    // sample at a time clicks on every jump.
    val back = wanted.toInt().coerceIn(0, longest)
    val fraction = (wanted - back).toFloat()
    val first = line[(at - back + line.size) % line.size]
    val second = line[(at - back - 1 + line.size) % line.size]
    val delayed = first * (1f - fraction) + second * fraction

    // Half of what came back goes round again, which is what turns a single
    // notch into a row of them. Under one, so it settles rather than builds.
    line[at] = sample + delayed * 0.5f
    at = (at + 1) % line.size

    return (sample + delayed) * 0.5f
  }
}

/**
 * Everything moved up in pitch, and nothing moved in time.
 *
 * Two readers running through a delay line faster than it is written, half a
 * window apart and faded between, so that where one runs out the other is in
 * the middle of its own pass. Crude next to what a phase vocoder would do, and
 * audible as a slight warble, but it is the shape of the chipmunk.
 */
private class PitchUp(rate: Int, semitones: Double) {
  private val advance = Math.pow(2.0, semitones / 12.0)
  private val window = (rate * 0.045).toInt().coerceAtLeast(64)
  private val line = FloatArray(window * 2)
  private var write = 0
  private var read = 0.0

  fun reset() {
    Arrays.fill(line, 0f)
    write = 0
    read = 0.0
  }

  private fun tap(at: Double): Float {
    val whole = at.toInt() % line.size
    val next = (whole + 1) % line.size
    val fraction = (at - at.toInt()).toFloat()
    return line[whole] * (1f - fraction) + line[next] * fraction
  }

  fun step(sample: Float): Float {
    line[write] = sample
    write = (write + 1) % line.size

    read += advance
    if (read >= line.size) read -= line.size

    // How far this reader is from the writer decides how much of it is heard:
    // it is faded out as it catches up, while the other, half a line away, is
    // fading in.
    val gap = ((write - read + line.size) % line.size) / line.size
    val fade = sin(gap * PI).toFloat()
    val other = (read + line.size / 2.0) % line.size
    return tap(read) * fade + tap(other) * (1f - fade)
  }
}
