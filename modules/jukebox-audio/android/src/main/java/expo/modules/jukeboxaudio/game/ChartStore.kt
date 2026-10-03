package expo.modules.jukeboxaudio.game

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Charts, made once and kept.
 *
 * Making one means decoding a whole song and looking at every window of it,
 * which takes seconds rather than milliseconds. Doing that each time somebody
 * presses play would be unbearable, and doing it while the music is already
 * playing would be worse — the analysis would be competing with playback for
 * the processor it is trying not to interrupt.
 *
 * Kept under the cache directory rather than with the library, because a chart
 * can always be made again from the song, and a phone short of room should be
 * allowed to take it back.
 */
internal object ChartStore {
  /**
   * What the chart maker is asked for, and what it gives back.
   *
   * The whole of it: nothing here is per-difficulty, because difficulty is how
   * fast the tiles fall and how exactly a tap has to land rather than which
   * notes exist.
   */
  fun chart(context: Context, trackId: String): Chart? {
    read(context, trackId)?.let { return it }

    /*
      Timed, because "it takes a few seconds" is not a figure anybody can
      improve against. The two halves are charged separately: decoding is the
      platform's and can only be avoided, while the analysis is ours and can be
      made faster. Which of them dominates decides whether there is any point
      optimising the second.
    */
    val startedAt = android.os.SystemClock.elapsedRealtime()
    val song = Decode.song(context, trackId) ?: return null
    val decodedAt = android.os.SystemClock.elapsedRealtime()
    val found = Onsets.find(song.samples, song.rate)
    val analysedAt = android.os.SystemClock.elapsedRealtime()
    android.util.Log.i(
      "JukeboxChart",
      "chart for $trackId: decode ${decodedAt - startedAt}ms by ${song.by}, " +
        "analyse ${analysedAt - decodedAt}ms, " +
        "${song.samples.size} samples at ${song.rate}Hz, ${found.notes.size} notes, " +
        "step ${found.stepMs}ms, ${found.lines.size} lines, bar ${found.barSteps} from ${found.barAt}, " +
        "${found.quiet.size} pauses " +
        found.quiet.joinToString(prefix = "[", postfix = "]") { "${it.startMs}-${it.endMs}" }
    )
    val chart = Chart(
      version = Chart.VERSION,
      durationMs = song.durationMs,
      stepMs = found.stepMs,
      notes = found.notes,
      quiet = found.quiet,
      levelMs = if (found.levels.isEmpty()) 0 else found.levelMs,
      levels = found.levels,
      lines = found.lines,
      barSteps = found.barSteps,
      barAt = found.barAt,
      lanes = found.lanes,
      accents = found.accents,
      ease = found.ease
    )
    write(context, trackId, chart)
    return chart
  }

  /** Whether one is already made, which is the difference between instant and seconds. */
  fun ready(context: Context, trackId: String): Boolean = file(context, trackId).isFile

  private fun file(context: Context, trackId: String) =
    File(File(context.cacheDir, "charts"), "$trackId-v${Chart.VERSION}.json")

  private fun read(context: Context, trackId: String): Chart? {
    val target = file(context, trackId)
    if (!target.isFile) return null
    return runCatching {
      val json = JSONObject(target.readText())
      val notes = json.getJSONArray("notes")
      // Optional, so a file written before pauses were looked for still reads
      // -- as a song without any -- rather than as no chart at all.
      val quiet = json.optJSONArray("quiet") ?: JSONArray()
      val levels = json.optJSONArray("levels") ?: JSONArray()
      val lines = json.optJSONArray("lines") ?: JSONArray()
      Chart(
        version = json.getInt("version"),
        durationMs = json.getLong("durationMs"),
        stepMs = json.optInt("stepMs", 0),
        notes = (0 until notes.length()).map { index ->
          val note = notes.getJSONObject(index)
          Chart.Note(note.getInt("atMs"), note.getInt("lane"), note.optInt("holdMs", 0))
        },
        quiet = (0 until quiet.length()).map { index ->
          val span = quiet.getJSONArray(index)
          Chart.Span(span.getInt(0), span.getInt(1))
        },
        levelMs = json.optInt("levelMs", 0),
        levels = (0 until levels.length()).map { levels.getInt(it) },
        lines = (0 until lines.length()).map { lines.getInt(it) },
        barSteps = json.optInt("barSteps", 0),
        barAt = json.optInt("barAt", 0),
        lanes = json.optString("lanes", ""),
        accents = json.optString("accents", ""),
        ease = json.optString("ease", "")
      )
    }.getOrNull()
  }

  private fun write(context: Context, trackId: String, chart: Chart) {
    val target = file(context, trackId)
    target.parentFile?.mkdirs()

    val notes = JSONArray()
    for (note in chart.notes) {
      notes.put(
        JSONObject()
          .put("atMs", note.atMs)
          .put("lane", note.lane)
          .put("holdMs", note.holdMs)
      )
    }
    val quiet = JSONArray()
    for (span in chart.quiet) quiet.put(JSONArray().put(span.startMs).put(span.endMs))
    val json = JSONObject()
      .put("version", chart.version)
      .put("durationMs", chart.durationMs)
      .put("stepMs", chart.stepMs)
      .put("notes", notes)
      .put("quiet", quiet)
      .put("levelMs", chart.levelMs)
      .put("levels", JSONArray(chart.levels))
      .put("lines", JSONArray(chart.lines))
      .put("barSteps", chart.barSteps)
      .put("barAt", chart.barAt)
      .put("lanes", chart.lanes)
      .put("accents", chart.accents)
      .put("ease", chart.ease)

    // Written aside and renamed. A chart half-written when the phone is killed
    // would be found by the next reader, parsed, and quietly played as a song
    // that stops halfway through.
    runCatching {
      val part = File.createTempFile("chart-", ".part", target.parentFile)
      part.writeText(json.toString())
      if (!part.renameTo(target)) part.delete()
    }
  }

  /** What crosses to JavaScript. */
  fun asMap(chart: Chart): Map<String, Any?> = mapOf(
    "version" to chart.version,
    "durationMs" to chart.durationMs,
    "stepMs" to chart.stepMs,
    "notes" to chart.notes.map {
      mapOf("atMs" to it.atMs, "lane" to it.lane, "holdMs" to it.holdMs)
    },
    "quiet" to chart.quiet.map { listOf(it.startMs, it.endMs) },
    "levelMs" to chart.levelMs,
    "levels" to chart.levels,
    "lines" to chart.lines,
    "barSteps" to chart.barSteps,
    "barAt" to chart.barAt,
    "lanes" to chart.lanes,
    "accents" to chart.accents,
    "ease" to chart.ease
  )
}
