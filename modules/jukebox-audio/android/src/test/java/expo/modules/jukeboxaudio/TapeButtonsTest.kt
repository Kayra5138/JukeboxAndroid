package expo.modules.jukeboxaudio

import androidx.media3.session.CommandButton
import org.junit.Assert.assertEquals
import org.junit.Test

/** The pictures on a tape's buttons, and the chapter a place in it is in. */
class TapeButtonsTest {
  @Test
  fun aJumpWearsItsNumberWhereThereIsAPictureWithIt() {
    assertEquals(CommandButton.ICON_SKIP_BACK_15, TapeButtons.backIcon(15))
    assertEquals(CommandButton.ICON_SKIP_BACK_10, TapeButtons.backIcon(10))
    assertEquals(CommandButton.ICON_SKIP_FORWARD_30, TapeButtons.forwardIcon(30))
    assertEquals(CommandButton.ICON_SKIP_FORWARD_5, TapeButtons.forwardIcon(5))
  }

  @Test
  fun andThePlainArrowWhereThereIsNot() {
    assertEquals(CommandButton.ICON_SKIP_BACK, TapeButtons.backIcon(20))
    assertEquals(CommandButton.ICON_SKIP_FORWARD, TapeButtons.forwardIcon(45))
  }

  @Test
  fun aPlaceIsInTheLastChapterBegunBeforeIt() {
    val starts = listOf(0L, 60_000L, 300_000L)
    assertEquals(0, ChapterLine.chapterAt(starts, 0))
    assertEquals(0, ChapterLine.chapterAt(starts, 59_999))
    assertEquals(1, ChapterLine.chapterAt(starts, 60_000))
    assertEquals(2, ChapterLine.chapterAt(starts, 10_000_000))
    assertEquals(-1, ChapterLine.chapterAt(listOf(5_000L), 1_000))
    assertEquals(-1, ChapterLine.chapterAt(emptyList(), 1_000))
  }
}
