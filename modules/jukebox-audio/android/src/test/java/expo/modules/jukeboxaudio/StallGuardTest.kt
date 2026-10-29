package expo.modules.jukeboxaudio

import expo.modules.jukeboxaudio.StallGuard.Verdict
import org.junit.Assert.assertEquals
import org.junit.Test

class StallGuardTest {
  private val long = 60_000L

  @Test
  fun aPlayerThatMovesIsLeftAlone() {
    assertEquals(Verdict.MOVING, StallGuard.verdict(gone = 2_000, got = 1_990, speed = 1f, sinceLast = long))
    // Slowed down, a slower clock is still a moving one.
    assertEquals(Verdict.MOVING, StallGuard.verdict(gone = 2_000, got = 1_000, speed = 0.5f, sinceLast = long))
  }

  @Test
  fun oneThatStandsStillIsWaitedOnAMomentAndThenStartedAgain() {
    assertEquals(Verdict.WAIT, StallGuard.verdict(gone = 1_000, got = 0, speed = 1f, sinceLast = long))
    assertEquals(Verdict.STUCK, StallGuard.verdict(gone = 2_000, got = 0, speed = 1f, sinceLast = long))
    // Running forward and jumping back comes to standing still.
    assertEquals(Verdict.STUCK, StallGuard.verdict(gone = 3_000, got = -400, speed = 1f, sinceLast = long))
  }

  @Test
  fun notTwiceForTheSameStallInQuickSuccession() {
    assertEquals(Verdict.WAIT, StallGuard.verdict(gone = 3_000, got = 0, speed = 1f, sinceLast = 2_000))
  }
}
