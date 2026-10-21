package expo.modules.jukeboxaudio.widget

import android.content.Context
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the home screen widget draws, kept where it can be read without the app.
 *
 * A widget is rendered by the launcher, in the launcher's process, at moments
 * this app has no say over — after a reboot, after being killed for memory, the
 * first time it is placed. There is no player to ask at those moments, so the
 * last known state is written down as it changes and read back from disk.
 */
data class NowPlaying(
  val trackId: String?,
  val title: String?,
  val artist: String?,
  val playing: Boolean,
  /** Absolute path of a cover already decoded to a file, when there is one. */
  val artworkPath: String?,
  /**
   * True while a service exists to receive transport commands.
   *
   * Without it the widget would happily send play to a service that is not
   * running and has no queue to resume, and nothing would happen.
   */
  val live: Boolean,
  val positionMs: Long = 0,
  val durationMs: Long = 0,
  /**
   * The player's repeat mode, in Media3's numbers.
   *
   * Kept across a restart of the phone, unlike [playing], because it is a
   * choice somebody made rather than something happening: the service puts
   * it back when it brings the saved queue back (see `restoreQueueIfEmpty`).
   */
  val repeatMode: Int = 0,
  /** The next few songs, for the large widget to list; see [Upcoming]. */
  val upcoming: List<Upcoming> = emptyList()
) {
  /**
   * A song further down the queue, as the large widget lists it.
   *
   * The index is where it stands in the queue now, and the id goes with it so
   * that a tap on a row drawn before the queue changed cannot start some other
   * song that has since moved into its place.
   */
  data class Upcoming(val index: Int, val id: String, val title: String?, val artist: String?)

  companion object {
    private const val STORE = "jukebox_widget"
    private const val TRACK_ID = "trackId"
    private const val TITLE = "title"
    private const val ARTIST = "artist"
    private const val PLAYING = "playing"
    private const val ARTWORK = "artwork"
    private const val LIVE = "live"
    private const val WRITTEN_AT = "writtenAtElapsed"
    private const val BOOTED_AT = "bootedAt"
    private const val REPEAT = "repeatMode"
    private const val UPCOMING = "upcoming"

    /** The computed boot moment drifts by a few milliseconds between reads. */
    private const val BOOT_SLACK_MS = 5_000L

    val EMPTY = NowPlaying(null, null, null, false, null, false)

    private fun store(context: Context) =
      context.applicationContext.getSharedPreferences(STORE, Context.MODE_PRIVATE)

    fun read(context: Context): NowPlaying {
      val saved = store(context)
      if (!saved.contains(WRITTEN_AT)) return EMPTY

      /*
        elapsedRealtime counts from boot, so a stamp in the future can only mean
        it was written before the phone restarted. Everything the flag below
        claims is then about a process that no longer exists, and the widget has
        to fall back to opening the app rather than talking to nothing.
      */
      /*
        The boot is identified by when it happened, not by how long ago the
        stamp was taken.

        Comparing the stamp against the current uptime looked like it worked:
        after a restart the uptime is near zero and any older stamp is in the
        future, so it reads as stale. But the uptime keeps climbing, and once it
        passes the old figure the same test says the stamp belongs to this boot
        again — so a widget redrawn a few minutes after a restart showed the
        pause icon for a service that had never started.
      */
      val bootedAt = System.currentTimeMillis() - SystemClock.elapsedRealtime()
      val sameBoot = kotlin.math.abs(saved.getLong(BOOTED_AT, 0L) - bootedAt) < BOOT_SLACK_MS

      return NowPlaying(
        trackId = saved.getString(TRACK_ID, null),
        title = saved.getString(TITLE, null),
        artist = saved.getString(ARTIST, null),
        playing = sameBoot && saved.getBoolean(PLAYING, false),
        artworkPath = saved.getString(ARTWORK, null),
        live = sameBoot && saved.getBoolean(LIVE, false),
        positionMs = saved.getLong("positionMs", 0),
        durationMs = saved.getLong("durationMs", 0),
        repeatMode = saved.getInt(REPEAT, 0),
        upcoming = upcomingFrom(saved.getString(UPCOMING, null))
      )
    }

    /**
     * The repeat mode alone, from a file that has no state in it yet as well.
     *
     * [read] answers [EMPTY] until something has been written, and the mode is
     * the one thing worth having even then.
     */
    fun repeatMode(context: Context): Int = store(context).getInt(REPEAT, 0)

    private fun upcomingFrom(body: String?): List<Upcoming> = runCatching {
      if (body.isNullOrEmpty()) return emptyList()
      val array = JSONArray(body)
      (0 until array.length()).mapNotNull { at ->
        val row = array.optJSONObject(at) ?: return@mapNotNull null
        val id = row.optString("id").takeIf { it.isNotEmpty() } ?: return@mapNotNull null
        Upcoming(
          index = row.optInt("index", -1).takeIf { it >= 0 } ?: return@mapNotNull null,
          id = id,
          title = row.optString("title").takeIf { row.has("title") && it.isNotBlank() },
          artist = row.optString("artist").takeIf { row.has("artist") && it.isNotBlank() }
        )
      }
    }.getOrDefault(emptyList())

    private fun upcomingTo(rows: List<Upcoming>): String = JSONArray().apply {
      rows.forEach { row ->
        put(JSONObject().put("index", row.index).put("id", row.id).put("title", row.title).put("artist", row.artist))
      }
    }.toString()

    fun write(context: Context, state: NowPlaying) {
      store(context).edit()
        .putString(TRACK_ID, state.trackId)
        .putString(TITLE, state.title)
        .putString(ARTIST, state.artist)
        .putBoolean(PLAYING, state.playing)
        .putString(ARTWORK, state.artworkPath)
        .putBoolean(LIVE, state.live)
        .putLong("positionMs", state.positionMs)
        .putLong("durationMs", state.durationMs)
        .putInt(REPEAT, state.repeatMode)
        .putString(UPCOMING, upcomingTo(state.upcoming))
        .putLong(WRITTEN_AT, SystemClock.elapsedRealtime())
        .putLong(BOOTED_AT, System.currentTimeMillis() - SystemClock.elapsedRealtime())
        .apply()
    }

    /** Records that nothing is listening any more, keeping what was playing. */
    fun markStopped(context: Context) {
      write(context, read(context).copy(playing = false, live = false))
    }
  }
}
