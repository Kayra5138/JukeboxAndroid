package expo.modules.jukeboxaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * The paper sleeves' names, as the app works them out (`standIns.ts`, by
 * `thumbName`): the two have to agree, or the app asks for a sleeve the
 * widget and the car have already drawn under another name, and the record
 * wears two. The expected names are the app's own answers for these.
 */
class StandInTest {
  @Test
  fun aRecordIsKnownByItsNameWhoseItIsAndItsGenre() {
    val identity = StandIn.identityOf("Hybrid Theory", null, "In the End", "Linkin Park", "Nu Metal")
    assertEquals("a\u0000hybrid theory\u0000linkin park\u0000nu metal", identity)
    assertEquals("e8272014pxyzt", StandIn.nameOf(identity))
  }

  @Test
  fun theRecordsOwnArtistBeforeTheSongs() {
    assertEquals("xxwz4j1sboatg", StandIn.nameOf(StandIn.identityOf("AIZO - Single", "King Gnu", "AIZO", "King Gnu", null)))
  }

  @Test
  fun aSongWithNoRecordIsKnownByItsOwnName() {
    val identity = StandIn.identityOf(null, null, "Şarkı İçin", "Sanatçı Ç", " Türkçe Pop ")
    assertEquals("t\u0000şarkı i̇çin\u0000sanatçı ç\u0000türkçe pop", identity)
    assertEquals("pi98bj1j5ttbx", StandIn.nameOf(identity))
  }

  @Test
  fun spacesAroundAndEmptyValuesAreNothing() {
    assertEquals("aev9t0101tv44", StandIn.nameOf(StandIn.identityOf("  Kaze  ", "", "Shinunoga E-Wa", "藤井 風", "")))
  }

  @Test
  fun aGenreFoundLaterIsAnotherSleeve() {
    assertNotEquals(
      StandIn.nameOf(StandIn.identityOf("Kaze", null, null, "Fujii Kaze", null)),
      StandIn.nameOf(StandIn.identityOf("Kaze", null, null, "Fujii Kaze", "J-Pop")),
    )
  }
}
