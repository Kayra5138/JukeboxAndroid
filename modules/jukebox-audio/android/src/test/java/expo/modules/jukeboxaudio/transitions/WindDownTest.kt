package expo.modules.jukeboxaudio.transitions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private const val RATE = 44_100

class WindDownTest {
  private var now = 0L
  private val windDown = WindDown { now }
  private val fader = FadeGainProvider(windDown)

  private fun gainAt(samplePosition: Long): Float =
    fader.getGainFactorAtSamplePosition(samplePosition, RATE)

  @Test
  fun `leaves the audio alone with nothing booked`() {
    assertEquals(1f, windDown.gain(), 0f)
    assertFalse(windDown.begun())
    assertEquals(1f, gainAt(0), 0f)
  }

  @Test
  fun `changes nothing until the ramp begins`() {
    windDown.over(60_000, 90_000)
    now = 59_999
    assertEquals(1f, windDown.gain(), 0f)
    assertFalse(windDown.begun())
  }

  @Test
  fun `goes down in a straight line and stays down`() {
    windDown.over(60_000, 90_000)
    now = 60_000
    assertTrue(windDown.begun())
    assertEquals(1f, windDown.gain(), 0f)
    now = 75_000
    assertEquals(0.5f, windDown.gain(), 0.001f)
    now = 87_000
    assertEquals(0.1f, windDown.gain(), 0.001f)
    now = 90_000
    assertEquals(0f, windDown.gain(), 0f)
    now = 91_000
    assertEquals(0f, windDown.gain(), 0f)
  }

  @Test
  fun `does not hold a player silent that nobody came back to pause`() {
    windDown.over(60_000, 90_000)
    now = 90_000 + WindDown.ABANDONED_AFTER_MS - 1
    assertEquals(0f, windDown.gain(), 0f)
    now = 90_000 + WindDown.ABANDONED_AFTER_MS
    assertEquals(1f, windDown.gain(), 0f)
  }

  @Test
  fun `is back to normal the moment it is cleared`() {
    // The classic fault of a sleep timer: the next play, silent.
    windDown.over(60_000, 90_000)
    now = 90_000
    assertEquals(0f, gainAt(0), 0f)
    windDown.clear()
    assertEquals(1f, gainAt(1), 0f)
    assertFalse(windDown.begun())
  }

  @Test
  fun `a ramp with no length is no ramp`() {
    windDown.over(90_000, 90_000)
    now = 95_000
    assertEquals(1f, windDown.gain(), 0f)
    windDown.over(90_000, 60_000)
    assertEquals(1f, windDown.gain(), 0f)
  }

  @Test
  fun `outlasts the fades that come and go beneath it`() {
    windDown.over(0, 30_000)
    now = 15_000

    // A seek, a resume, a crossfade bringing the next track in: each is a new
    // plan, and none of them puts the volume back up.
    fader.fadeIn(1_000, equalPower = false)
    val armedAt = 500_000L
    assertEquals(0f, gainAt(armedAt), 0.001f)
    assertEquals(0.5f, gainAt(armedAt + RATE), 0.001f)
    fader.clear()
    assertEquals(0.5f, gainAt(armedAt + 2L * RATE), 0.001f)

    // And a flush, which starts a plan's count again, does not start this.
    assertEquals(0.5f, gainAt(0), 0.001f)
  }

  @Test
  fun `keeps the fader awake only once it has begun`() {
    windDown.over(60_000, 90_000)
    now = 1_000
    // Booked, not begun: still answering a buffer at a time.
    assertEquals(RATE / 50L, fader.isUnityUntil(0, RATE))
    now = 60_000
    assertEquals(1L, fader.isUnityUntil(0, RATE))
    windDown.clear()
    assertEquals(RATE / 50L, fader.isUnityUntil(0, RATE))
  }
}
