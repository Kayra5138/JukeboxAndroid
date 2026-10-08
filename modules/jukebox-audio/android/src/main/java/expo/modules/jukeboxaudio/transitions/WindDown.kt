package expo.modules.jukeboxaudio.transitions

import android.os.SystemClock

/**
 * The long way down at the end of a sleep timer.
 *
 * A second thing turning the sound down, beside the fades in
 * [FadeGainProvider], and kept apart from them because it is not like them.
 * Those are a plan apiece and each replaces the last: a pause fade is called
 * off by a fade-in, a seek softens whatever came before it. Half a minute of
 * getting quieter has to survive all of that -- a track ending inside it, a
 * crossfade, a seek -- so it is not a plan at all. It is a ceiling the plans
 * are multiplied by, and it is the same ceiling for the crossfade's second
 * player as for the first, or a track handing over in the last half minute
 * would be heard leaving at full volume over one that had nearly gone.
 *
 * Counted on the clock, where every other fade here is counted in samples. A
 * count of samples starts again at every flush, and there is one at each seek
 * and each change of track; and two players cannot share one count. What is
 * given up is exactness nobody could hear at this length: audio is shaped a
 * buffer at a time, so the ramp goes down in a thousand small steps rather
 * than a slope.
 *
 * Still inside the pipeline, like the others, and for the reason the others
 * are: there is no player volume to forget to put back.
 */
class WindDown(private val clock: () -> Long = SystemClock::elapsedRealtime) {
  private class Ramp(val fromMs: Long, val toMs: Long)

  @Volatile private var ramp: Ramp? = null

  /**
   * Full volume until [fromMs], silence from [toMs], both on this clock.
   *
   * May be booked long before it begins. Until then it costs the audio thread
   * one look at the clock per buffer and changes nothing.
   */
  fun over(fromMs: Long, toMs: Long) {
    ramp = if (toMs > fromMs) Ramp(fromMs, toMs) else null
  }

  fun clear() {
    ramp = null
  }

  /** Whether any sound has been turned down yet. */
  fun begun(): Boolean = ramp?.let { clock() >= it.fromMs } ?: false

  fun gain(): Float = ramp?.let { windDownGain(it.fromMs, it.toMs, clock()) } ?: 1f

  companion object {
    /**
     * How long the silence at the bottom is believed.
     *
     * Whoever asked for the ramp pauses the player at the end of it and clears
     * it. If that never happens the music would go on playing with nothing to
     * be heard, which from the outside is a player that has stopped working
     * and cannot be made to start. So silence is only held for this long, and
     * then the ramp is taken to have been abandoned.
     */
    const val ABANDONED_AFTER_MS = 5_000L
  }
}

/**
 * How loud the ramp from [fromMs] to [toMs] leaves things at [nowMs].
 *
 * A straight line. Equal power is for two tracks crossing, where the pair has
 * to add up to a steady loudness; here there is one track and nothing for it
 * to add up with, and the line is the shape that is barely noticed for the
 * first half and gone by the end.
 */
fun windDownGain(fromMs: Long, toMs: Long, nowMs: Long): Float = when {
  nowMs <= fromMs -> 1f
  nowMs >= toMs + WindDown.ABANDONED_AFTER_MS -> 1f
  nowMs >= toMs -> 0f
  else -> (toMs - nowMs).toFloat() / (toMs - fromMs).toFloat()
}
