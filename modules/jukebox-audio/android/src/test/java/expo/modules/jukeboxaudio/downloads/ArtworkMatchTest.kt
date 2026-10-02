package expo.modules.jukeboxaudio.downloads

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ArtworkMatchTest {
  @Test fun prefersMusicCreditsOverUploader() {
    assertEquals("Artist" to "Song", ArtworkMatch.identity(JSONObject()
      .put("artist", "Artist").put("track", "Song").put("title", "Upload title").put("channel", "Fan")))
  }
  @Test fun parsesVideoTitleAndTopicButDoesNotAssumeUploaderIsPerformer() {
    assertEquals("Artist" to "Song", ArtworkMatch.identity(JSONObject().put("title", "Artist - Song (Official Video)")))
    assertEquals("Artist" to "Song", ArtworkMatch.identity(JSONObject().put("title", "Song").put("channel", "Artist - Topic")))
    assertNull(ArtworkMatch.identity(JSONObject().put("title", "Song").put("channel", "Uploader")))
    assertNull(ArtworkMatch.identity(JSONObject().put("title", JSONObject.NULL)))
  }
  @Test fun rejectsOtherArtistsAndDifferentVersions() {
    val wanted = "Şarkıcı" to "Şarkı"
    assertTrue(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Şarkıcı").put("trackName", "Şarkı")))
    assertFalse(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Someone else").put("trackName", "Şarkı")))
    assertFalse(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Şarkıcı").put("trackName", "Şarkı (Live)")))
  }
}
