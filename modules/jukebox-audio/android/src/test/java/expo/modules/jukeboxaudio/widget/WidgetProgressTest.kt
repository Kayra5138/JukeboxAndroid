package expo.modules.jukeboxaudio.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetProgressTest {
  @Test fun clampsSeekAndUnknownDurations() {
    assertEquals(0, WidgetProgress.value(500, -1))
    assertEquals(0, WidgetProgress.value(500, 0))
    assertEquals(0, WidgetProgress.value(-50, 1000))
    assertEquals(500, WidgetProgress.value(500, 1000))
    assertEquals(1000, WidgetProgress.value(1500, 1000))
  }
  @Test fun avoidsOverflowForLongDurations() {
    assertEquals(1000, WidgetProgress.value(Long.MAX_VALUE, Long.MAX_VALUE))
  }
}
