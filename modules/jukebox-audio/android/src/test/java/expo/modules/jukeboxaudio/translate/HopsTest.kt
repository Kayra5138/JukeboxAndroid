package expo.modules.jukeboxaudio.translate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HopsTest {
  @Test
  fun `english is one model away from anything, in either direction`() {
    assertEquals(listOf("ja" to "en"), BergamotTranslator.hops("ja", "en"))
    // The one that used to ask for an English-to-English model first.
    assertEquals(listOf("en" to "tr"), BergamotTranslator.hops("en", "tr"))
  }

  @Test
  fun `anything else goes through english`() {
    assertEquals(listOf("ja" to "en", "en" to "tr"), BergamotTranslator.hops("ja", "tr"))
  }

  @Test
  fun `a language into itself needs nothing`() {
    assertTrue(BergamotTranslator.hops("tr", "tr").isEmpty())
    assertTrue(BergamotTranslator.hops("en", "en").isEmpty())
  }
}
