package expo.modules.jukeboxaudio.auto

import org.junit.Assert.assertEquals
import org.junit.Test

class TrackIdTest {
  @Test
  fun `an id the car was given comes back as the track's own`() {
    assertEquals("42", BrowseTree.trackId("t|albums|42"))
    // A shelf can be several levels down, and its own name has bars in it.
    assertEquals("42", BrowseTree.trackId("t|tracks|by|added|42"))
  }

  @Test
  fun `an id that was plain already is left alone`() {
    assertEquals("42", BrowseTree.trackId("42"))
    assertEquals("", BrowseTree.trackId(""))
    // Not every id is a number: a download has one of its own.
    assertEquals("yt-abc", BrowseTree.trackId("yt-abc"))
  }
}
