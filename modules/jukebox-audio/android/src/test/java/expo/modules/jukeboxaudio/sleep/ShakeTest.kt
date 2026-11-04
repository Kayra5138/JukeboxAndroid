package expo.modules.jukeboxaudio.sleep

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShakeTest {
  private val g = ShakeDetector.GRAVITY

  /** A reading of [times] gravity, all of it down one axis. */
  private fun ShakeDetector.at(ms: Long, times: Float) = reading(ms, 0f, 0f, g * times)

  @Test
  fun `a phone lying still is no shake`() {
    val detector = ShakeDetector()
    for (ms in 0L until 10_000L step 20) assertFalse(detector.at(ms, 1f))
  }

  @Test
  fun `three hard jolts within a second are a shake`() {
    val detector = ShakeDetector()
    assertFalse(detector.at(0, 3f))
    assertFalse(detector.at(250, 3f))
    assertTrue(detector.at(500, 3f))
  }

  @Test
  fun `counts the push of every axis together`() {
    val detector = ShakeDetector()
    // Two and a half gravities, spread over the three axes.
    val each = g * 2.5f / kotlin.math.sqrt(3f)
    assertFalse(detector.reading(0, each, each, each))
    assertFalse(detector.reading(200, -each, -each, -each))
    assertTrue(detector.reading(400, each, each, each))
  }

  @Test
  fun `one jolt, as of a phone dropped or put down hard, is not`() {
    val detector = ShakeDetector()
    assertFalse(detector.at(0, 6f))
    for (ms in 20L until 3_000L step 20) assertFalse(detector.at(ms, 1f))
  }

  @Test
  fun `one push lasting over several readings is one jolt`() {
    val detector = ShakeDetector()
    // Read every twenty milliseconds for most of a tenth of a second: the same push.
    for (ms in 0L..80L step 20) assertFalse(detector.at(ms, 3f))
    assertFalse(detector.at(300, 3f))
    assertTrue(detector.at(600, 3f))
  }

  @Test
  fun `jolts too far apart, as of a phone turned over now and again, are not`() {
    val detector = ShakeDetector()
    assertFalse(detector.at(0, 3f))
    assertFalse(detector.at(700, 3f))
    assertFalse(detector.at(1_500, 3f))
    assertFalse(detector.at(2_400, 3f))
  }

  @Test
  fun `movement short of a jolt is not`() {
    val detector = ShakeDetector()
    for (ms in 0L until 2_000L step 150) assertFalse(detector.at(ms, 1.8f))
  }

  @Test
  fun `a long shake is one request and not several`() {
    val detector = ShakeDetector()
    var shakes = 0
    // Shaken for a second and a half, a jolt every fifth of a second.
    for (ms in 0L..1_500L step 200) if (detector.at(ms, 3f)) shakes++
    assertEquals(1, shakes)
    // And heard again once it has rested.
    var again = false
    for (ms in 4_000L..4_400L step 200) again = detector.at(ms, 3f) || again
    assertTrue(again)
  }

  @Test
  fun `forgets what came before being reset`() {
    val detector = ShakeDetector()
    detector.at(0, 3f)
    detector.at(200, 3f)
    detector.reset()
    assertFalse(detector.at(400, 3f))
  }

  @Test
  fun `listens only in the last few minutes`() {
    val deadline = 1_000_000L
    assertEquals(deadline - SHAKE_WINDOW_MS, shakeListenIn(deadline, 0L))
    assertEquals(0L, shakeListenIn(deadline, deadline - SHAKE_WINDOW_MS))
    assertEquals(0L, shakeListenIn(deadline, deadline - 1_000L))
    assertEquals(0L, shakeListenIn(deadline, deadline + 5_000L))
  }

  @Test
  fun `a shake adds ten minutes to the end`() {
    assertEquals(1_000_000L + SHAKE_ADDS_MS, extendedDeadline(1_000_000L, 900_000L))
  }

  @Test
  fun `a timer already run out, letting the track finish, counts ten minutes from now`() {
    assertEquals(2_000_000L + SHAKE_ADDS_MS, extendedDeadline(1_000_000L, 2_000_000L))
  }

  @Test
  fun `never past a day from now`() {
    val now = 5_000L
    assertEquals(now + MAX_SLEEP_MS, extendedDeadline(now + MAX_SLEEP_MS - 1_000L, now))
  }
}
