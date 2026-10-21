package expo.modules.jukeboxaudio.auto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RecordsTest {
  private data class Song(val id: String, val album: String?, val albumArtist: String?, val artist: String?, val folder: String? = null)

  private fun records(vararg songs: Song) =
    Records.group(songs.toList()) { Records.Said(it.album, it.albumArtist, it.artist, it.folder) }
      .associate { record -> record.key to record.tracks.map { it.id } }

  @Test
  fun `two records of one name are kept apart by who each is by`() {
    assertEquals(
      mapOf("greatest hits\u001fqueen" to listOf("1", "2"), "greatest hits\u001fabba" to listOf("3")),
      records(
        Song("1", "Greatest Hits", "Queen", "Queen"),
        Song("2", "Greatest Hits", null, "Queen feat. Somebody"),
        Song("3", "Greatest Hits", "ABBA", "ABBA"),
      )
    )
  }

  @Test
  fun `a record of no album artist is its name alone, as it always was`() {
    assertEquals(mapOf("ruins" to listOf("1", "2")), records(Song("1", "Ruins", null, "Aurora"), Song("2", " ruins ", null, "Other")))
  }

  @Test
  fun `a guest does not take a song off its record, and a compilation is its name`() {
    assertEquals(
      mapOf("infections\u001faurora" to listOf("1", "2")),
      records(Song("1", "Infections", "Aurora", "Aurora"), Song("2", "Infections", "Aurora & Someone", "Aurora & Someone"))
    )
    assertEquals(
      mapOf("now" to listOf("1", "2")),
      records(Song("1", "Now", "Various Artists", "One"), Song("2", "Now", "Çeşitli Sanatçılar", "Two"))
    )
  }

  @Test
  fun `album artists filled in track by track in one folder are one record`() {
    assertEquals(
      mapOf("hits" to listOf("1", "2", "3")),
      records(
        Song("1", "Hits", "One", "One", "Music/Hits/"),
        Song("2", "Hits", "Two", "Two", "Music/Hits/"),
        Song("3", "Hits", "Three", "Three", "Music/Hits/"),
      )
    )
  }

  @Test
  fun `a track naming nobody goes to the record in its folder, or stays by name`() {
    assertEquals(
      mapOf("live\u001fqueen" to listOf("1", "2"), "live\u001fabba" to listOf("3"), "live" to listOf("4")),
      records(
        Song("1", "Live", "Queen", "Queen", "q/"),
        Song("2", "Live", null, "Freddie Mercury", "q/"),
        Song("3", "Live", "ABBA", "ABBA", "a/"),
        Song("4", "Live", null, "Stranger", "x/"),
      )
    )
  }

  @Test
  fun `a key keeps its name in front of its artist`() {
    assertEquals("ruins", Records.nameOf(Records.key("Ruins", "aurora")))
    assertEquals("ruins", Records.key(" Ruins ", null))
  }

  @Test
  fun `an album artist is the file's, an edit's, and a lookup's only for the record shown`() {
    val found = Kept(manual = false, title = null, artist = null, album = "Anti", position = null, albumArtist = "Rihanna")
    assertEquals("Queen", albumArtistNamed("A", "Queen", found))
    assertNull(albumArtistNamed("Now 50", null, found))
    assertEquals("Rihanna", albumArtistNamed(null, null, found))
    val typed = Kept(manual = true, title = null, artist = null, album = null, position = null, albumArtist = "")
    assertNull(albumArtistNamed("A", "Wrong", typed))
    assertEquals("Wrong", albumArtistNamed("A", "Wrong", typed.copy(albumArtist = null)))
  }
}
