package expo.modules.jukeboxaudio.auto

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LibraryHidingTest {
  @Test
  fun `a folder left out takes everything inside it, whatever its case and slashes`() {
    val hiding = LibraryHiding("Music", listOf("/Music/WhatsApp/"), 0)
    assertFalse(hiding.shows("Music/WhatsApp/", 200.0))
    assertFalse(hiding.shows("music/whatsapp/Voice Notes/", 200.0))
    assertTrue(hiding.shows("Music/Albums/", 200.0))
  }

  @Test
  fun `a folder is matched by whole steps`() {
    val hiding = LibraryHiding("Music", listOf("Music/Rec"), 0)
    assertTrue(hiding.shows("Music/Records/", 200.0))
    assertFalse(hiding.shows("Music/Rec/", 200.0))
  }

  @Test
  fun `a folder outside the library folder, or holding it, leaves nothing out`() {
    val outside = LibraryHiding("Music/Rock", listOf("Music/Jazz"), 0)
    assertTrue(outside.leavesNothing)
    val holding = LibraryHiding("Music/Rock", listOf("Music"), 0)
    assertTrue(holding.leavesNothing)
    assertTrue(holding.shows("Music/Rock/", 200.0))
  }

  @Test
  fun `short files are left out, and files of no known length are not`() {
    val hiding = LibraryHiding("Music", emptyList(), 30)
    assertFalse(hiding.shows("Music/", 12.5))
    assertTrue(hiding.shows("Music/", 30.0))
    assertTrue(hiding.shows("Music/", 0.0))
    assertTrue(hiding.shows(null, 200.0))
  }

  @Test
  fun `nothing set leaves nothing out`() {
    assertTrue(LibraryHiding("Music", emptyList(), 0).leavesNothing)
  }
}
