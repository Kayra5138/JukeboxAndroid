package expo.modules.jukeboxaudio.auto

import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files

/*
  What the covers' provider hands out: a song's cover for an address of
  its own shape, and a file the library names only from the app's own
  files, however the name is written.
*/
class CoverAddressTest {
  @Test fun anAddressNamesASongOnlyInItsOwnShape() {
    assertEquals("42", CoverProvider.trackOf(listOf("track", "42")))
    assertNull(CoverProvider.trackOf(listOf("track")))
    assertNull(CoverProvider.trackOf(listOf("track", "42", "more")))
    assertNull(CoverProvider.trackOf(listOf("album", "42")))
    assertNull(CoverProvider.trackOf(listOf("track", "../42")))
    assertNull(CoverProvider.trackOf(listOf("track", "yt:abc")))
    assertNull(CoverProvider.trackOf(emptyList()))
  }

  @Test fun aCoverIsHandedOutOnlyFromInsideTheAppsFiles() {
    val root = Files.createTempDirectory("covers").toFile()
    try {
      val files = File(root, "files").apply { mkdirs() }
      val cover = File(files, "artwork/one.jpg").apply { parentFile!!.mkdirs(); writeText("jpeg") }
      val outside = File(root, "databases/library.db").apply { parentFile!!.mkdirs(); writeText("sqlite") }
      // A folder whose name starts with the app's, beside it rather than in it.
      val beside = File(root, "files-other/two.jpg").apply { parentFile!!.mkdirs(); writeText("jpeg") }

      assertTrue(CoverProvider.within(cover, files))
      assertFalse(CoverProvider.within(outside, files))
      assertFalse(CoverProvider.within(File(files, "../databases/library.db"), files))
      assertFalse(CoverProvider.within(beside, files))
      // A folder is not a cover, nor is a file that is not there.
      assertFalse(CoverProvider.within(File(files, "artwork"), files))
      assertFalse(CoverProvider.within(File(files, "artwork/gone.jpg"), files))
    } finally {
      root.deleteRecursively()
    }
  }
}
