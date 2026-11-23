package expo.modules.jukeboxaudio.downloads

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

/**
 * What is said in a tape fetched from YouTube, as its captions have it: the
 * video's own, written by whoever made it, in the language it is in, or else
 * the ones YouTube wrote itself from the sound. Kept as `[{s, t}]` — where a
 * line begins, in milliseconds, and what it says — a file for each tape, by
 * the file it became: a long talk is thousands of lines, too many to keep
 * among the settings. Found or not, it is asked of YouTube once.
 */
internal object TapeTranscripts {
  private fun folder(context: Context) = File(context.filesDir, "transcripts").apply { mkdirs() }

  private fun fileOf(context: Context, trackId: String): File =
    File(folder(context), "${trackId.replace(Regex("[^A-Za-z0-9_-]"), "_")}.json")

  /** [trackId]'s lines, an empty list for a tape found to have none, or null where it has not been looked for. */
  fun get(context: Context, trackId: String): JSONArray? =
    runCatching { JSONArray(fileOf(context, trackId).readText()) }.getOrNull()

  /**
   * Whether [trackId] has any lines kept, without reading them: a tape found
   * to have none is kept as `[]`, and one with any is longer than that.
   */
  fun kept(context: Context, trackId: String): Boolean = fileOf(context, trackId).length() > "[]".length

  fun put(context: Context, trackId: String, lines: JSONArray) {
    fileOf(context, trackId).writeText(lines.toString())
  }

  /** A tape's lines taken to its file's new id. */
  fun move(context: Context, from: String, to: String) {
    val old = fileOf(context, from)
    val new = fileOf(context, to)
    if (old.exists() && !new.exists()) old.renameTo(new)
  }

  /**
   * The captions to read out of a video's information, as the extractor
   * gave it: the video's own in its language, its own in any language, the
   * ones YouTube made in the language spoken, any it made from the sound.
   * Answers with the address of their timed text, or null for none.
   */
  fun addressIn(info: JSONObject): String? {
    val own = info.optJSONObject("subtitles")
    val made = info.optJSONObject("automatic_captions")
    val language = info.optString("language").takeUnless { it.isBlank() || it == "null" }
    val tried = buildList {
      if (language != null) {
        add(own?.optJSONArray(language))
        add(made?.optJSONArray("$language-orig"))
        add(made?.optJSONArray(language))
      }
      own?.keys()?.asSequence()?.firstOrNull { it != "live_chat" }?.let { add(own.optJSONArray(it)) }
      made?.keys()?.asSequence()?.firstOrNull { it.endsWith("-orig") }?.let { add(made.optJSONArray(it)) }
    }
    for (formats in tried) {
      formats ?: continue
      for (at in 0 until formats.length()) {
        val format = formats.optJSONObject(at) ?: continue
        if (format.optString("ext") == "json3") format.optString("url").takeIf { it.startsWith("https://") }?.let { return it }
      }
    }
    return null
  }

  /** YouTube's timed text as lines: each event's pieces joined, the empty ones and the repeats left out. */
  fun linesOf(json: JSONObject): JSONArray {
    val events = json.optJSONArray("events") ?: return JSONArray()
    val lines = JSONArray()
    var last = ""
    for (at in 0 until events.length()) {
      val event = events.optJSONObject(at) ?: continue
      val segs = event.optJSONArray("segs") ?: continue
      val text = buildString { for (seg in 0 until segs.length()) append(segs.optJSONObject(seg)?.optString("utf8").orEmpty()) }
        .replace('\n', ' ').replace(Regex("\\s+"), " ").trim()
      if (text.isEmpty() || text == last) continue
      last = text
      lines.put(JSONObject().put("s", event.optLong("tStartMs")).put("t", text))
    }
    return lines
  }

  /**
   * A transcript in one of the forms a podcast gives — SubRip, WebVTT, or
   * Podcasting 2.0's JSON — as lines: `[(fromMs, text)]`, in order, the
   * markup taken out and empty ones left out.
   */
  fun timedLines(text: String, type: String?): List<Pair<Long, String>> {
    if (type == "application/json" || text.trimStart().startsWith("{")) {
      val segments = runCatching { JSONObject(text).optJSONArray("segments") }.getOrNull() ?: return emptyList()
      return joined((0 until segments.length()).mapNotNull { at ->
        val segment = segments.optJSONObject(at) ?: return@mapNotNull null
        val start = segment.optDouble("startTime", Double.NaN)
        if (!start.isFinite()) null
        else Triple((start * 1000).toLong(), segment.optString("body"), segment.optString("speaker").takeUnless { it == "null" }.orEmpty())
      })
    }
    val stamp = Regex("^\\s*((?:\\d{1,2}:)?\\d{1,2}:\\d{2}[,.]\\d{1,3})\\s*-->")
    val lines = ArrayList<Pair<Long, String>>()
    var start: Long? = null
    val words = StringBuilder()
    fun close() {
      val said = words.toString().replace(Regex("<[^>]+>"), "").replace(Regex("\\s+"), " ").trim()
      val from = start
      if (from != null && said.isNotEmpty()) lines.add(from to said)
      start = null
      words.setLength(0)
    }
    for (line in text.lines()) {
      val found = stamp.find(line)
      when {
        found != null -> {
          close()
          start = msOf(found.groupValues[1])
        }
        line.isBlank() -> close()
        start != null -> words.append(' ').append(line)
      }
    }
    close()
    return lines
  }

