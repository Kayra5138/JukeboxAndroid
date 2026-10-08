package expo.modules.jukeboxaudio

import org.junit.Assert.assertEquals
import org.junit.Test

class QueueStoreTest {
  private val queue = listOf("a", "b", "c")

  @Test
  fun `picks up where the place says, not where the queue was first set`() {
    assertEquals(2 to 91_000L, resumeFrom(queue, 0, 0, Place("c", 2, 91_000)))
  }

  @Test
  fun `falls back on the queue when no place was ever noted`() {
    assertEquals(1 to 4_000L, resumeFrom(queue, 1, 4_000, null))
  }

  @Test
  fun `a place noted for some other queue is not believed`() {
    // The list changed after the place was written: the index holds another track.
    assertEquals(1 to 4_000L, resumeFrom(queue, 1, 4_000, Place("z", 2, 91_000)))
    // Or it is past the end of what was kept.
    assertEquals(1 to 4_000L, resumeFrom(queue, 1, 4_000, Place("c", 7, 91_000)))
    assertEquals(1 to 4_000L, resumeFrom(queue, 1, 4_000, Place("a", -1, 91_000)))
  }

  @Test
  fun `the same track twice in a queue is told apart by where it is`() {
    assertEquals(2 to 5_000L, resumeFrom(listOf("a", "b", "a"), 0, 0, Place("a", 2, 5_000)))
  }

  @Test
  fun `never answers outside the queue or before the start`() {
    assertEquals(2 to 0L, resumeFrom(queue, 9, -5, null))
    assertEquals(0 to 0L, resumeFrom(queue, -3, 0, null))
    assertEquals(0 to 0L, resumeFrom(queue, 0, 0, Place("a", 0, -1)))
  }
}
