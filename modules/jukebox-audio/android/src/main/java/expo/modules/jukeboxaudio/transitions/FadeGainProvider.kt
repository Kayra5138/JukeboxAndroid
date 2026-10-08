package expo.modules.jukeboxaudio.transitions

import androidx.media3.common.audio.DefaultGainProvider
import androidx.media3.common.audio.GainProcessor

/**
 * A fade that can be changed while the audio is running.
 *
 * Media3 ships [DefaultGainProvider], which takes its whole plan at
 * construction — right for a fade known before playback starts, no use for one
 * decided by a finger on a button. This holds a plan that can be swapped at any
 * moment, and the audio thread picks it up on the next buffer.
 *
 * The curves themselves are still Media3's. Equal power is the one that matters
 * for a crossfade: two tracks each at half amplitude are not half as loud
 * together, they are louder, and a linear pair sags in the middle where a
 * square-root pair holds steady.
 */
class FadeGainProvider(
  /**
   * The sleep timer's ramp, which everything below is multiplied by.
   *
   * Not one of the plans, because a plan is replaced by the next one and this
   * has to outlast them; see [WindDown]. Null for a fader nothing winds down.
   */
  val windDown: WindDown? = null
) : GainProcessor.GainProvider {
  enum class Shape { UNITY, IN, OUT }

  /**
   * [leadInMs] is a very short ramp before an outgoing fade.
   *
   * It exists for the crossfade's one rough edge. The outgoing track is handed
   * to a second player which seeks to where the first one had got to, and a
   * seek is only as exact as the format allows; starting that player at full
   * volume would put any discrepancy on show as a click. A few milliseconds of
   * ramp covers it, and is far too short to hear as a fade.
   */
  private data class Plan(
    val generation: Long,
    val shape: Shape,
    val durationMs: Long,
    val leadInMs: Long,
    val equalPower: Boolean,
    /** How long an outgoing fade stays at full level before it starts down. */
    val holdMs: Long = 0
  )

  @Volatile private var plan = Plan(0, Shape.UNITY, 0, 0, true)

  /*
    Touched only from the audio thread, which is the only thread that calls
    either method below. The plan crosses over as a single volatile reference,
    so a half-written plan can never be read.
  */
  private var appliedGeneration = -1L
  private var anchor = 0L

  private var nextGeneration = 1L

  /** Ramp up from silence over [durationMs], then stay there. */
  @Synchronized
  fun fadeIn(durationMs: Long, equalPower: Boolean) {
    plan = Plan(nextGeneration++, Shape.IN, durationMs.coerceAtLeast(1), 0, equalPower)
  }

  /**
   * Ramp down to silence over [durationMs], and stay silent afterwards.
   *
   * [holdMs] puts the ramp off by that much of the stream, at full level
   * meanwhile. It is how a fade is booked for a place in the track rather than
   * for a moment on the clock: the gain is applied to samples a good part of a
   * second before they are heard, so a fade asked for "now" is heard late by
   * however much the sink was holding, and nobody upstream knows how much
   * that was. A player started a known distance before the place has no such
   * trouble. It counts that distance in its own samples and starts down on
   * the sample it was told to.
   */
  @Synchronized
  fun fadeOut(durationMs: Long, equalPower: Boolean, leadInMs: Long = 0, holdMs: Long = 0) {
    plan = Plan(
      nextGeneration++, Shape.OUT, durationMs.coerceAtLeast(1), leadInMs, equalPower,
      holdMs.coerceAtLeast(0)
    )
  }

  /** Stop interfering. */
  @Synchronized
  fun clear() {
    plan = Plan(nextGeneration++, Shape.UNITY, 0, 0, true)
  }

  /**
   * Where a fade counts from.
   *
   * The first buffer to see a new plan fixes its origin, rather than the plan
   * naming a position: a plan written in absolute positions would be measuring
   * against a clock it does not control. Anchoring on arrival means "from
   * here", which is what every caller actually wants.
   *
   * A position that goes backwards re-anchors too, and that is not a nicety.
   * Within an unbroken stream these positions only ever climb, so a fall can
   * only mean the sink has rebased the clock underneath us — which it does on
   * every flush, and a flush is not only a seek or a new item. Changing the
   * speed or the pitch reconfigures the processing chain, and the sink flushes
   * that chain with a stream position of zero. Left anchored where it was, a
   * fade-in armed part-way through a track (a fade on resume, a fade after a
   * seek) would then be asked for its gain at a position long before its own
   * origin and answer zero — silence, for as long as it takes the track to
   * play back up to where the anchor used to be. Re-anchoring restarts the
   * fade from the new origin instead, which is the same thing the caller asked
   * for, only counted from a position that still exists.
   */
  override fun getGainFactorAtSamplePosition(samplePosition: Long, sampleRate: Int): Float {
    val planned = plannedGain(samplePosition, sampleRate)
    val ceiling = windDown ?: return planned
    return planned * ceiling.gain()
  }

  private fun plannedGain(samplePosition: Long, sampleRate: Int): Float {
    val current = plan
    if (current.generation != appliedGeneration || samplePosition < anchor) {
      appliedGeneration = current.generation
      anchor = samplePosition
    }
    if (current.shape == Shape.UNITY) return 1f

    // Never negative: anything earlier than the anchor has just moved it.
    val index = samplePosition - anchor

    if (current.shape == Shape.IN) {
      val length = samples(current.durationMs, sampleRate)
      if (index >= length) return 1f
      return fade(true, current.equalPower).getGainFactorAt(index, length)
    }

    // Not yet. Counted in samples only when there is something to count, for
    // the same reason as the lead-in below.
    val hold = if (current.holdMs > 0) samples(current.holdMs, sampleRate) else 0
    if (index < hold) return 1f
    val started = index - hold

    // Asked for explicitly or not at all: rounding a lead-in of none up to a
    // single sample, as the duration below has to be, would open every
    // unadorned fade-out with one sample of silence.
    val lead = if (current.leadInMs > 0) samples(current.leadInMs, sampleRate) else 0
    if (started < lead) return fade(true, current.equalPower).getGainFactorAt(started, lead)

    val length = samples(current.durationMs, sampleRate)
    val offset = started - lead
    if (offset >= length) return 0f
    return fade(false, current.equalPower).getGainFactorAt(offset, length)
  }

  /**
   * How far the gain can be trusted to stay at one.
   *
   * Never [androidx.media3.common.C.TIME_END_OF_SOURCE], whatever the plan:
   * that answer at position zero is how [GainProcessor] decides it has nothing
   * to do, and a processor dropped from the chain cannot be brought back when a
   * fade is asked for later.
   *
   * Otherwise this is only an optimisation — it says how much of the buffer may
   * be copied without touching it. Twenty milliseconds at a time, so an idle
   * fader costs fifty questions a second rather than one per sample, and a fade
   * asked for in between starts no more than a buffer late.
   *
   * A fade-in that has run its course counts as idle, and that matters more
   * than it looks. Nothing clears a plan once it has finished, so a track that
   * faded in stays on an IN plan for the rest of its length; answering a single
   * frame at a time there would leave the audio thread making a call per frame
   * — tens of thousands a second — for as long as the track plays. That is
   * affordable until something expensive joins the chain, and changing the
   * speed or the pitch does exactly that.
   *
   * A wind-down that has begun is never idle, whatever the plan says. One
   * that is only booked is, which is what lets a ninety minute timer sit on
   * the fader for eighty-nine and a half of them at the price of a glance at
   * the clock per buffer.
   */
  override fun isUnityUntil(samplePosition: Long, sampleRate: Int): Long {
    val current = plan
    val settled = windDown?.begun() != true && when (current.shape) {
      Shape.UNITY -> true
      Shape.IN -> samplePosition - anchor >= samples(current.durationMs, sampleRate)
      Shape.OUT -> false
    }
    return if (settled) samplePosition + sampleRate / 50 else samplePosition + 1
  }

  private fun samples(milliseconds: Long, sampleRate: Int): Long =
    (milliseconds * sampleRate / 1000).coerceAtLeast(1)

  private fun fade(rising: Boolean, equalPower: Boolean): DefaultGainProvider.FadeProvider =
    when {
      rising && equalPower -> DefaultGainProvider.FADE_IN_EQUAL_POWER
      rising -> DefaultGainProvider.FADE_IN_LINEAR
      equalPower -> DefaultGainProvider.FADE_OUT_EQUAL_POWER
      else -> DefaultGainProvider.FADE_OUT_LINEAR
    }
}
