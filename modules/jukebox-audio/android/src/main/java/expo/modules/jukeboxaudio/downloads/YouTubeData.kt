package expo.modules.jukeboxaudio.downloads

import org.json.JSONObject
import java.net.URI
import java.net.URLEncoder

/** Playlist previews are expanded into individually validated video jobs. */
object YouTubeData {
  private val videoId = Regex("[A-Za-z0-9_-]{11}")
  private val hosts = setOf("youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be")

  fun url(id: String): String {
    if (!videoId.matches(id)) throw YouTubeTrouble(Failure.INVALID_VIDEO)
    return "https://www.youtube.com/watch?v=$id"
  }

  fun input(text: String): String {
    val value = text.trim()
    if (value.isEmpty() || value.length > 500) throw YouTubeTrouble(Failure.QUERY)
    if (!value.contains("://") && !value.startsWith("www.") &&
      !value.startsWith("youtu.be/") && !value.startsWith("youtube.com/") &&
      !value.startsWith("music.youtube.com/") && !value.startsWith("m.youtube.com/")) return "ytsearch20:$value"
    val uri = URI(if (value.contains("://")) value else "https://$value")
    if (!(uri.scheme?.lowercase() in setOf("http", "https") && uri.host?.lowercase() in hosts && uri.userInfo == null && uri.port == -1)) {
      throw YouTubeTrouble(Failure.VIDEO_LINK)
    }
    val segments = uri.path.orEmpty().split('/').filter { it.isNotEmpty() }
    val id = when {
      uri.host?.lowercase()?.endsWith("youtu.be") == true -> segments.firstOrNull()
      segments.firstOrNull() in setOf("shorts", "embed", "live") -> segments.getOrNull(1)
      uri.path == "/watch" -> uri.rawQuery.orEmpty().split('&').firstOrNull { it.startsWith("v=") }?.substring(2)
      else -> null
    }
    if (id == null || !videoId.matches(id)) throw YouTubeTrouble(Failure.NOT_A_VIDEO)
    return url(id)
  }

  fun playlistQuery(text: String): String {
    val value = text.trim()
    if (value.length !in 1..500) throw YouTubeTrouble(Failure.PLAYLIST_QUERY)
    if (value.contains("://") || value.startsWith("www.") || value.startsWith("youtube.com/") ||
      value.startsWith("m.youtube.com/") || value.startsWith("music.youtube.com/") || value.startsWith("youtu.be/")) return playlistInput(value)
    return "https://www.youtube.com/results?search_query=${URLEncoder.encode(value, "UTF-8")}&sp=EgIQAw%3D%3D"
  }

  fun playlists(json: JSONObject): List<JSONObject> {
    val entries = json.optJSONArray("entries") ?: return emptyList()
    return (0 until entries.length()).mapNotNull { index ->
      val item = entries.optJSONObject(index) ?: return@mapNotNull null
      val url = runCatching { playlistInput(item.optString("url")) }.getOrNull() ?: return@mapNotNull null
      val thumbs = item.optJSONArray("thumbnails")
      val thumbnail = item.optString("thumbnail").takeIf { it.startsWith("https://") }
        ?: thumbs?.optJSONObject(thumbs.length() - 1)?.optString("url")?.takeIf { it.startsWith("https://") }
      JSONObject().put("id", url.substringAfter("list=")).put("url", url).put("kind", "playlist")
        .put("title", item.optString("title").ifBlank { "YouTube playlist" })
        .put("channel", item.optString("channel").takeUnless { it == "null" } ?: "")
        .put("thumbnail", thumbnail ?: JSONObject.NULL).put("duration", JSONObject.NULL)
    }.distinctBy { it.getString("id") }.take(20)
  }

  fun playlistInput(text: String): String {
    val value = text.trim()
    if (value.length !in 1..500) throw YouTubeTrouble(Failure.PLAYLIST_LINK)
    val uri = URI(if (value.contains("://")) value else "https://$value")
    if (!(uri.scheme?.lowercase() in setOf("http", "https") && uri.host?.lowercase() in hosts && uri.userInfo == null && uri.port == -1)) {
      throw YouTubeTrouble(Failure.PLAYLIST_LINK)
    }
    val id = uri.rawQuery.orEmpty().split('&').firstOrNull { it.startsWith("list=") }?.substring(5)
    if (id == null || !Regex("[A-Za-z0-9_-]{2,150}").matches(id)) throw YouTubeTrouble(Failure.NO_PLAYLIST)
    return "https://www.youtube.com/playlist?list=$id"
  }

  fun video(json: JSONObject): JSONObject? {
    val id = json.optString("id")
    if (json.optString("availability") in setOf("private", "premium_only", "subscriber_only") || json.optString("title") in setOf("[Deleted video]", "[Private video]") || !videoId.matches(id) || json.optBoolean("is_live") || json.optString("live_status") in setOf("is_live", "is_upcoming")) return null
    val thumbs = json.optJSONArray("thumbnails")
    val thumbnail = json.optString("thumbnail").takeIf { it.startsWith("https://") }
      ?: (if (thumbs != null && thumbs.length() > 0) thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") else null)
        ?.takeIf { it.startsWith("https://") }
    return JSONObject().put("id", id).put("url", url(id))
      .put("title", json.optString("title").ifBlank { "YouTube audio" })
      .put("channel", json.optString("channel").ifBlank { json.optString("uploader") })
      .put("thumbnail", thumbnail ?: JSONObject.NULL)
      .put("duration", json.optDouble("duration").takeIf { it.isFinite() && it > 0 } ?: JSONObject.NULL)
  }

  fun results(json: JSONObject, limit: Int = 20): List<JSONObject> {
    val entries = json.optJSONArray("entries") ?: return listOfNotNull(video(json))
    return (0 until entries.length()).mapNotNull { entries.optJSONObject(it)?.let(::video) }
      .distinctBy { it.getString("id") }.take(limit)
  }

  fun folder(value: String): String {
    val parts = value.trim('/').split('/')
    if (parts.firstOrNull() != "Music" || parts.any { it.isBlank() || it == "." || it == ".." || it.contains('\\') }) {
      throw YouTubeTrouble(Failure.FOLDER)
    }
    return parts.joinToString("/")
  }

  fun map(json: JSONObject): Map<String, Any?> = json.keys().asSequence().associateWith { key ->
    val value = json.get(key)
    when (value) {
      JSONObject.NULL -> null
      is JSONObject -> map(value)
      else -> value
    }
  }
}
