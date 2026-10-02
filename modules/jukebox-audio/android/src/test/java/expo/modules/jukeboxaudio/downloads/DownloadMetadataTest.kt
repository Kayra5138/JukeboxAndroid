package expo.modules.jukeboxaudio.downloads

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class DownloadMetadataTest {
  @Test fun musicCreditsRemoveArtistPrefixAndPresentationLabels() {
    val info = JSONObject().put("title", "Artist - Song (Official Music Video)").put("artist", "Artist").put("uploader", "Label")
    DownloadMetadata.prepare(info)
    assertEquals("Song", info.getString("meta_title"))
    assertEquals("Artist", info.getString("meta_artist"))
  }
  @Test fun structuredTrackCreditsWinAndVersionsSurvive() {
    val info = JSONObject().put("title", "Promo").put("track", "Song (Live)").put("artist", "Artist").put("album", "Live Album")
    DownloadMetadata.prepare(info)
    assertEquals("Song (Live)", info.getString("meta_title"))
    assertEquals("Live Album", info.getString("meta_album"))
  }
  @Test fun topicArtistIsNotTakenFromADashInsideTheSong() {
    val info = JSONObject().put("title", "Song - Part Two").put("channel", "Artist - Topic")
    DownloadMetadata.prepare(info)
    assertEquals("Song - Part Two", info.getString("meta_title"))
    assertEquals("Artist", info.getString("meta_artist"))
  }
  @Test fun uploaderAndUnverifiedTitleAreNotArtistCredits() {
    val info = JSONObject().put("title", "Something - A random upload").put("uploader", "Fan Channel")
    DownloadMetadata.prepare(info)
    assertEquals("", info.getString("meta_artist"))
    assertEquals("Something - A random upload", info.getString("meta_title"))
  }
  @Test fun catalogueConfirmationSeparatesTitleArtistAndAlbum() {
    val info = JSONObject().put("title", "Artist - Song (Official Video)")
    DownloadMetadata.prepare(info)
    assertTrue(DownloadMetadata.applyCatalogue(info, JSONObject().put("trackName", "Song").put("artistName", "Artist").put("collectionName", "Album")))
    assertEquals("Song", info.getString("meta_title"))
    assertEquals("Artist", info.getString("meta_artist"))
    assertEquals("Album", info.getString("meta_album"))
    assertFalse(DownloadMetadata.applyCatalogue(info, JSONObject().put("trackName", "Song").put("artistName", "Wrong Artist")))
    assertEquals("Artist", info.getString("meta_artist"))
  }
  @Test fun literalMetadataCannotBecomeTemplateFields() {
    assertEquals(" title :(?s) (?P<meta_title>.*) ", DownloadMetadata.option("title", "title"))
    assertEquals(" 100%%\\: %%(title)s :(?s) (?P<meta_title>.*) ", DownloadMetadata.option("title", "100%: %(title)s"))
    assertEquals("  :(?s) (?P<meta_artist>.*) ", DownloadMetadata.option("artist", ""))
  }
}
