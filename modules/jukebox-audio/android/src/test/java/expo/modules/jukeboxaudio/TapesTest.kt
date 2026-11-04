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
  fun aBookGivenJumpsOfItsOwnIsJumpedByThem() {
    val general = 15_000L to 30_000L
    val json = """{"Music/Tapes/Dune":{"back":10,"forward":60},"Music/Tapes/Show":{"forward":45}}"""
    assertEquals(10_000L to 60_000L, Tapes.jumpsFor(json, "Music/Tapes/Dune", general))
    // Only the one it was given; the other is the general one.
    assertEquals(15_000L to 45_000L, Tapes.jumpsFor(json, "Music/Tapes/Show", general))
  }

  @Test
  fun anyOtherIsJumpedByTheGeneralOnes() {
    val general = 15_000L to 30_000L
    assertEquals(general, Tapes.jumpsFor("""{"Music/Tapes/Dune":{"back":10}}""", "Music/Tapes/Other", general))
    assertEquals(general, Tapes.jumpsFor(null, "Music/Tapes/Dune", general))
    assertEquals(general, Tapes.jumpsFor("not json", "Music/Tapes/Dune", general))
    // Nought, past ten minutes, or not a number: no jump of its own.
    assertEquals(general, Tapes.jumpsFor("""{"k":{"back":0,"forward":601}}""", "k", general))
    assertEquals(general, Tapes.jumpsFor("""{"k":{"back":"far","forward":null}}""", "k", general))
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
