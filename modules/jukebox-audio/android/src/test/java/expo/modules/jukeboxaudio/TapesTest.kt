package expo.modules.jukeboxaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/** The same cases as the app's own (`lib/tapes/__tests__/rule.test.ts`): the two have to agree. */
class TapesTest {
  @Test
  fun aTapeIsAnythingInTheTapesFolderOfTheLibrary() {
    assertTrue(Tapes.isTapeFolder("Music/Jukebox/Tapes/", "Music/Jukebox"))
    assertTrue(Tapes.isTapeFolder("Music/Jukebox/Tapes/Dune/Part 1/", "Music/Jukebox"))
    assertTrue(Tapes.isTapeFolder("Music/Jukebox/tapes/", "/Music/Jukebox/"))
    assertTrue(Tapes.isTapeFolder("Music/Jukebox/Kasetler/Kitap/", "Music/Jukebox"))
  }

  @Test
  fun nothingElseIsEverATape() {
    assertFalse(Tapes.isTapeFolder("Music/Jukebox/", "Music/Jukebox"))
    assertFalse(Tapes.isTapeFolder("Music/Jukebox/Mixtapes/", "Music/Jukebox"))
    assertFalse(Tapes.isTapeFolder("Music/Jukebox/Some artist/Tapes/", "Music/Jukebox"))
    assertFalse(Tapes.isTapeFolder("Music/Tapes/", "Music/Jukebox"))
    assertFalse(Tapes.isTapeFolder("Music/JukeboxTapes/", "Music/Jukebox"))
  }

  @Test
  fun theLongerAwayTheFurtherBack() {
    org.junit.Assert.assertEquals(3_000L, Tapes.rewindMsFor(2 * 60_000L))
    org.junit.Assert.assertEquals(10_000L, Tapes.rewindMsFor(30 * 60_000L))
    org.junit.Assert.assertEquals(20_000L, Tapes.rewindMsFor(5 * 60 * 60_000L))
    org.junit.Assert.assertEquals(30_000L, Tapes.rewindMsFor(3 * 24 * 60 * 60_000L))
  }

  @Test
  fun asksSponsorBlockByTheStartOfTheVideosHashAndFindsItsOwnPartsInTheAnswer() {
    assertEquals("5f6b", Tapes.hashPrefix("dQw4w9WgXcQ"))
    val answer = """[{"videoID":"other000000","segments":[{"segment":[1,2]}]},{"videoID":"dQw4w9WgXcQ","segments":[{"segment":[10.5,20],"category":"sponsor"}]}]"""
    assertEquals(1, Tapes.partsOf(answer, "dQw4w9WgXcQ").length())
    assertEquals(0, Tapes.partsOf(answer, "notthere000").length())
  }

  @Test
  fun takesAPageThatIsNotAListForNoAnswer() {
    assertThrows(Exception::class.java) { Tapes.partsOf("<html>Sign in to the Wi-Fi</html>", "dQw4w9WgXcQ") }
  }
}
