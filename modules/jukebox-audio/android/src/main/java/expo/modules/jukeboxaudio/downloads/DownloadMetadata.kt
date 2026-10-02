package expo.modules.jukeboxaudio.downloads

import org.json.JSONObject

/** Actual file tags, resolved before FFmpeg embeds metadata and MediaStore scans it. */
object DownloadMetadata {
  private fun text(info: JSONObject, key: String): String =
    if (info.isNull(key)) "" else info.optString(key).replace(Regex("[\\x00-\\x1f]"), " ").trim()

  fun prepare(info: JSONObject) {
    val channel = text(info, "channel").ifBlank { text(info, "uploader") }
    val musicCredits = text(info, "artist").isNotBlank() || channel.endsWith(" - Topic")
    val identity = if (musicCredits) ArtworkMatch.identity(info) else null
    val title = identity?.second ?: text(info, "track").ifBlank { text(info, "title") }
    info.put("meta_title", title.ifBlank { "YouTube audio" })
      .put("meta_artist", identity?.first.orEmpty())
      .put("meta_album", text(info, "album"))
  }

  fun applyCatalogue(info: JSONObject, entry: JSONObject): Boolean {
    val identity = ArtworkMatch.identity(info) ?: return false
    if (!ArtworkMatch.matches(identity, entry)) return false
    info.put("meta_title", text(entry, "trackName"))
      .put("meta_artist", text(entry, "artistName"))
    text(entry, "collectionName").takeIf { it.isNotBlank() }?.let { info.put("meta_album", it) }
    return true
  }

  /** Literal yt-dlp templates: spaces prevent bare names becoming field references;
   * percent/colon escaping prevents a song name being interpreted as template syntax. */
  fun option(field: String, value: String): String {
    require(field in setOf("title", "artist", "album"))
    val literal = value.replace("%", "%%").replace(":", "\\:")
    return " $literal :(?s) (?P<meta_$field>.*) "
  }
}
