package expo.modules.jukeboxaudio.lyrics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricsFoldersTest {
  @Test
  fun `a song under the folder granted is found by its own folder`() {
    assertEquals("primary:Music/Album", folderDocumentId("primary:Music", "external_primary", "Music/Album/"))
    assertEquals("primary:Music", folderDocumentId("primary:Music", "external_primary", "Music/"))
  }

  @Test
  fun `the folder's own spelling is kept and the song's path compared without case`() {
    assertEquals("primary:Music/J-Pop", folderDocumentId("primary:Music", "external_primary", "music/J-Pop/"))
    assertEquals("primary:Müzik/Albüm", folderDocumentId("primary:Müzik/", "external_primary", "Müzik/Albüm/"))
  }

  @Test
  fun `a song outside the folder, or beside it with a longer name, is not`() {
    assertNull(folderDocumentId("primary:Music", "external_primary", "Download/"))
    assertNull(folderDocumentId("primary:Music", "external_primary", "Music Videos/"))
    assertNull(folderDocumentId("primary:Music/Album", "external_primary", "Music/"))
  }

  @Test
  fun `a card is the same identifier in either case, and not the phone's own storage`() {
    assertEquals("1A2B-3C4D:Music/X", folderDocumentId("1A2B-3C4D:Music", "1a2b-3c4d", "Music/X/"))
    assertNull(folderDocumentId("1A2B-3C4D:Music", "external_primary", "Music/X/"))
    assertNull(folderDocumentId("primary:Music", "1a2b-3c4d", "Music/X/"))
  }

  @Test
  fun `the top of a volume holds everything on it`() {
    assertEquals("primary:Music/X", folderDocumentId("primary:", "external_primary", "Music/X/"))
    assertEquals("primary:", folderDocumentId("primary:", "external_primary", ""))
  }

  @Test
  fun `something that is not the storage provider's kind of name, or a song with nothing known, is nowhere`() {
    assertNull(folderDocumentId("raw-folder", "external_primary", "Music/"))
    assertNull(folderDocumentId("primary:Music", null, "Music/"))
    assertNull(folderDocumentId("primary:Music", "external_primary", null))
  }

  @Test
  fun `only small text files are offered as words`() {
    assertTrue(mayHoldWords("Song.lrc", 2_000))
    assertTrue(mayHoldWords("Song.LRC", null))
    assertTrue(mayHoldWords("Song.txt", 100))
    assertFalse(mayHoldWords("Song.mp3", 100))
    assertFalse(mayHoldWords("cover.jpg", 100))
    assertFalse(mayHoldWords("huge.lrc", LARGEST_WORDS + 1L))
    assertFalse(mayHoldWords(null, 10))
  }

  @Test
  fun `a folder is named by its path, or by its volume at the top of one`() {
    assertEquals("Music/J-Pop", folderLabel("primary:Music/J-Pop", "Internal storage"))
    assertEquals("SD card", folderLabel("1A2B-3C4D:", "SD card"))
    assertEquals("1A2B-3C4D", folderLabel("1A2B-3C4D:", null))
  }

  @Test
  fun `what the native side said is passed on, or nothing for a file it could not read`() {
    assertEquals(listOf("text", "words"), wordsFrom(arrayOf("text", "words")))
    assertEquals(emptyList<String>(), wordsFrom(emptyArray()))
    assertNull(wordsFrom(arrayOf("error", "It is not a kind of file whose words can be read.")))
    assertNull(wordsFrom(null))
  }
}
