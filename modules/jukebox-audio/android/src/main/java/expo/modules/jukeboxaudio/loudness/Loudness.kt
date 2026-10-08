package expo.modules.jukeboxaudio.loudness

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.File

/**
 * Whether tracks are evened out, and by how much each one is right now.
 *
 * Two things, both of them read from more than one place. The setting is the
 * user's and is written down, so that a service brought up by a widget press,
 * with no JavaScript in the process, plays the way it was left. The levels
 * are worked out by the service as the queue moves and are read by the audio
 * threads -- threads, because the crossfade runs a second player.
 */
object Loudness {
  private const val FILE = "loudness.json"

  /**
   * Off until asked for. It changes how every record sounds next to the one
   * before it, and it spends battery measuring files the first time they come
   * up; neither is something to do to somebody who did not ask.
   */
  data class Settings(val enabled: Boolean = false)

  /** How much one track is being turned up or down. */
  class Applied(
    /** What its samples are multiplied by. */
    val gain: Float,
    /**
     * Whether this figure arrived after the track had started.
     *
     * A file is measured the first time it is met, and if it is met by being
     * played then the answer turns up some seconds into it. Applied at once
     * that would be the song lurching to a new level mid-phrase; a change
     * marked this way is eased in over a few seconds instead, slowly enough
     * to pass for the listener's own ear settling.
     */
    val late: Boolean = false
  )

  /**
   * Every gain in force, for every player at once.
   *
   * By track and not one figure for "what is playing", because during a
   * crossfade two things are: the tail of one track in one player and the
   * head of the next in another, each owed its own gain at the same moment.
   * Each player's processor knows which track its samples belong to (see
   * [PlayingStream]) and looks itself up. That also puts the change of gain
   * between two tracks that run together exactly on the join, where it is
   * decided by which samples are which rather than by when a message
   * happened to arrive.
   *
   * One immutable object behind a volatile reference, as the effects are:
   * the audio thread takes no lock, and whichever set it sees it sees whole.
   */
  class Levels(
    /** The track the main player is on, for a stream that could not be named. */
    val current: String?,
    val byId: Map<String, Applied>
  ) {
    fun of(id: String?): Applied = byId[id ?: current] ?: UNITY
  }

  val UNITY = Applied(1f)
  private val NONE = Levels(null, emptyMap())

  @Volatile private var levels = NONE

  /** Asked by the audio thread, once a buffer. */
  fun level(id: String?): Applied = levels.of(id)

  /** The service's to set; null for "leave everything alone". */
  fun publish(next: Levels?) {
    levels = next ?: NONE
  }

  // ---- the setting ----

  @Volatile private var cached: Settings? = null

  fun read(context: Context): Settings {
    cached?.let { return it }
    val loaded = runCatching {
      val target = File(context.filesDir, FILE)
      if (!target.isFile) Settings()
      else Settings(enabled = JSONObject(target.readText()).optBoolean("enabled", false))
    }.getOrDefault(Settings())
    cached = loaded
    return loaded
  }

  fun write(context: Context, settings: Settings) {
    cached = settings
    runCatching {
      // Through a temporary file, so a write cut short leaves the setting
      // that was there rather than half a file that reads as the default.
      val target = File(context.filesDir, FILE)
      val temporary = File(target.parentFile, "$FILE.part")
      temporary.writeText(JSONObject().put("enabled", settings.enabled).toString())
      if (!temporary.renameTo(target)) temporary.delete()
    }
  }

  fun toMap(settings: Settings): Map<String, Any?> = mapOf("enabled" to settings.enabled)

  fun fromMap(values: Map<String, Any?>): Settings =
    Settings(enabled = values["enabled"] as? Boolean ?: false)

  // ---- the running service ----

  /**
   * The normaliser belonging to the running service, when there is one.
   *
   * The same arrangement as the crossfader's: the module and the service
   * share a process, so this is a plain reference. Null whenever playback is
   * not up, and a setting changed then is read off the disk by whichever
   * service starts next.
   */
  @Volatile private var live: Normaliser? = null

  fun register(normaliser: Normaliser?) {
    live = normaliser
  }

  /** Tells the running service the setting has changed, on the thread it lives on. */
  fun changed() {
    val normaliser = live ?: return
    Handler(Looper.getMainLooper()).post { normaliser.settingsChanged() }
  }
}
