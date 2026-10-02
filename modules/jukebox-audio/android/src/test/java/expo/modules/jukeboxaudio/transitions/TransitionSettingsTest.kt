package expo.modules.jukeboxaudio.transitions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TransitionSettingsTest {
  private val on = TransitionSettings(enabled = true, autoMs = 4_000, skipSameAlbum = true)

  private fun start(
    settings: TransitionSettings = on,
    durationMs: Long = 240_000,
    hasNext: Boolean = true,
    albumOfCurrent: String? = "Ruins",
    albumOfNext: String? = "Other"
  ) = crossfadeStartMs(settings, durationMs, hasNext, albumOfCurrent, albumOfNext)

  @Test
  fun `begins the overlap a fade before the end`() {
    assertEquals(236_000L, start())
  }

  @Test
  fun `does nothing while switched off`() {
    assertNull(start(settings = on.copy(enabled = false)))
    assertNull(start(settings = on.copy(autoMs = 0)))
  }

  @Test
  fun `does nothing with nowhere to go`() {
    assertNull(start(hasNext = false))
  }

  @Test
  fun `does nothing when the length is not known`() {
    assertNull(start(durationMs = 0))
    assertNull(start(durationMs = -1))
  }

  @Test
  fun `leaves consecutive tracks of one album alone`() {
    assertNull(start(albumOfCurrent = "Ruins", albumOfNext = "Ruins"))
    // Tags come from several places and rarely agree on spacing or case.
    assertNull(start(albumOfCurrent = " ruins ", albumOfNext = "RUINS"))
  }

  @Test
  fun `crossfades the same album when told to`() {
    assertEquals(
      236_000L,
      start(settings = on.copy(skipSameAlbum = false), albumOfCurrent = "Ruins", albumOfNext = "Ruins")
    )
  }

  @Test
  fun `two tracks that know nothing about themselves are not an album`() {
    assertEquals(236_000L, start(albumOfCurrent = null, albumOfNext = null))
    assertEquals(236_000L, start(albumOfCurrent = "  ", albumOfNext = ""))
  }

  @Test
  fun `refuses a track with nothing left over after the fade`() {
    // Four seconds of fade needs five more of track to be a track at all.
    assertNull(start(durationMs = 8_000))
    assertNull(start(durationMs = 9_000 - 1))
    assertEquals(5_000L, start(durationMs = 9_000))
  }

  @Test
  fun `will not fade for longer than the cap`() {
    assertEquals(
      240_000L - TransitionSettings.MAX_AUTO_MS,
      start(settings = on.copy(autoMs = 60_000))
    )
  }
}
