package expo.modules.jukeboxaudio.lists

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ListFilesTest {
  @Test
  fun `a document of the media store's own views is its row`() {
    assertEquals(123L, mediaRowId("audio:123"))
    assertEquals(45L, mediaRowId("document:45"))
    assertEquals(6789L, mediaRowId("msf:6789"))
    assertEquals(17L, mediaRowId("17"))
  }

  @Test
  fun `a path or a volume is not a row`() {
    assertNull(mediaRowId(null))
    assertNull(mediaRowId("raw:/storage/emulated/0/Download/Mix.m3u"))
    assertNull(mediaRowId("primary:Music/Mix.m3u"))
    assertNull(mediaRowId("1A2B-3C4D:Mix.m3u"))
    assertNull(mediaRowId("video:12"))
  }
}
