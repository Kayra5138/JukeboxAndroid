package expo.modules.jukeboxaudio.widget

import android.content.Context
import android.content.Intent
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * What the widgets ask of the playback service beyond the keys of a headset.
 *
 * Play, pause and skipping go to the service as media button presses, which
 * Media3 already knows how to take (see `JukeboxWidget.send`). Shuffling the
 * queue, changing the repeat mode, jumping to a song further down and starting
 * a shuffle of the library have no key, so they are sent as intents of the
 * service's own, by the same road and for the same reason: a broadcast
 * receiver has no time to bind a controller and wait for it.
 */
object WidgetCommands {
  /** Shuffles the queue as the player's own button does, keeping the song that is playing. */
  const val SHUFFLE_QUEUE = "expo.modules.jukeboxaudio.widget.command.SHUFFLE_QUEUE"

  /** Sets the repeat mode to [EXTRA_MODE]: the mode the button showed it would move to. */
  const val REPEAT = "expo.modules.jukeboxaudio.widget.command.REPEAT"

  /** Plays the song at [EXTRA_INDEX], if it is still the one called [EXTRA_ID]. */
  const val JUMP = "expo.modules.jukeboxaudio.widget.command.JUMP"

  /** Replaces the queue with what the car's shelf [EXTRA_SHELF] would play, and plays it. */
  const val SHELF = "expo.modules.jukeboxaudio.widget.command.SHELF"

  const val EXTRA_MODE = "mode"
  const val EXTRA_INDEX = "index"
  const val EXTRA_ID = "id"
  const val EXTRA_SHELF = "shelf"

  val ALL = setOf(SHUFFLE_QUEUE, REPEAT, JUMP, SHELF)

  /**
   * A word only this install knows, carried by every press of a widget and
   * every command the widget sends on.
   *
   * The widget's receiver is exported, as a launcher has to reach it, and
   * the service is, as a car has to: so any app on the phone could send
   * either one of these and replace the queue with whatever it named. The
   * word is made the first time it is wanted, kept in the app's own
   * preferences, and is in nothing another app can read.
   */
  private const val EXTRA_SECRET = "expo.modules.jukeboxaudio.widget.secret"
  private const val PREFERENCES = "jukebox_widget"
  private const val SECRET_KEY = "secret"
  @Volatile private var secret: String? = null

  private fun secretOf(context: Context): String {
    secret?.let { return it }
    synchronized(this) {
      secret?.let { return it }
      val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      val kept = preferences.getString(SECRET_KEY, null) ?: ByteArray(24).also { SecureRandom().nextBytes(it) }
        .joinToString("") { "%02x".format(it) }
        .also { preferences.edit().putString(SECRET_KEY, it).apply() }
      secret = kept
      return kept
    }
  }

  /** [intent] with the word on it. */
  fun signed(context: Context, intent: Intent): Intent = intent.putExtra(EXTRA_SECRET, secretOf(context))

  /** Whether [intent] carries the word: sent by this app's own widget, and by nothing else. */
  fun isOurs(context: Context, intent: Intent): Boolean = carries(intent.getStringExtra(EXTRA_SECRET), secretOf(context))

  /** Whether [given] is the [kept] word: compared whole, so that how long the answer took says nothing of how near a guess came. */
  internal fun carries(given: String?, kept: String): Boolean =
    given != null && kept.isNotEmpty() && MessageDigest.isEqual(given.toByteArray(), kept.toByteArray())

  /**
   * Where in a queue of [count] songs, the song at each place [idAt], a press
   * of the row for [id] drawn at [asked] goes: there while it still holds
   * that song; else wherever the song is now, the queue having changed since
   * the row was drawn; and nowhere once it is gone, rather than to whatever
   * took its place.
   */
  internal fun jumpTo(asked: Int, id: String, count: Int, idAt: (Int) -> String?): Int? =
    if (asked in 0 until count && idAt(asked) == id) asked else (0 until count).firstOrNull { idAt(it) == id }
}
