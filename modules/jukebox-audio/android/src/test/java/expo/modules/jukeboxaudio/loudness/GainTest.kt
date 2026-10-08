package expo.modules.jukeboxaudio.loudness

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.log10

private fun track(
  id: String,
  album: String? = "Low",
  number: Int = -1,
  folder: String? = "Music/Bowie/Low",
  seconds: Double = 200.0
) = Queued(id, album, folder, number, seconds)

class AppliedGainTest {
  @Test
  fun `a cut is applied as it stands`() {
    // Turning something down cannot clip it, whatever its peak is.
    assertEquals(-7.5f, appliedDb(-7.5f, peak = 1f), 0f)
    assertEquals(-7.5f, appliedDb(-7.5f, peak = null), 0f)
  }

  @Test
  fun `a boost stops where the loudest sample would pass one under full scale`() {
    // Peaking at -6 dBFS there are five decibels of room once one is kept back.
    val peak = 0.5012f
    assertEquals(5f, appliedDb(9f, peak), 0.01f)
    // And a boost that fits is given whole.
    assertEquals(3f, appliedDb(3f, peak), 0f)

    // Which is the point of it: the loudest sample after the gain is at -1.
    val after = 20f * log10(peak * factor(appliedDb(9f, peak)))
    assertEquals(-HEADROOM_DB, after, 0.01f)
  }

  @Test
  fun `a record already at full scale is not turned up and not turned down either`() {
    assertEquals(0f, appliedDb(4f, peak = 1f), 0f)
    assertEquals(0f, appliedDb(4f, peak = 0.95f), 0f)
    // A tag can claim a peak above full scale; an MP3 decodes to one.
    assertEquals(0f, appliedDb(4f, peak = 1.2f), 0f)
  }

  @Test
  fun `what cannot be shown to have room is not turned up`() {
    assertEquals(0f, appliedDb(6f, peak = null), 0f)
  }

  @Test
  fun `a nearly silent track is not dragged up to the level of a song`() {
    assertEquals(MOST_BOOST_DB, appliedDb(40f, peak = 0.001f), 0f)
    assertEquals(MOST_CUT_DB, appliedDb(-90f, peak = 1f), 0f)
  }

  @Test
  fun `decibels become the number samples are multiplied by`() {
    assertEquals(1f, factor(0f), 0f)
    assertEquals(0.5012f, factor(-6f), 0.0001f)
    assertEquals(1.9953f, factor(6f), 0.0001f)
  }
}

class AlbumRunTest {
  @Test
  fun `consecutive tracks of one album are a record`() {
    assertTrue(follows(track("a", number = 3), track("b", number = 4)))
    // Tags rarely agree on case or on the space after a name.
    assertTrue(follows(track("a", album = "Low ", number = 3), track("b", album = "low", number = 4)))
  }

  @Test
  fun `two tracks of an album that are not in order are just two songs`() {
    assertFalse(follows(track("a", number = 3), track("b", number = 7)))
    assertFalse(follows(track("a", number = 4), track("b", number = 3)))
  }

  @Test
  fun `the first track of the next disc follows the last of this one`() {
    assertTrue(follows(track("a", number = 1012), track("b", number = 2001)))
    assertFalse(follows(track("a", number = 1012), track("b", number = 2002)))
  }

  @Test
  fun `unnumbered tracks are taken on the album's word`() {
    assertTrue(follows(track("a"), track("b")))
    assertTrue(follows(track("a", number = 3), track("b")))
  }

  @Test
  fun `no album is not an album`() {
    assertFalse(follows(track("a", album = null), track("b", album = null)))
    assertFalse(follows(track("a", album = " "), track("b", album = " ")))
    assertFalse(follows(track("a"), track("b", album = "Heroes")))
  }

  @Test
  fun `the same name in another folder is another record`() {
    assertFalse(
      follows(
        track("a", album = "Greatest Hits", folder = "Music/Queen"),
        track("b", album = "Greatest Hits", folder = "Music/ABBA")
      )
    )
    // Where one of them does not say, the name is all there is to go on.
    assertTrue(follows(track("a", folder = null), track("b")))
  }

  @Test
  fun `a track is not its own neighbour`() {
    // Repeat-one, or the same song queued twice running.
    assertFalse(follows(track("a", number = 3), track("a", number = 3)))
  }

  @Test
  fun `the run is as much of the order as plays through`() {
    val order = listOf(
      track("x", album = "Other", number = 9),
      track("a", number = 1),
      track("b", number = 2),
      track("c", number = 3),
      track("y", album = "Another", number = 1)
    )
    assertEquals(1..3, albumRun(order, 1))
    assertEquals(1..3, albumRun(order, 2))
    assertEquals(1..3, albumRun(order, 3))
    assertEquals(0..0, albumRun(order, 0))
    assertEquals(4..4, albumRun(order, 4))
  }
}

class DecidedGainTest {
  private val quiet = FileGain(trackDb = 4f, trackPeak = 0.3f, measured = true)
  private val loud = FileGain(trackDb = -8f, trackPeak = 0.99f, measured = true)

  @Test
  fun `a track nothing is known about is left alone`() {
    assertEquals(0f, decidedDb(listOf(track("a")), 0) { null }, 0f)
  }

