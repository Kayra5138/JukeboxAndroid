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
    albumOfNext: String? = "Other",
    repeatOne: Boolean = false,
    stopsHere: Boolean = false
  ) = crossfadeStartMs(settings, durationMs, hasNext, albumOfCurrent, albumOfNext, repeatOne, stopsHere)

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
  fun `leaves a track that repeats to loop on its own`() {
    // The player still reports a next item under repeat-one: that is where the
    // button goes, not where the track does.
    assertNull(start(repeatOne = true, hasNext = true))
    assertEquals(236_000L, start(repeatOne = false, hasNext = true))
  }

  @Test
  fun `does not leave early a track the music is to stop at the end of`() {
    // The sleep timer's "end of this track". A handover would start the next
    // one underneath the last seconds of this.
    assertNull(start(stopsHere = true))
    assertEquals(236_000L, start(stopsHere = false))
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

  @Test
  fun `a fade is heard for longer when played slowly and shorter when fast`() {
    assertEquals(4_000L, clockMs(4_000, 1f))
    assertEquals(8_000L, clockMs(4_000, 0.5f))
    assertEquals(2_000L, clockMs(4_000, 2f))
  }

  @Test
  fun `the head start covers more of the track when played fast`() {
    assertEquals(1_200L, trackMs(1_200, 1f))
    assertEquals(2_400L, trackMs(1_200, 2f))
    assertEquals(600L, trackMs(1_200, 0.5f))
  }

  @Test
  fun `a speed that is not one is not divided by`() {
    assertEquals(4_000L, clockMs(4_000, 0f))
    assertEquals(4_000L, clockMs(4_000, -1f))
    assertEquals(4_000L, clockMs(4_000, Float.NaN))
    assertEquals(1_200L, trackMs(1_200, 0f))
    assertEquals(1_200L, trackMs(1_200, Float.POSITIVE_INFINITY))
  }
}
