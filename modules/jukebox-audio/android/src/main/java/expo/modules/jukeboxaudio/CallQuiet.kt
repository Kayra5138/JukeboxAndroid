package expo.modules.jukeboxaudio

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer

/**
 * Playing under a call, quietly, when it is asked for.
 *
 * The player asks the phone for the sound before it plays, and gives way
 * when something else is given it: that is what has it duck under a spoken
 * direction and stop for another player. A call has the sound for as long
 * as it lasts, so a press of play during one was refused, and nothing said
 * so: the button was pressed and no music came, and the game, whose keys
 * fall by where the song has got to, showed an empty board.
 *
 * Asking is a courtesy and not a lock; a player that does not ask may play.
 * So a press of play while a call is on is taken to mean it. For the length
 * of the call the player does not ask, and plays at a fraction of its
 * loudness, under the voice and not over it. When the call ends it is as
 * loud as it was and asks again, like any other player.
 *
 * Only a press of play does this. Music that was playing when the call
 * began stops for it as it always has; a call is not a thing to talk over
 * unasked.
 *
 * Whose call it is does not matter and cannot be told: the phone's audio
 * mode is one for the whole phone, set by whichever app is on a call, the
 * dialler or any other.
 */
class CallQuiet(private val context: Context, private val player: ExoPlayer) {
  private val audio = context.getSystemService(AudioManager::class.java)
  private val handler = Handler(Looper.getMainLooper())
  private var under = false

  private val modeChanged = AudioManager.OnModeChangedListener { handler.post { settle() } }
  /** For a phone that does not say when its mode changes: asked, while under a call and only then. */
  private val asked = object : Runnable {
    override fun run() {
      settle()
      if (under) handler.postDelayed(this, ASK_MS)
    }
  }

  private fun onCall(): Boolean = when (audio?.mode) {
    AudioManager.MODE_IN_CALL, AudioManager.MODE_IN_COMMUNICATION -> true
    else -> false
  }

  /**
   * Called as play is pressed, before the player is told. On the player's
   * own thread, which is the main one.
   */
  fun pressed() {
    if (under || !onCall()) return
    under = true
    level = UNDER_A_CALL
    player.setAudioAttributes(MUSIC, /* handleAudioFocus = */ false)
    player.volume = UNDER_A_CALL
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      runCatching { audio?.addOnModeChangedListener(context.mainExecutor, modeChanged) }
    } else {
      handler.postDelayed(asked, ASK_MS)
    }
    runCatching {
      Toast.makeText(context, Localised.text(context, R.string.jukebox_under_a_call), Toast.LENGTH_SHORT).show()
    }
  }

  /** Back to how it was, once the call is over. */
  private fun settle() {
    if (!under || onCall()) return
    under = false
    level = 1f
    stopListening()
    player.volume = 1f
    // Asks for the sound again there and then, where it is playing.
    player.setAudioAttributes(MUSIC, /* handleAudioFocus = */ true)
  }

  private fun stopListening() {
    handler.removeCallbacks(asked)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      runCatching { audio?.removeOnModeChangedListener(modeChanged) }
    }
  }

  fun release() {
    under = false
    level = 1f
    stopListening()
  }

  companion object {
    /** How loud, of what it would be, music is under a call. */
    private const val UNDER_A_CALL = 0.3f
    private const val ASK_MS = 2_000L

    val MUSIC: AudioAttributes = AudioAttributes.Builder()
      .setUsage(C.USAGE_MEDIA)
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .build()

    /**
     * How loud anything else that plays the music is to be: the second
     * player a crossfade is made with has a loudness of its own, and would
     * otherwise come in over a call at full.
     */
    @Volatile var level: Float = 1f
      private set
  }
}
