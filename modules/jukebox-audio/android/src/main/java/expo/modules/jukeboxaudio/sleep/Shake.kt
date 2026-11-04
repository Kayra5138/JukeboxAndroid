package expo.modules.jukeboxaudio.sleep

import kotlin.math.sqrt

/**
 * Tells a shake of the phone from everything else a phone in a bed goes
 * through: being turned over with the person holding it, slid under a pillow,
 * knocked onto the floor.
 *
 * What a shake has that those do not is repetition. One jolt is a phone put
 * down hard or dropped; a shake is the phone thrown one way and back several
 * times in a second. So it is a count of jolts — moments when the phone is
 * pushed well past what gravity alone does to it — close enough together, and
 * a pause after one is heard before another can be, so that a long shake is
 * one request and not three.
 *
 * Pure arithmetic on readings handed in, with their times in milliseconds on
 * whatever clock the caller keeps, so it is tested without a phone. The
 * figures are a first guess at what a deliberate shake in the hand does, and
 * are worth adjusting against a real phone.
 */
class ShakeDetector(
  /** How hard a jolt is, in multiples of gravity. Resting, a phone reads one. */
  private val joltG: Float = JOLT_G,
  /** How many jolts make a shake. */
  private val jolts: Int = JOLTS,
  /** Within how long of each other they have to come. */
  private val withinMs: Long = WITHIN_MS,
  /** Less than this apart is one jolt read twice, the same push lasting over a few readings. */
  private val apartMs: Long = APART_MS,
  /** After a shake, how long before another is listened for. */
  private val restMs: Long = REST_MS
) {
  private val times = ArrayDeque<Long>()
  private var lastJolt = Long.MIN_VALUE
  private var restUntil = Long.MIN_VALUE

  /**
   * One reading of the accelerometer, in metres per second squared on each
   * axis, gravity included, at [atMs]. True where it completes a shake.
   */
  fun reading(atMs: Long, x: Float, y: Float, z: Float): Boolean {
    if (atMs < restUntil) return false
    val g = sqrt(x * x + y * y + z * z) / GRAVITY
    if (g < joltG) return false
    if (lastJolt != Long.MIN_VALUE && atMs - lastJolt < apartMs) return false
    lastJolt = atMs
    times.addLast(atMs)
    while (times.isNotEmpty() && atMs - times.first() > withinMs) times.removeFirst()
    if (times.size < jolts) return false
    times.clear()
    restUntil = atMs + restMs
    return true
  }

  /** Everything forgotten, as before the first reading: for listening again after a while. */
  fun reset() {
    times.clear()
    lastJolt = Long.MIN_VALUE
    restUntil = Long.MIN_VALUE
  }

  companion object {
    const val GRAVITY = 9.80665f
    const val JOLT_G = 2.2f
    const val JOLTS = 3
    const val WITHIN_MS = 1_000L
    const val APART_MS = 100L
    const val REST_MS = 2_000L
  }
}
