package expo.modules.jukeboxaudio.auto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The cutting of a list too long to hand to a car in one answer.
 *
 * Worth holding to properly because the failure it guards against is invisible:
 * a browse result over the limit is not refused, it is silently shortened, so a
 * mistake here does not look like a bug — it looks like songs that were never
 * in the library.
 */
class BrowseSlicesTest {
  private fun songs(count: Int) = List(count) { "song $it" }

  @Test
  fun `a list that fits is left whole`() {
    val few = songs(10)
    assertEquals(listOf(few), BrowseTree.slices(few))
  }

  @Test
  fun `a list exactly at the cap is still one piece`() {
    assertEquals(1, BrowseTree.slices(songs(BrowseTree.CAP)).size)
  }

  @Test
  fun `one song past the cap becomes two`() {
    assertEquals(2, BrowseTree.slices(songs(BrowseTree.CAP + 1)).size)
  }

  @Test
  fun `no piece is ever over the cap`() {
    // The sizes either side of a boundary, and a few that divide unevenly,
    // which is where an off-by-one would hide.
    val sizes = listOf(1, 249, 250, 251, 499, 500, 501, 700, 1_000, 1_001, 5_003, 12_345)
    for (size in sizes) {
      for (piece in BrowseTree.slices(songs(size))) {
        assertTrue("$size split into a piece of ${piece.size}", piece.size <= BrowseTree.CAP)
      }
    }
  }

  @Test
  fun `every song is in exactly one piece, in the order it started in`() {
    val all = songs(1_001)
    assertEquals(all, BrowseTree.slices(all).flatten())
  }

  @Test
  fun `the pieces come out even rather than leaving a stub`() {
    // 700 wants three pieces; cut into full parts first it would be 250, 250,
    // 200, which reads as an accident. Evenly it is 234, 234, 232.
    val pieces = BrowseTree.slices(songs(700)).map { it.size }
    assertEquals(3, pieces.size)
    assertTrue("uneven pieces $pieces", pieces.max() - pieces.min() <= 2)
  }

  @Test
  fun `an empty library asks for nothing`() {
    assertEquals(listOf(emptyList<String>()), BrowseTree.slices(emptyList<String>()))
  }
}
