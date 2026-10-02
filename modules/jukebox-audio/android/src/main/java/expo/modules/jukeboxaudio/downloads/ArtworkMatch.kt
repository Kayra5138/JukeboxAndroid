package expo.modules.jukeboxaudio.downloads

import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale

/** Conservative matching: an unrelated cover is worse than a video thumbnail. */
object ArtworkMatch {
  private fun value(json: JSONObject, key: String) = if (json.isNull(key)) "" else json.optString(key).trim()
  private fun clean(title: String) = title.replace(
    Regex("[\\[(](?:official\\s+)?(?:music\\s+video|video|audio|lyrics?|visuali[sz]er|lyric\\s+video|hd|4k)[\\])]", RegexOption.IGNORE_CASE), ""
  ).trim()
  private fun fold(value: String) = Normalizer.normalize(value.lowercase(Locale.ROOT).replace('ı', 'i'), Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "").replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim()

  fun identity(info: JSONObject): Pair<String, String>? {
    val title = value(info, "track").ifBlank { value(info, "title") }
    val artist = value(info, "artist")
    if (artist.isNotBlank() && title.isNotBlank()) {
      val parts = title.split(Regex("\\s+[-–—]\\s+"), limit = 2)
      val song = if (parts.size == 2 && fold(parts[0]) == fold(artist)) parts[1] else title
      return artist to clean(song)
    }
    val channel = value(info, "channel").ifBlank { value(info, "uploader") }
    if (channel.endsWith(" - Topic") && title.isNotBlank()) return channel.removeSuffix(" - Topic") to clean(title)
    val split = title.split(Regex("\\s+[-–—]\\s+"), limit = 2)
    if (split.size == 2 && split.all { it.isNotBlank() }) return split[0].trim() to clean(split[1])
    return null
  }

  fun matches(identity: Pair<String, String>, entry: JSONObject): Boolean =
    fold(identity.first).isNotBlank() && fold(identity.second).isNotBlank() &&
      fold(identity.first) == fold(value(entry, "artistName")) &&
      fold(identity.second) == fold(value(entry, "trackName"))
}