  /**
   * A transcript's segments as lines to follow. Some hosts give a segment a
   * sentence, and some — Buzzsprout — a word, with the spaces between as
   * segments of their own: followed as they were, a word at a time went by.
   * So they are run together, each line ended where its speaker changes,
   * where there is a pause, at the end of a sentence once there is a little
   * of it, or once it has grown long; a line starts with its first word.
   */
  internal fun joined(segments: List<Triple<Long, String, String>>): List<Pair<Long, String>> {
    val lines = ArrayList<Pair<Long, String>>()
    var start = -1L
    var speaker = ""
    var lastAt = 0L
    val words = StringBuilder()
    fun close() {
      val said = words.toString().replace(Regex("\\s+"), " ").trim()
      if (start >= 0 && said.isNotEmpty()) lines.add(start to said)
      start = -1L
      words.setLength(0)
    }
    for ((at, body, who) in segments) {
      val blank = body.isBlank()
      if (!blank && start >= 0 && (who != speaker || at - lastAt > 2_000)) close()
      if (blank) {
        if (start >= 0) words.append(' ')
        continue
      }
      if (start < 0) {
        start = at
        speaker = who
      }
      // Words given each with its own space, or none: spaced either way.
      if (words.isNotEmpty() && !words.endsWith(" ") && !body.startsWith(" ")) words.append(' ')
      words.append(body)
      lastAt = at
      val length = words.trim().length
      if ((length >= 24 && Regex("[.!?…]['\"”’)]*\\s*$").containsMatchIn(body)) || length >= 110) close()
    }
    close()
    return lines
  }

  /** `01:02:03,456`, `02:03.456` as milliseconds. */
  private fun msOf(stamp: String): Long {
    var seconds = 0.0
    for (part in stamp.replace(',', '.').split(':')) seconds = seconds * 60 + (part.toDoubleOrNull() ?: 0.0)
    return (seconds * 1000).toLong()
  }

  /** Lines as they are kept. */
  fun keep(lines: List<Pair<Long, String>>): JSONArray {
    val kept = JSONArray()
    for ((at, text) in lines) kept.put(JSONObject().put("s", at).put("t", text))
    return kept
  }

  /** Larger than this, a podcast's chapters or transcript is not one: a page, a file. */
  private const val MOST_TEXT_BYTES = 8 * 1024 * 1024

  /** The text at [address], a podcast's chapters or transcript, fetched over https: see [expo.modules.jukeboxaudio.podcasts.Secure]. */
  fun text(address: String): String {
    val connection = expo.modules.jukeboxaudio.podcasts.Secure.open(address) {
      it.setRequestProperty("User-Agent", "Jukebox (Android podcast reader)")
    }
    try {
      check(connection.responseCode == 200) { "It answered ${connection.responseCode}" }
      return connection.inputStream.use { bounded(it) }
    } finally {
      connection.disconnect()
    }
  }

  /** What [input] holds, as text, as far as [MOST_TEXT_BYTES]: more than that is refused rather than read on. */
  private fun bounded(input: java.io.InputStream): String {
    val out = java.io.ByteArrayOutputStream()
    val buffer = ByteArray(64 * 1024)
    while (true) {
      val read = input.read(buffer)
      if (read < 0) break
      out.write(buffer, 0, read)
      check(out.size() <= MOST_TEXT_BYTES) { "Too large to be text" }
    }
    return out.toByteArray().decodeToString()
  }

  /** The timed text at [address], fetched. */
  fun fetch(address: String): JSONObject {
    val connection = URL(address).openConnection() as HttpURLConnection
    try {
      connection.connectTimeout = 15_000
      connection.readTimeout = 30_000
      check(connection.responseCode == 200) { "Captions answered ${connection.responseCode}" }
      return JSONObject(connection.inputStream.use { bounded(it) })
    } finally {
      connection.disconnect()
    }
  }
}