  @Test
  fun `a track by itself gets its own gain`() {
    val order = listOf(track("a", album = "One"), track("b", album = "Two"))
    val known = mapOf("a" to quiet, "b" to loud)
    assertEquals(4f, decidedDb(order, 0, known::get), 0f)
    assertEquals(-8f, decidedDb(order, 1, known::get), 0f)
  }

  @Test
  fun `tracks of a record share one gain and so keep their distance`() {
    val order = listOf(track("a", number = 1), track("b", number = 2))
    val known = mapOf("a" to quiet, "b" to loud)

    val first = decidedDb(order, 0, known::get)
    val second = decidedDb(order, 1, known::get)
    assertEquals(first, second, 0f)
    // Twelve decibels apart as mastered, and the quiet one stays quiet: what
    // they share is close to the loud one's gain, which is where the power is.
    assertTrue("$first", first < -4f && first > -8f)
  }

  @Test
  fun `the shared gain is the mean of the tracks as power, by length`() {
    // Two tracks of equal length at -10 and -20 LUFS are -12.6 together.
    val order = listOf(track("a", number = 1), track("b", number = 2))
    val known = mapOf(
      "a" to FileGain(trackDb = (REFERENCE_LUFS + 10).toFloat(), trackPeak = 0.1f),
      "b" to FileGain(trackDb = (REFERENCE_LUFS + 20).toFloat(), trackPeak = 0.1f)
    )
    val album = albumGain(order, known::get)!!
    assertEquals(REFERENCE_LUFS + 12.596, album.trackDb.toDouble(), 0.01)

    // A long quiet track counts for more than a short loud one.
    val uneven = listOf(track("a", number = 1, seconds = 30.0), track("b", number = 2, seconds = 600.0))
    assertTrue(albumGain(uneven, known::get)!!.trackDb > album.trackDb)
  }

  @Test
  fun `until every track of the record is known each plays at its own`() {
    val order = listOf(track("a", number = 1), track("b", number = 2), track("c", number = 3))
    val known = mapOf("a" to quiet, "b" to loud)
    assertNull(albumGain(order, known::get))
    assertEquals(4f, decidedDb(order, 0, known::get), 0f)
    assertEquals(-8f, decidedDb(order, 1, known::get), 0f)
    assertEquals(0f, decidedDb(order, 2, known::get), 0f)
  }

  @Test
  fun `an album gain in the tags is taken over one worked out here`() {
    val order = listOf(track("a", number = 1), track("b", number = 2))
    val tagged = FileGain(trackDb = 2f, trackPeak = 0.5f, albumDb = -5f, albumPeak = 0.98f)
    // The other is not known at all, and it does not matter.
    assertEquals(-5f, decidedDb(order, 0) { if (it == "a") tagged else null }, 0f)
  }

  @Test
  fun `and ignored when the album is not what is being played`() {
    val tagged = FileGain(trackDb = -2f, trackPeak = 0.5f, albumDb = -5f, albumPeak = 0.98f)
    val order = listOf(track("a", number = 1), track("z", album = "Elsewhere", number = 4))
    assertEquals(-2f, decidedDb(order, 0) { tagged }, 0f)
  }

  @Test
  fun `a record's boost is held by the loudest sample anywhere on it`() {
    val order = listOf(track("a", number = 1), track("b", number = 2))
    val known = mapOf(
      "a" to FileGain(trackDb = 9f, trackPeak = 0.2f),
      "b" to FileGain(trackDb = 9f, trackPeak = 0.7f)
    )
    // Alone, the first has room for all nine. As half of a record it gets
    // what the second has room for, so the two stay level with each other.
    assertEquals(9f, decidedDb(listOf(order[0]), 0, known::get), 0f)
    val together = decidedDb(order, 0, known::get)
    assertEquals(-HEADROOM_DB - 20f * log10(0.7f), together, 0.01f)
    assertEquals(together, decidedDb(order, 1, known::get), 0f)
  }

  @Test
  fun `one unknown peak on a record means none of it is turned up`() {
    val order = listOf(track("a", number = 1), track("b", number = 2))
    val known = mapOf(
      "a" to FileGain(trackDb = 9f, trackPeak = 0.2f),
      "b" to FileGain(trackDb = 9f, trackPeak = null)
    )
    assertEquals(0f, decidedDb(order, 0, known::get), 0f)
  }
}

class LoudnessStoreTest {
  @Test
  fun `what is written down reads back the same`() {
    val all = listOf(
      FileGain(trackDb = -6.5f, trackPeak = 0.98f, albumDb = -7.25f, albumPeak = 1f, measured = false),
      FileGain(trackDb = 3f, trackPeak = null, measured = true),
      FileGain(trackDb = 0f, trackPeak = 0f, measured = true)
    )
    for (gain in all) {
      val text = LoudnessStore.toJson(gain).toString()
      assertEquals(gain, LoudnessStore.fromJson(org.json.JSONObject(text)))
    }
  }

  @Test
  fun `a line that makes no sense is no entry rather than a gain of nothing`() {
    assertNull(LoudnessStore.fromJson(null))
    assertNull(LoudnessStore.fromJson(org.json.JSONObject("{\"p\":0.5}")))
  }
}
