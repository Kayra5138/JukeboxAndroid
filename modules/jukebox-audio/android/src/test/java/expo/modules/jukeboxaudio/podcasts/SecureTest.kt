package expo.modules.jukeboxaudio.podcasts

import java.net.URL
import org.junit.Assert.assertEquals
import org.junit.Test

class SecureTest {
  @Test
  fun asksForAPlainAddressOverHttpsWithEverythingElseAsItWas() {
    assertEquals("https://example.org/feed.xml?a=1", Secure.of("http://example.org/feed.xml?a=1").toString())
    assertEquals("https://example.org/ep.mp3", Secure.of(URL("http://example.org:80/ep.mp3")).toString())
    assertEquals("https://example.org:8080/ep.mp3", Secure.of("http://example.org:8080/ep.mp3").toString())
    assertEquals("https://example.org/ep.mp3", Secure.of("https://example.org/ep.mp3").toString())
  }
}
