package expo.modules.jukeboxaudio.sleep

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SleepPlanTest {
  @Test
  fun `pauses music that is playing when the time is up`() {
    assertEquals(Expiry.PAUSE, atExpiry(playing = true, finishTrack = false))
  }

  @Test
  fun `lets the track finish where that was asked for`() {
    assertEquals(Expiry.FINISH_TRACK, atExpiry(playing = true, finishTrack = true))
  }

  @Test
  fun `only clears when there is nothing to stop`() {
    // Paused by hand before the time ran out. Whether the track was to be let
    // finish makes no difference: there is no track finishing.
    assertEquals(Expiry.CLEAR, atExpiry(playing = false, finishTrack = false))
    assertEquals(Expiry.CLEAR, atExpiry(playing = false, finishTrack = true))
  }

  @Test
  fun `fades over the last half minute and is silent before the pause`() {
    val start = 1_000_000L
    val deadline = start + 15 * 60_000L
    assertEquals(
      (deadline - FADE_MS) to (deadline - SINK_LEAD_MS),
      fadeWindow(start, deadline, fade = true, finishTrack = false)
    )
  }

  @Test
  fun `a timer shorter than the fade is all fade`() {
    val start = 1_000_000L
    assertEquals(
      start to (start + 10_000L - SINK_LEAD_MS),
      fadeWindow(start, start + 10_000L, fade = true, finishTrack = false)
    )
  }

  @Test
  fun `does not fade a track that is being let finish`() {
    assertNull(fadeWindow(0, 15 * 60_000L, fade = true, finishTrack = true))
  }

  @Test
  fun `does not fade when told not to`() {
    assertNull(fadeWindow(0, 15 * 60_000L, fade = false, finishTrack = false))
  }

  @Test
  fun `does not book a fade with no room to happen in`() {
    // The whole timer is inside what the sink is already holding.
    assertNull(fadeWindow(0, SINK_LEAD_MS, fade = true, finishTrack = false))
    assertNull(fadeWindow(0, 500L, fade = true, finishTrack = false))
  }

  @Test
  fun `takes a length that can be kept`() {
    assertEquals(30 * 60_000L, sleepLength(30 * 60_000L))
    assertEquals(MIN_SLEEP_MS, sleepLength(MIN_SLEEP_MS))
  }

  @Test
  fun `refuses a length that is no time at all`() {
    assertNull(sleepLength(null))
    assertNull(sleepLength(0))
    assertNull(sleepLength(-60_000L))
    assertNull(sleepLength(MIN_SLEEP_MS - 1))
  }

  @Test
  fun `holds a careless length to a day`() {
    assertEquals(MAX_SLEEP_MS, sleepLength(MAX_SLEEP_MS + 1))
    assertEquals(MAX_SLEEP_MS, sleepLength(Long.MAX_VALUE))
  }
}
