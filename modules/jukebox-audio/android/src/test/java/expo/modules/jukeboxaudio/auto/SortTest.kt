package expo.modules.jukeboxaudio.auto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SortTest {
  @Test
  fun `a shelf starts in its first order`() {
    assertEquals(Sort.TITLE, Sort.of("tracks", null))
    assertEquals(Sort.CHANGED, Sort.of("lists", null))
  }

  @Test
  fun `a saved order is kept only where the shelf offers it`() {
    assertEquals(Sort.MOST, Sort.of("albums", "most"))
    // Records have no artist order, and lists were never sorted by plays.
    assertEquals(Sort.TITLE, Sort.of("albums", "artist"))
    assertEquals(Sort.CHANGED, Sort.of("lists", "most"))
    assertEquals(Sort.TITLE, Sort.of("tracks", "nonsense"))
  }

  @Test
  fun `a shelf nobody knows still has an order`() {
    assertEquals(Sort.TITLE, Sort.of("elsewhere", "added"))
  }

  @Test
  fun `no two orders share a key`() {
    assertEquals(Sort.values().size, Sort.values().map { it.key }.toSet().size)
  }

  @Test
  fun `searching ignores case, accents and the dotless i`() {
    assertEquals(0, searchRank("sarki", "Şarkı Söyle", emptyList()))
    assertEquals(0, searchRank("ISIK", "ışık", emptyList()))
    assertEquals(1, searchRank("no ko", "Akuma no Ko", emptyList()))
  }

  @Test
  fun `every word has to be found somewhere`() {
    assertEquals(3, searchRank("eminem lie", "Love the Way You Lie", listOf("Eminem", null)))
    assertNull(searchRank("eminem stan", "Love the Way You Lie", listOf("Eminem")))
    assertNull(searchRank("   ", "Anything", emptyList()))
  }

  @Test
  fun `a name is a better answer than an artist`() {
    val byName = searchRank("queen", "Queen of Hearts", listOf("Somebody"))!!
    val byArtist = searchRank("queen", "Bohemian Rhapsody", listOf("Queen"))!!
    assert(byName < byArtist)
    assertEquals(2, searchRank("way lie", "Love the Way You Lie", emptyList()))
  }

  @Test
  fun `a track nobody looked up is called what its file says`() {
    assertEquals(Named("a.mp3", "Somebody", null), named("a.mp3", "Somebody", " ", null))
  }

  @Test
  fun `a correction typed by hand replaces the file`() {
    val typed = Kept(manual = true, title = "Akuma no Ko", artist = "Ai Higuchi", album = null, position = null)
    assertEquals(
      Named("Akuma no Ko", "Ai Higuchi", "From the file"),
      named("Ai Higuchi - Akuma no Ko", "Unknown", "From the file", typed)
    )
    // A field left empty in the correction is not a correction of it.
    assertEquals("kept.mp3", named("kept.mp3", null, null, typed.copy(title = "")).title)
  }

  @Test
  fun `a lookup fills gaps and never renames`() {
    val found = Kept(manual = false, title = "Another Recording", artist = "Found Artist", album = "Found Album", position = 3)
    assertEquals(Named("File Title", "Found Artist", "Found Album"), named("File Title", null, null, found))
    assertEquals(Named("File Title", "File Artist", "File Album"), named("File Title", "File Artist", "File Album", found))
  }
}
