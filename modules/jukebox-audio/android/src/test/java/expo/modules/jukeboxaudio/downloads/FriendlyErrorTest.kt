package expo.modules.jukeboxaudio.downloads

import org.junit.Assert.*
import org.junit.Test

/*
  Which failure, not which words. The words are the phone's to find, in the
  language the app is in; what is decided here, and can be held to on a desk,
  is which of them an error from the extractor is taken to be.
*/
class FriendlyErrorTest {
  private fun said(text: String) = failed(Exception(text)).failure

  @Test fun botIsAWordNotThreeLetters() {
    assertEquals(Failure.VERIFICATION, said("ERROR: Sign in to confirm you're not a bot"))
    assertNotEquals(Failure.VERIFICATION, said("ERROR: both formats failed for robot.mp4"))
  }

  @Test fun anExtractorYouTubeHasOutgrownSaysToUpdate() {
    listOf(
      "ERROR: [youtube] BaW_jenozKc: Unable to extract initial player response; please report this issue on https://github.com/yt-dlp/yt-dlp/issues",
      "ERROR: [youtube] BaW_jenozKc: Signature extraction failed: Some formats may be missing",
      "WARNING: [youtube] nsig extraction failed: You may experience throttling",
    ).forEach { assertEquals(Failure.OUTDATED, said(it)) }
  }

  @Test fun aVideoThatIsGoneIsNotAnOutdatedExtractor() {
    assertEquals(Failure.UNAVAILABLE, said("ERROR: [youtube] x: Video unavailable. Please report this issue"))
  }

  @Test fun theNetworkIsStillTheNetwork() {
    assertEquals(Failure.NETWORK, said("Unable to resolve host \"www.youtube.com\""))
  }

  @Test fun whatNothingRecognisesKeepsItsLastLine() {
    val other = failed(Exception("WARNING: something\nERROR: both formats failed for robot.mp4\n"))
    assertEquals(Failure.FAILED, other.failure)
    assertEquals("ERROR: both formats failed for robot.mp4", other.detail)
    assertNull(failed(Exception()).detail)
  }

  @Test fun aFailureOfOurOwnIsFoundUnderWhateverWrappedIt() {
    val wrapped = RuntimeException("network unreachable", YouTubeTrouble(Failure.TOO_LONG))
    assertEquals(Failure.TOO_LONG, failed(wrapped).failure)
    assertEquals("ERR_YOUTUBE_TOO_LONG", trouble(wrapped).code)
  }

  @Test fun everyFailureHasACodeOfItsOwn() {
    assertEquals(Failure.values().size, Failure.values().map { it.code }.toSet().size)
    Failure.values().forEach { assertEquals(it, Failure.of(it.code)) }
    assertNull(Failure.of("ERR_SOMETHING_ELSE"))
  }
}
