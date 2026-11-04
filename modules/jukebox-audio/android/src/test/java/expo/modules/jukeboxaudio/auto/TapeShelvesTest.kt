package expo.modules.jukeboxaudio.auto

import expo.modules.jukeboxaudio.TapePlace
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The car's tapes divided and ordered as the app's tapes view has them (`LibraryScreen`, `lib/tapes/order.ts`). */
class TapeShelvesTest {
  private data class Tape(val id: String, val folder: String, val file: String)

  private val root = "Music/Jukebox"

  private fun divide(tapes: List<Tape>, followed: Map<String, String> = emptyMap()) =
    TapeShelves.divide(tapes, followed, { it.folder }, { it.file })

  private fun place(positionMs: Long, at: Long, finished: Boolean = false, durationMs: Long = 3_600_000) =
    TapePlace(positionMs, durationMs, at, finished)

  @Test
  fun aFollowedShowsFolderIsTheShowAndTheRestAreBooksFoldersOrLoose() {
    val tapes = listOf(
      Tape("1", "Music/Jukebox/Tapes/The Daily/", "2026-10-02 Tuesday.mp3"),
      Tape("2", "Music/Jukebox/Tapes/The Daily/", "2026-10-01 Monday.mp3"),
      Tape("3", "Music/Jukebox/Tapes/Dune/", "02 - The Desert.mp3"),
      Tape("4", "Music/Jukebox/Tapes/Dune/", "01 - Arrakis.mp3"),
      Tape("5", "Music/Jukebox/Tapes/Some Channel/", "A talk.mp3"),
      Tape("6", "Music/Jukebox/Tapes/Some Channel/", "Another talk.mp3"),
      Tape("7", "Music/Jukebox/Tapes/", "Loose.mp3"),
      Tape("8", "Music/Jukebox/Tapes/Alone/", "Only one.mp3")
    )
    val shelves = divide(tapes, mapOf(TapeShelves.followedKey(root, "The Daily") to "The Daily"))

    assertEquals(listOf("The Daily"), shelves.shows.map { it.name })
    assertEquals(listOf("2", "1"), shelves.shows.single().tapes.map { it.id })
    assertEquals(listOf("Dune"), shelves.books.map { it.name })
    assertEquals(listOf("4", "3"), shelves.books.single().tapes.map { it.id })
    assertEquals(listOf("Some Channel"), shelves.folders.map { it.name })
    assertEquals(setOf("7", "8"), shelves.loose.map { it.id }.toSet())
  }

  @Test
  fun aShowIsFoundByTheFolderNameItKeepsMadeFitForAPath() {
    assertEquals("music/jukebox/tapes/what now", TapeShelves.folderKey("/Music/Jukebox/Tapes/What Now/"))
    assertEquals("music/jukebox/tapes/what now", TapeShelves.followedKey(root, "What: Now?"))
    assertEquals("tapes/talk", TapeShelves.followedKey("", "Talk"))
    assertEquals("Tape", TapeShelves.folderNameOf("...///"))
    assertEquals(80, TapeShelves.folderNameOf("x".repeat(200)).length)
  }

  @Test
  fun partsAreCountedAsPeopleCountThem() {
    val names = listOf("Part 10.mp3", "part 2.mp3", "Part 1.mp3", "002 - b.mp3", "1 - a.mp3")
    assertEquals(listOf("1 - a.mp3", "002 - b.mp3", "Part 1.mp3", "part 2.mp3", "Part 10.mp3"), names.sortedWith(TapeShelves.NATURAL))
  }

  @Test
  fun aSeriesListsWhatIsPartWayFirstThenAShowNewestFirstAndABookInOrder() {
    val shelves = divide(
      listOf(
        Tape("a", "Music/Jukebox/Tapes/Show/", "2026-01-01.mp3"),
        Tape("b", "Music/Jukebox/Tapes/Show/", "2026-01-02.mp3"),
        Tape("c", "Music/Jukebox/Tapes/Show/", "2026-01-03.mp3"),
        Tape("p1", "Music/Jukebox/Tapes/Book/", "01 - One.mp3"),
        Tape("p2", "Music/Jukebox/Tapes/Book/", "02 - Two.mp3"),
        Tape("p3", "Music/Jukebox/Tapes/Book/", "03 - Three.mp3")
      ),
      mapOf(TapeShelves.followedKey(root, "Show") to "Show")
    )
    val places = mapOf("a" to place(60_000, at = 5), "p2" to place(60_000, at = 9), "p1" to place(3_600_000, at = 2, finished = true))
    assertEquals(listOf("a", "c", "b"), TapeShelves.listed(shelves.shows.single(), places) { it.id }.map { it.id })
    assertEquals(listOf("p2", "p1", "p3"), TapeShelves.listed(shelves.books.single(), places) { it.id }.map { it.id })
  }

  @Test
  fun looseTapesGoBegunThenFreshThenHeard() {
    val tapes = listOf("fresh", "heard", "old", "new", "barely").map { Tape(it, "Music/Jukebox/Tapes/", "$it.mp3") }
    val places = mapOf(
      "heard" to place(3_600_000, at = 50, finished = true),
      "old" to place(120_000, at = 10),
      "new" to place(120_000, at = 20),
      "barely" to place(4_000, at = 99)
    )
    assertEquals(listOf("new", "old", "fresh", "barely", "heard"), TapeShelves.ordered(tapes, places) { it.id }.map { it.id })
  }

  @Test
  fun whatIsLeftIsSaidInWholeMinutesRoundedUp() {
    assertEquals(30, TapeShelves.minutesLeft(place(30 * 60_000L, at = 0), 0))
    assertEquals(1, TapeShelves.minutesLeft(place(3_599_000, at = 0), 0))
    // The tape's own length where the place does not know it.
    assertEquals(10, TapeShelves.minutesLeft(place(50 * 60_000L, at = 0, durationMs = 0), 60 * 60_000L))
    assertNull(TapeShelves.minutesLeft(place(50_000, at = 0, durationMs = 0), 0))
    assertTrue(TapeShelves.begun(place(10_000, at = 0)))
    assertTrue(!TapeShelves.begun(place(9_999, at = 0)))
    assertTrue(!TapeShelves.begun(place(60_000, at = 0, finished = true)))
  }
}
