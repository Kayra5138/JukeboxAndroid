package expo.modules.jukeboxaudio.downloads

import org.junit.Assert.*
import org.junit.Test

/*
  The words an update is decided by: which release is newer, which copy a
  build leaves alone, what GitHub's answer names, and which line of a
  release's list is the file's. The fetching itself wants a phone.
*/
class ExtractorVersionTest {
  @Test fun aReleaseIsNewerByItsNumbersAndNotItsLetters() {
    assertTrue(ExtractorVersion.newer("2026.10.01", "2026.08.19"))
    assertTrue(ExtractorVersion.newer("2027.01.02", "2026.12.30"))
    assertTrue(ExtractorVersion.newer("2026.9.1", "2026.08.19"))
    assertFalse(ExtractorVersion.newer("2026.08.19", "2026.08.19"))
    assertFalse(ExtractorVersion.newer("2026.08.19", "2026.10.01"))
  }

  @Test fun theSecondReleaseOfADayIsNewerThanTheFirst() {
    assertTrue(ExtractorVersion.newer("2026.08.19.1", "2026.08.19"))
    assertFalse(ExtractorVersion.newer("2026.08.19", "2026.08.19.1"))
    assertFalse(ExtractorVersion.newer("2026.08.19.0", "2026.08.19"))
  }

  @Test fun whatIsNotAVersionIsNewerThanNothing() {
    for (odd in listOf(null, "", "latest", "v2026.08.19", "2026.08", "2026.08.19-beta", "2026.08.19\n")) {
      assertFalse(ExtractorVersion.valid(odd))
      assertFalse(ExtractorVersion.newer(odd, "2026.08.19"))
      assertFalse(ExtractorVersion.newer("2026.08.19", odd))
    }
  }

  @Test fun aBuildLeavesItsOwnCopyAndANewerOneAlone() {
    assertTrue(ExtractorVersion.keeps("2026.08.19", "2026.08.19"))
    assertTrue(ExtractorVersion.keeps("2026.10.01", "2026.08.19"))
    // An update of the app that carries something newer than what was fetched.
    assertFalse(ExtractorVersion.keeps("2026.08.19", "2026.10.01"))
    assertFalse(ExtractorVersion.keeps(null, "2026.08.19"))
    assertFalse(ExtractorVersion.keeps("", "2026.08.19"))
    assertFalse(ExtractorVersion.keeps("nonsense", "2026.08.19"))
  }

  @Test fun theLatestReleaseIsReadOffWhereGitHubSendsABrowser() {
    assertEquals("2026.08.19", ExtractorVersion.tagOf("https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19"))
    assertEquals("2026.08.19.1", ExtractorVersion.tagOf(" https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19.1 "))
    assertNull(ExtractorVersion.tagOf(null))
    assertNull(ExtractorVersion.tagOf("https://github.com/yt-dlp/yt-dlp/releases"))
    assertNull(ExtractorVersion.tagOf("https://github.com/login?return_to=/yt-dlp/yt-dlp/releases/tag/2026.08.19"))
    assertNull(ExtractorVersion.tagOf("https://example.com/yt-dlp/yt-dlp/releases/tag/2026.08.19"))
    assertNull(ExtractorVersion.tagOf("https://github.com/someone/yt-dlp/releases/tag/2026.08.19"))
    assertNull(ExtractorVersion.tagOf("https://github.com/yt-dlp/yt-dlp/releases/tag/nightly"))
    assertNull(ExtractorVersion.tagOf("https://github.com/yt-dlp/yt-dlp/releases/tag/2026.08.19/../../evil"))
  }

  @Test fun theFilesOwnLineIsFoundInTheReleasesList() {
    val hash = "1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6"
    val other = "a".repeat(64)
    val sums = "$other  yt-dlp.exe\n$other  yt-dlp.tar.gz\n${hash.uppercase()}  yt-dlp\n$other  yt-dlp_linux\n"
    assertEquals(hash, ExtractorVersion.checksum(sums))
    assertEquals(other, ExtractorVersion.checksum(sums, "yt-dlp.exe"))
    assertEquals(hash, ExtractorVersion.checksum("$hash *yt-dlp\r\n"))
    assertNull(ExtractorVersion.checksum("$other  yt-dlp.exe\n"))
    assertNull(ExtractorVersion.checksum("not a list"))
    assertNull(ExtractorVersion.checksum("abc123  yt-dlp"))
  }
}
