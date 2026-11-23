package expo.modules.jukeboxaudio.auto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** The bounds `src/lib/media/__tests__/shuffle.test.ts` holds the app's shuffle to, which this one is the same as. */
class SpreadShuffleTest {
  private data class Song(val title: String, val artist: String)

  private fun library(artists: List<String>, each: Int) = artists.flatMap { artist -> (1..each).map { Song("$artist$it", artist) } }

  private fun longestRun(order: List<Song>): Int {
    var longest = 0
    var run = 0
    order.forEachIndexed { index, song ->
      run = if (index > 0 && order[index - 1].artist == song.artist) run + 1 else 1
      longest = maxOf(longest, run)
    }
    return longest
  }

  @Test
  fun keepsEverySongOnceAndNeverLetsAnArtistRunPastAPair() {
    val songs = library(listOf("a", "b", "c"), 10)
    repeat(300) { seed ->
      val dealt = SpreadShuffle.shuffled(songs, Random(seed)) { it.artist }
      assertEquals(songs.sortedBy { it.title }, dealt.sortedBy { it.title })
      assertTrue("seed $seed", longestRun(dealt) <= 2)
    }
  }

  @Test
  fun spreadsAnArtistWhoIsMostOfTheQueueAsEvenlyAsThereIsRoomFor() {
    val songs = library(listOf("a"), 20) + library(listOf("b"), 5)
    repeat(300) { seed -> assertTrue("seed $seed", longestRun(SpreadShuffle.shuffled(songs, Random(seed)) { it.artist }) <= 6) }
  }

  @Test
  fun foldsAnArtistTheWayTheAppDoes() {
    assertEquals(SpreadShuffle.artistKey("AURORA"), SpreadShuffle.artistKey("Aurora"))
    assertEquals(SpreadShuffle.artistKey("Björk"), SpreadShuffle.artistKey("bjork"))
    assertEquals("", SpreadShuffle.artistKey(null))
    // Whoever it is filed under, a guest or a partner in the credit or not.
    val alone = SpreadShuffle.artistKey("Sertab Erener")
    assertEquals(alone, SpreadShuffle.artistKey("Sertab Erener feat. Ozan Çolakoğlu"))
    assertEquals(alone, SpreadShuffle.artistKey("Sertab Erener & Demir Demirkan"))
    assertEquals(alone, SpreadShuffle.artistKey("Sertab Erener, Sezen Aksu"))
    // A band and its backing name stays one.
    assertNotEquals(SpreadShuffle.artistKey("Florence"), SpreadShuffle.artistKey("Florence & the Machine"))
  }
}
