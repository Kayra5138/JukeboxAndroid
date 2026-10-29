package expo.modules.jukeboxaudio.downloads

import android.content.Context
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * The chapters of the tapes fetched from YouTube, as the extractor read
 * them off each video, kept by the file each became: where each begins, in
 * milliseconds, and what it is called. The player lists them and marks them
 * on a tape's bar; the sleep timer can stop at the end of one.
 */
internal object TapeChapters {
  private const val FILE = "jukebox.tapes"
  private const val KEY = "chapters"
  /** No more tapes than this are remembered, the oldest let go first. */
  private const val MOST = 400

  /** The chapters the extractor wrote down beside a download, as `[{s, t}]`; null for none. */
  fun read(file: File): JSONArray? {
    val text = runCatching { file.readText().trim() }.getOrNull() ?: return null
    if (text.isEmpty() || text == "NA" || text == "null") return null
    val read = runCatching { JSONArray(text) }.getOrNull() ?: return null
    val chapters = JSONArray()
    for (at in 0 until read.length()) {
      val chapter = read.optJSONObject(at) ?: continue
      val start = chapter.optDouble("start_time", Double.NaN)
      if (!start.isFinite() || start < 0) continue
      chapters.put(JSONObject().put("s", (start * 1000).toLong()).put("t", chapter.optString("title").trim()))
    }
    // One chapter is no chapters: the whole of it, called what it is called.
    return chapters.takeIf { it.length() > 1 }
  }

  /** Podcasting 2.0's chapters file — `{"chapters": [{"startTime", "title"}]}` — as they are kept; null for none. */
  fun fromPodcast(text: String): JSONArray? {
    val list = runCatching { JSONObject(text).optJSONArray("chapters") }.getOrNull() ?: return null
    val chapters = JSONArray()
    for (at in 0 until list.length()) {
      val chapter = list.optJSONObject(at) ?: continue
      // One marked as not to be listed is a place for a picture, not a chapter.
      if (chapter.has("toc") && !chapter.optBoolean("toc", true)) continue
      val start = chapter.optDouble("startTime", Double.NaN)
      if (!start.isFinite() || start < 0) continue
      chapters.put(JSONObject().put("s", (start * 1000).toLong()).put("t", chapter.optString("title").trim()))
    }
    return chapters.takeIf { it.length() > 1 }
  }

  /**
   * The chapters written into a tape's file itself — an MP3's ID3 chapter
   * frames, which many podcasts carry — as they are kept; null for none.
   * Read by Media3's own extractors, as far as the file's headers. Throws
   * where the file could not be read, which is not the same as none.
   */
  @androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
  fun embedded(context: Context, uri: android.net.Uri): JSONArray? = run {
    androidx.media3.exoplayer.MetadataRetriever.Builder(context, androidx.media3.common.MediaItem.fromUri(uri)).build().use { retriever ->
      val groups = retriever.retrieveTrackGroups().get(10, java.util.concurrent.TimeUnit.SECONDS)
      val found = ArrayList<Pair<Long, String>>()
      for (index in 0 until groups.length) {
        val group = groups.get(index)
        for (track in 0 until group.length) {
          val metadata = group.getFormat(track).metadata ?: continue
          for (entry in 0 until metadata.length()) {
            val frame = metadata.get(entry) as? androidx.media3.extractor.metadata.id3.ChapterFrame ?: continue
            val title = (0 until frame.subFrameCount).asSequence()
              .mapNotNull { frame.getSubFrame(it) as? androidx.media3.extractor.metadata.id3.TextInformationFrame }
              .firstOrNull { it.id == "TIT2" }?.values?.firstOrNull().orEmpty()
            found.add(frame.startTimeMs.toLong() to title.trim())
          }
        }
      }
      val chapters = JSONArray()
      for ((at, title) in found.distinctBy { it.first }.sortedBy { it.first }) chapters.put(JSONObject().put("s", at).put("t", title))
      chapters.takeIf { it.length() > 1 }
    }
  }

  @Synchronized
  fun put(context: Context, trackId: String, chapters: JSONArray) {
    val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val all = runCatching { JSONObject(prefs.getString(KEY, null) ?: "{}") }.getOrDefault(JSONObject())
    all.remove(trackId)
    all.put(trackId, chapters)
    while (all.length() > MOST) all.remove(all.keys().next())
    prefs.edit().putString(KEY, all.toString()).apply()
  }

  /** Whether [trackId]'s chapters have been looked for, found or not. */
  fun known(context: Context, trackId: String): Boolean =
    runCatching { JSONObject(context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null) ?: "{}").has(trackId) }
      .getOrDefault(false)

  /** A tape's chapters taken to its file's new id. */
  @Synchronized
  fun move(context: Context, from: String, to: String) {
    val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val all = runCatching { JSONObject(prefs.getString(KEY, null) ?: "{}") }.getOrNull() ?: return
    val chapters = all.optJSONArray(from) ?: return
    all.remove(from)
    if (!all.has(to)) all.put(to, chapters)
    prefs.edit().putString(KEY, all.toString()).apply()
  }

  fun get(context: Context, trackId: String): List<Map<String, Any>> {
    val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    val list = runCatching { JSONObject(prefs.getString(KEY, null) ?: "{}").optJSONArray(trackId) }.getOrNull() ?: return emptyList()
    return (0 until list.length()).mapNotNull { at ->
      val chapter = list.optJSONObject(at) ?: return@mapNotNull null
      mapOf("startSec" to chapter.optLong("s") / 1000.0, "title" to chapter.optString("t"))
    }
  }
}
