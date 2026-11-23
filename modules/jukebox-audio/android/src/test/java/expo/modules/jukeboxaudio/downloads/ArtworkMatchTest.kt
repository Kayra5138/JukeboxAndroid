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
  @Test fun cleansWhatIsAboutTheUploadWhereverItIs() {
    assertEquals("Artist" to "Song", ArtworkMatch.identity(JSONObject().put("title", "Artist - Song with lyrics")))
    assertEquals("Artist" to "Song (Live)", ArtworkMatch.identity(JSONObject().put("title", "Artist - Song Official Video (Live)")))
    assertEquals("Artist" to "Song", ArtworkMatch.identity(JSONObject().put("title", "Artist - Song [Official Music Video] (HD)")))
    // A song's own name that ends in such a word keeps it.
    assertEquals("Artist" to "Video Games", ArtworkMatch.identity(JSONObject().put("title", "Artist - Video Games")))
    assertEquals("Artist" to "Sad Song", ArtworkMatch.identity(JSONObject().put("title", "Artist - Sad Song (Lyrics)")))
  }
  @Test fun takesGuestsAndSharedCreditsAsTheSameSong() {
    val wanted = "Artist" to "Song"
    assertTrue(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Artist").put("trackName", "Song (feat. Guest)")))
    assertTrue(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Artist & Guest").put("trackName", "Song")))
    assertTrue(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Artist, Guest").put("trackName", "Song")))
    // Still not another version, nor a song somebody else sings with a guest of that name.
    assertFalse(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Artist").put("trackName", "Song (Remix)")))
    assertFalse(ArtworkMatch.matches(wanted, JSONObject().put("artistName", "Guest & Artist").put("trackName", "Song")))
  }
}
