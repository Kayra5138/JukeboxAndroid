package expo.modules.jukeboxaudio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class LibraryStampTest {
  private data class Row(
    val id: Long,
    val size: Long = 4_000_000,
    val modified: Long = 1_700_000_000,
    val generation: Long = 12,
    val name: String? = "song.mp3",
    val folder: String? = "Music/",
  )

  private fun stamp(rows: List<Row>, seed: String = "Unknown"): String {
    val made = LibraryStamp(seed)
    for (row in rows) made.add(row.id, row.size, row.modified, row.generation, row.name, row.folder)
    return made.toString()
  }

  private val library = (1L..500L).map { Row(id = it, size = 3_000_000 + it) }

  @Test
  fun `the same files say the same thing in whatever order they come`() {
    assertEquals(stamp(library), stamp(library.reversed()))
    assertEquals(stamp(library), stamp(library.shuffled(java.util.Random(7))))
  }

  @Test
  fun `a file arriving or going is noticed`() {
    assertNotEquals(stamp(library), stamp(library + Row(id = 501)))
    assertNotEquals(stamp(library), stamp(library.drop(1)))
    assertNotEquals(stamp(emptyList()), stamp(listOf(Row(id = 1))))
  }

  @Test
  fun `one file leaving as another arrives is noticed`() {
    assertNotEquals(stamp(library), stamp(library.drop(1) + Row(id = 501, size = 3_000_001)))
  }

  @Test
  fun `every part of a file's description counts`() {
    val one = listOf(Row(id = 9))
    assertNotEquals(stamp(one), stamp(listOf(Row(id = 9, size = 4_000_001))))
    assertNotEquals(stamp(one), stamp(listOf(Row(id = 9, modified = 1_700_000_001))))
    assertNotEquals(stamp(one), stamp(listOf(Row(id = 9, generation = 13))))
    assertNotEquals(stamp(one), stamp(listOf(Row(id = 9, name = "other.mp3"))))
    assertNotEquals(stamp(one), stamp(listOf(Row(id = 9, folder = "Music/Elsewhere/"))))
    assertNotEquals(stamp(one), stamp(listOf(Row(id = 9, name = null))))
  }

  @Test
  fun `two files changing places in their sizes is noticed`() {
    val before = listOf(Row(id = 1, size = 10), Row(id = 2, size = 20))
    val after = listOf(Row(id = 1, size = 20), Row(id = 2, size = 10))
    assertNotEquals(stamp(before), stamp(after))
  }

  @Test
  fun `the words an untitled file is given are part of it`() {
    assertNotEquals(stamp(library, "Unknown"), stamp(library, "Bilinmeyen"))
  }
}
