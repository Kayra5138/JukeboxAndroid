package expo.modules.jukeboxaudio.widget

import org.junit.Assert.*
import org.junit.Test

/*
  What a press of a widget is let do: only one carrying the word, and a
  jump only to the song its row was drawn for.
*/
class WidgetCommandsTest {
  @Test fun onlyThePressCarryingTheWordIsTaken() {
    val kept = "3f9a0c1e"
    assertTrue(WidgetCommands.carries("3f9a0c1e", kept))
    assertFalse(WidgetCommands.carries(null, kept))
    assertFalse(WidgetCommands.carries("", kept))
    assertFalse(WidgetCommands.carries("3f9a0c1", kept))
    assertFalse(WidgetCommands.carries("3f9a0c1e0", kept))
    assertFalse(WidgetCommands.carries("3F9A0C1E", kept))
    // A word not yet made is no word for an empty one to match.
    assertFalse(WidgetCommands.carries("", ""))
  }

  private val queue = listOf("a", "b", "c", "b2")

  private fun jump(asked: Int, id: String) = WidgetCommands.jumpTo(asked, id, queue.size) { queue[it] }

  @Test fun aRowGoesToItsPlaceWhileItHoldsTheSameSong() {
    assertEquals(1, jump(1, "b"))
    assertEquals(3, jump(3, "b2"))
  }

  @Test fun aRowDrawnBeforeTheQueueChangedFindsItsSong() {
    assertEquals(2, jump(0, "c"))
    assertEquals(0, jump(9, "a"))
    assertEquals(1, jump(-1, "b"))
  }

  @Test fun aSongNoLongerQueuedIsNotPlayed() {
    assertNull(jump(1, "gone"))
    assertNull(WidgetCommands.jumpTo(0, "a", 0) { error("an empty queue has no songs") })
  }
}
