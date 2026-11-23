package expo.modules.jukeboxaudio.downloads

import org.json.JSONObject
import java.text.Normalizer
import java.util.Locale

/** Conservative matching: an unrelated cover is worse than a video thumbnail. */
object ArtworkMatch {
  private fun value(json: JSONObject, key: String) = if (json.isNull(key)) "" else json.optString(key).trim()
  /*
    What a video's title says about the upload rather than the song, as the
    app's own lookups take it off (`withoutPackaging` in `metadata/credit.ts`),
    in the few shapes a download's title has it: a bracket with nothing else in
    it, and a run of such words at the end, or just before the brackets at the
    end, which are about the recording and stay. A run counts only with a
    strong word in it, so that `Video Games` keeps its name; and `Song` at its
    front is the song's own name more often than not.
  */
  private val packaging = setOf(
    "official", "music", "video", "audio", "lyric", "lyrics", "visualizer", "visualiser", "hd", "hq", "4k", "mv",
    "explicit", "with", "full", "song", "clip", "videoclip", "remastered", "remaster",
  )
  private val strong = setOf("official", "video", "audio", "lyric", "lyrics", "visualizer", "visualiser", "hd", "hq", "4k", "mv", "explicit", "videoclip")
  private fun packagingOnly(note: String): Boolean {
    val words = fold(note.replace(Regex("\\bm\\s*/\\s*v\\b", RegexOption.IGNORE_CASE), "mv")).split(' ').filter { it.isNotBlank() }
    return words.isNotEmpty() && words.all { it in packaging } && words.any { it in strong }
  }
  private fun withoutTrailingNote(text: String): String {
    val words = text.trim().split(Regex("\\s+"))
    var cut = words.size
    while (cut > 1 && fold(words[cut - 1]) in packaging) cut--
    while (cut < words.size && fold(words[cut]) == "song") cut++
    val run = words.drop(cut).map(::fold)
    return if (run.isNotEmpty() && run.any { it in strong }) words.take(cut).joinToString(" ") else text.trim()
  }
  private fun clean(title: String): String {
    val noted = Regex("\\s*[\\[(]([^\\])]*)[\\])]").replace(title) { if (packagingOnly(it.groupValues[1])) "" else it.value }.trim()
    val kept = Regex("^(.*?\\S)((?:\\s*\\([^)]*\\))+)\\s*$").find(noted)
    val cleaned = if (kept != null) withoutTrailingNote(kept.groupValues[1]) + kept.groupValues[2] else withoutTrailingNote(noted)
    return cleaned.replace(Regex("\\s{2,}"), " ").trim().ifBlank { title.trim() }
  }
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

  /** A catalogue's name for the song with its guests taken off: `Song (feat. Guest)` is `Song`; another version is not. */
  private fun withoutGuests(title: String) =
    title.replace(Regex("\\s*[\\[(](?:feat\\.?|ft\\.?|featuring|with)\\s[^\\])]*[\\])]", RegexOption.IGNORE_CASE), "")
      .replace(Regex("\\s+(?:feat\\.?|ft\\.?|featuring)\\s.*$", RegexOption.IGNORE_CASE), "")

  /** Whoever a catalogue credits first: `Artist & Guest`, `Artist, Guest`, `Artist feat. Guest` are Artist's. */
  private fun firstCredited(artist: String) =
    artist.split(Regex("\\s*(?:&|,|\\s+x\\s+|\\s+feat\\.?\\s+|\\s+ft\\.?\\s+|\\s+featuring\\s+)\\s*", RegexOption.IGNORE_CASE)).first()

  fun matches(identity: Pair<String, String>, entry: JSONObject): Boolean {
    val artist = fold(identity.first)
    val song = fold(identity.second)
    if (artist.isBlank() || song.isBlank()) return false
    val credited = value(entry, "artistName")
    return (fold(credited) == artist || fold(firstCredited(credited)) == artist) &&
      fold(withoutGuests(value(entry, "trackName"))) == song
  }
}
