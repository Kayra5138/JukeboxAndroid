package expo.modules.jukeboxaudio.downloads

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class YouTubeDataTest {
  private val id = "BaW_jenozKc"

  @Test fun searchDoesNotBecomeShellOrDownloaderOptions() {
    assertEquals("ytsearch20:artist - song", YouTubeData.input(" artist - song "))
    assertEquals("ytsearch20:--exec touch /tmp/example", YouTubeData.input("--exec touch /tmp/example"))
  }

  @Test fun acceptsCanonicalShortMobileMusicAndShortsLinks() {
    val links = listOf("https://www.youtube.com/watch?v=$id&list=PL123", "https://youtu.be/$id?t=3",
      "https://music.youtube.com/watch?v=$id", "https://m.youtube.com/watch?v=$id",
      "youtube.com/shorts/$id", "youtu.be/$id", "https://www.youtube.com/live/$id")
    links.forEach { assertEquals(YouTubeData.url(id), YouTubeData.input(it)) }
  }

  @Test fun refusesOtherHostsAndNonVideoLinks() {
    listOf("https://youtube.com.evil.test/watch?v=$id", "https://evil.test/", "file:///etc/passwd",
      "https://user@youtube.com/watch?v=$id", "https://youtube.com:443/watch?v=$id",
      "https://youtube.com/playlist?list=PL123", "https://youtube.com/watch?v=bad").forEach {
      assertThrows(YouTubeTrouble::class.java) { YouTubeData.input(it) }
    }
  }

  @Test fun missingFlatMetadataIsNullableAndLiveResultsAreExcluded() {
    val video = JSONObject().put("id", id).put("title", "Track").put("uploader", "Channel")
    val result = YouTubeData.video(video)!!
    assertTrue(result.isNull("duration"))
    assertTrue(result.isNull("thumbnail"))
    assertEquals("Channel", result.getString("channel"))
    assertNull(YouTubeData.video(JSONObject(video.toString()).put("is_live", true)))
    assertNull(YouTubeData.video(JSONObject(video.toString()).put("live_status", "is_upcoming")))
  }

  @Test fun deduplicatesAndIgnoresNonVideoResults() {
    val video = JSONObject().put("id", id).put("title", "Track")
    val response = JSONObject().put("entries", JSONArray().put(video).put(video).put(JSONObject().put("id", "PL123")))
    assertEquals(1, YouTubeData.results(response).size)
  }

  @Test fun playlistLinksAreCanonicalAndRejectOtherHosts() {
    assertEquals("https://www.youtube.com/playlist?list=PL123", YouTubeData.playlistInput("https://music.youtube.com/watch?v=$id&list=PL123&index=2"))
    assertEquals("https://www.youtube.com/playlist?list=PL123", YouTubeData.playlistInput("youtube.com/playlist?list=PL123"))
    listOf("https://youtube.com.evil.test/playlist?list=PL123", "https://user@youtube.com/playlist?list=PL123",
      "file:///playlist?list=PL123", "https://youtube.com/watch?v=$id", "https://youtube.com/playlist?list=PL%26bad").forEach {
      assertThrows(YouTubeTrouble::class.java) { YouTubeData.playlistInput(it) }
    }
  }

  @Test fun playlistsKeepMoreThanTwentyAndExcludePrivateAndDeletedVideos() {
    val entries = JSONArray()
    repeat(60) { entries.put(JSONObject().put("id", it.toString().padStart(11, '0')).put("title", "Track $it")) }
    entries.put(JSONObject().put("id", id).put("title", "[Deleted video]"))
    entries.put(JSONObject().put("id", id).put("availability", "private"))
    val response = JSONObject().put("entries", entries)
    assertEquals(20, YouTubeData.results(response).size)
    assertEquals(60, YouTubeData.results(response, 500).size)
  }

  @Test fun playlistNamesBecomeFilteredSearchesAndLinksStayLinks() {
    assertEquals("https://www.youtube.com/results?search_query=rock+%26+jazz&sp=EgIQAw%3D%3D", YouTubeData.playlistQuery(" rock & jazz "))
    assertEquals("https://www.youtube.com/playlist?list=PL123", YouTubeData.playlistQuery("youtube.com/playlist?list=PL123"))
    assertThrows(YouTubeTrouble::class.java) { YouTubeData.playlistQuery("https://evil.test/playlist?list=PL123") }
  }

  @Test fun playlistSearchOnlyReturnsCanonicalPlaylistCards() {
    val playlist = JSONObject().put("url", "https://www.youtube.com/playlist?list=PL123").put("title", "Rock")
    val entries = JSONArray().put(playlist).put(playlist).put(JSONObject().put("url", "https://youtube.com/watch?v=$id"))
      .put(JSONObject().put("url", "https://evil.test/playlist?list=PL999"))
    val results = YouTubeData.playlists(JSONObject().put("entries", entries))
    assertEquals(1, results.size)
    assertEquals("playlist", results.first().getString("kind"))
    assertEquals("PL123", results.first().getString("id"))
  }

  @Test fun destinationCannotEscapeMusic() {
    assertEquals("Music/Albums", YouTubeData.folder("/Music/Albums/"))
    listOf("Downloads", "Music/../Documents", "Music//Album", "Music/./Album", "Music/Album\\bad").forEach {
      assertThrows(YouTubeTrouble::class.java) { YouTubeData.folder(it) }
    }
  }
}
