package expo.modules.jukeboxaudio.sleep

/**
 * The judgement in a sleep timer, apart from the machinery that acts on it.
 *
 * Nothing here knows about a player or a clock of its own: times are handed
 * in, on whatever clock the caller keeps, so every rule can be stated and
 * checked without a phone.
 */

/** How long the music takes to go quiet before it is paused. */
const val FADE_MS = 30_000L

/**
 * How far ahead of the pause the fade reaches silence.
 *
 * The fade is applied to audio on its way into the sink, and the sink holds
 * up to three quarters of a second of it before any is heard. A ramp that
 * touched nothing at the very moment of the pause would have its last stretch
 * still waiting in that buffer: the music would be cut off while faintly
 * audible, and what was left would be heard at the next press of play.
 */
const val SINK_LEAD_MS = 750L

/** Shorter than this is a pause button; see [sleepLength]. */
const val MIN_SLEEP_MS = 1_000L

/** A day. Past it the number is a slip of the finger, not a bedtime. */
const val MAX_SLEEP_MS = 24 * 60 * 60 * 1000L

/** What a timer that has run out does. */
enum class Expiry {
  /** Nothing was playing. The timer goes and nothing else changes. */
  CLEAR,

  /** Pause where it stands. */
  PAUSE,

  /** Leave it playing, and pause when the track comes to its end. */
  FINISH_TRACK
}

/**
 * What happens when the time is up.
 *
 * [playing] is whether the player has been asked to play and has something to
 * play, not whether sound is coming out. A phone call holds the music without
 * anybody having paused it, and a timer that ran out during the call should
 * not let the music come back after it.
 *
 * Paused by hand, the timer has nothing to do, and that is all it does. It is
 * not kept for the next press of play: somebody who starts the music again
 * after their timer ran out has changed their mind about being asleep, and a
 * timer waiting to stop them a moment later would be a fault.
 */
fun atExpiry(playing: Boolean, finishTrack: Boolean): Expiry = when {
  !playing -> Expiry.CLEAR
  finishTrack -> Expiry.FINISH_TRACK
  else -> Expiry.PAUSE
}

/**
 * When the fade begins and when it reaches silence, or null for no fade.
 *
 * None for a timer that lets the track finish: a track that ends of its own
 * accord has its own ending, and turning it down as well would be fading out
 * the last half minute of something that was asked to be heard to the end.
 *
 * A timer shorter than the fade is all fade, from the moment it is set.
 */
fun fadeWindow(
  startMs: Long,
  deadlineMs: Long,
  fade: Boolean,
  finishTrack: Boolean
): Pair<Long, Long>? {
  if (!fade || finishTrack) return null
  val silentAt = deadlineMs - SINK_LEAD_MS
  val from = maxOf(startMs, deadlineMs - FADE_MS)
  return if (silentAt > from) from to silentAt else null
}

/**
 * The length a timer was asked for, if it is one that can be kept.
 *
 * Null for nought, a negative figure or less than a second, all of which are
 * a request for nothing. A figure past a day is held to a day rather than
 * refused: it was a real request, only a careless one.
 */
fun sleepLength(askedMs: Long?): Long? {
  if (askedMs == null || askedMs < MIN_SLEEP_MS) return null
  return askedMs.coerceAtMost(MAX_SLEEP_MS)
}
