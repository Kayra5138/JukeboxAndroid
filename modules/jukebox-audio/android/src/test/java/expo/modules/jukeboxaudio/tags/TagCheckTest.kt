package expo.modules.jukeboxaudio.tags

import expo.modules.jukeboxaudio.R
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class TagCheckTest {
  private fun report(vararg changes: Pair<String, String>, pictures: List<String> = emptyList(), others: List<String> = emptyList()): TagReport {
    val fields = linkedMapOf(
      "format" to "mp3", "lengthMs" to "215000", "sampleRate" to "44100", "channels" to "2",
      "id3v2" to "3", "id3v1" to "0",
      "title" to "Wrong", "artist" to "Somebody", "album" to "", "genre" to "", "year" to "1999", "track" to "3", "disc" to "0"
    )
    changes.forEach { fields[it.first] = it.second }
    val pairs = fields.flatMap { listOf(it.key, it.value) } +
      pictures.flatMap { listOf("picture", it) } + others.flatMap { listOf("other", it) }
    return TagReport.parse(pairs.toTypedArray())
  }

  @Test
  fun `a report is read by name, with pictures and other fields gathered`() {
    val read = report(pictures = listOf("3:10:1", "0:5:2"), others = listOf("TXXX:9", "COMM:4"))
    assertEquals("mp3", read.format)
    assertEquals(215_000, read.lengthMs)
    assertEquals(1999, read.year)
    assertEquals(listOf("0:5:2", "3:10:1"), read.pictures)
    assertEquals(listOf("COMM:4", "TXXX:9"), read.others)
  }

  @Test
  fun `the native side's reason for not reading a file is what is thrown`() {
    val refusal = assertThrows(Refusal::class.java) {
      TagReport.parse(arrayOf("error", "It is neither an MP3 nor a FLAC."))
    }
    assertEquals(R.string.jukebox_tags_neither, refusal.words.id)
    assertThrows(Refusal::class.java) { TagReport.parse(null) }
    assertThrows(Refusal::class.java) { TagReport.parse(arrayOf("format", "mp3")) }
  }

  @Test
  fun `what was changed is read from the answer, and an error is thrown`() {
    assertEquals(setOf("title", "cover"), changedBy("changed:title,cover"))
    assertTrue(changedBy("changed:").isEmpty())
    // A reason this side has no words for is passed on as it was said.
    val unknown = assertThrows(Refusal::class.java) { changedBy("error:No.") }.words
    assertEquals(R.string.jukebox_as_said, unknown.id)
    assertEquals(listOf("No."), unknown.with.toList())
    val known = assertThrows(Refusal::class.java) { changedBy("error:It could not be read as a FLAC.") }.words
    assertEquals(R.string.jukebox_tags_not_flac, known.id)
    assertThrows(Refusal::class.java) { changedBy(null) }
    assertThrows(Refusal::class.java) { changedBy("something else") }
  }

  @Test
  fun `blank text and numbers that count nothing are no opinion`() {
    val wanted = Wanted.from(mapOf("title" to "  Song ", "artist" to "  ", "year" to 0.0, "track" to 4.0, "disc" to null))
    assertEquals(Wanted(title = "Song", track = 4), wanted)
    assertTrue(Wanted.from(emptyMap()).empty)
    assertEquals(listOf("Song", null, null, null, null, "4", null), wanted.fields().toList())
  }

  @Test
  fun `a new cover takes the place of the front cover and leaves the back`() {
    assertEquals(listOf("3:9:9", "4:7:7"), picturesAfter(listOf("3:1:1", "4:7:7"), "3:9:9"))
    // With no front cover, it is the unmarked picture that every player was showing.
    assertEquals(listOf("3:9:9", "4:7:7"), picturesAfter(listOf("0:1:1", "4:7:7"), "3:9:9"))
    // With one, an unmarked picture is something else and stays.
    assertEquals(listOf("0:2:2", "3:9:9"), picturesAfter(listOf("0:2:2", "3:1:1"), "3:9:9"))
    assertEquals(listOf("3:9:9"), picturesAfter(emptyList(), "3:9:9"))
  }

  @Test
  fun `a copy that says what was asked and nothing else is passed`() {
    val before = report(pictures = listOf("0:5:2"), others = listOf("TXXX:9"))
    val after = report("title" to "Right", "track" to "5", pictures = listOf("3:10:1"), others = listOf("TXXX:9"))
    assertNull(verify(before, after, Wanted(title = "Right", artist = "Somebody", track = 5), setOf("title", "track", "cover"), "3:10:1"))
  }

  @Test
  fun `a field that came back different from what was asked is caught`() {
    val before = report()
    val after = report("title" to "Righ")
    assertNotNull(verify(before, after, Wanted(title = "Right"), setOf("title"), null))
  }

  @Test
  fun `a field nobody asked to change must read as it did`() {
    val before = report()
    assertNotNull(verify(before, report("artist" to "Somebody Else"), Wanted(title = "Wrong"), emptySet(), null))
    // Said to be changed, but never asked for.
    assertNotNull(verify(before, report("year" to "2001"), Wanted(), setOf("year"), null))
  }

  @Test
  fun `sound described differently is caught before anything else`() {
    val before = report()
    assertNotNull(verify(before, report("lengthMs" to "214999"), Wanted(), emptySet(), null))
    assertNotNull(verify(before, report("channels" to "1"), Wanted(), emptySet(), null))
    assertNotNull(verify(before, report("format" to "flac"), Wanted(), emptySet(), null))
  }

  @Test
  fun `a detail that is not ours going missing is caught and named`() {
    val before = report(others = listOf("RVAD:0", "TXXX:9"))
    val complaint = verify(before, report(others = listOf("TXXX:9")), Wanted(), emptySet(), null)
    assertEquals(R.string.jukebox_tags_details_lost, complaint!!.id)
    assertEquals(listOf("RVAD"), complaint.with.toList())
    assertNotNull(verify(before, report(others = listOf("RVAD:0", "TXXX:8")), Wanted(), emptySet(), null))
    assertNotNull(verify(before, report(others = listOf("PRIV:1", "RVAD:0", "TXXX:9")), Wanted(), emptySet(), null))
  }

  @Test
  fun `pictures are held to exactly what should be there`() {
    val before = report(pictures = listOf("3:5:2", "4:7:7"))
    // The back cover went with the front.
    assertNotNull(verify(before, report(pictures = listOf("3:10:1")), Wanted(), setOf("cover"), "3:10:1"))
    // A picture changed when no cover was written.
    assertNotNull(verify(before, report(pictures = listOf("3:10:1", "4:7:7")), Wanted(), emptySet(), null))
    assertNull(verify(before, report(pictures = listOf("3:10:1", "4:7:7")), Wanted(), setOf("cover"), "3:10:1"))
  }

  @Test
  fun `a v2_3 tag stays v2_3 and anything else becomes v2_4`() {
    assertNull(verify(report(), report(), Wanted(), emptySet(), null))
    assertNotNull(verify(report(), report("id3v2" to "4"), Wanted(), emptySet(), null))
    assertNull(verify(report("id3v2" to "0"), report("id3v2" to "4"), Wanted(), emptySet(), null))
    assertNull(verify(report("id3v2" to "2"), report("id3v2" to "4"), Wanted(), emptySet(), null))
    assertNotNull(verify(report("id3v2" to "4"), report("id3v2" to "3"), Wanted(), emptySet(), null))
    assertNotNull(verify(report(), report("id3v1" to "1"), Wanted(), emptySet(), null))
  }

  @Test
  fun `a picture is named the way the native side names it`() {
    // CRC-32 of "123456789" is the check value every implementation is held to.
    assertEquals("3:9:3421780262", pictureLine(3, "123456789".toByteArray()))
  }
}
