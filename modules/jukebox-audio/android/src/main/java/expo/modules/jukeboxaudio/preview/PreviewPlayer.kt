package expo.modules.jukeboxaudio.preview

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource

/**
 * Thirty seconds of a song, played while the song itself is being fetched.
 *
 * A player of its own and not the app's player, on purpose, and nearly
 * everything about it follows from that. The app's player is a queue with a
 * history: what it plays is written down as listened to, sent to whoever is
 * told what is listened to, shown on the lock screen and in the car, kept to
 * be gone back to. A preview is none of those things. It is the sound of a
 * song arriving, and when the song has arrived it is over. So it is played
 * here, by something that knows of no queue and tells nobody.
 *
 * It has no notification and no service, which means it lives only as long
 * as the app is in front; JavaScript stops it when the app is not.
 *
 * It does take the sound properly. Starting one asks the system for the
 * speaker the way any player does, which is what pauses the app's own
 * player if that was playing — and the other way round: when the app's
 * player starts, or a call comes, or the headphones are pulled out, this
 * loses the speaker and does not wait to get it back. It stops, and says so.
 * Nothing resumes a preview.
 *
 * One at a time. Starting another is stopping the one there was.
 */
@OptIn(UnstableApi::class)
object PreviewPlayer {
  private val main = Handler(Looper.getMainLooper())
  private var player: ExoPlayer? = null
  private var playing: String? = null

  /**
   * Told what became of a preview, with whose it was: `playing` once sound
   * is coming out, `ended` when it ran its length, `failed` when it could
   * not be played, `stopped` when the speaker was taken from it.
   */
  @Volatile var told: ((Map<String, Any?>) -> Unit)? = null

  private fun say(id: String, state: String) {
    runCatching { told?.invoke(mapOf("id" to id, "state" to state)) }
  }

  /** Plays the preview at [address] for the song [id]. Answers false for an address that is not one previews are played from. */
  fun start(context: Context, id: String, address: String): Boolean {
    val url = PreviewSource.checked(address) ?: return false
    val app = context.applicationContext
    main.post {
      release()
      val made = ExoPlayer.Builder(app)
        .setMediaSourceFactory(ProgressiveMediaSource.Factory(PreviewDataSource.Factory()))
        .setAudioAttributes(
          AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),
          /* handleAudioFocus = */ true)
        .setHandleAudioBecomingNoisy(true)
        .build()
      player = made
      playing = id
      made.addListener(object : Player.Listener {
        private var said = false
        override fun onIsPlayingChanged(isPlaying: Boolean) {
          if (isPlaying && !said && playing == id) { said = true; say(id, "playing") }
        }
        override fun onPlaybackStateChanged(state: Int) {
          if (state == Player.STATE_ENDED && playing == id) { release(); say(id, "ended") }
        }
        override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
          // The speaker was taken, for a moment or for good, or the headphones came out. Either way it is over.
          if (!playWhenReady && playing == id) { release(); say(id, "stopped") }
        }
        override fun onPlayerError(error: PlaybackException) {
          if (playing == id) { release(); say(id, "failed") }
        }
      })
      made.setMediaItem(MediaItem.fromUri(url.toString()))
      made.prepare()
      made.play()
    }
    return true
  }

  /** Stops whatever preview there is. Says nothing: whoever asked knows. */
  fun stop() {
    main.post { release() }
  }

  private fun release() {
    playing = null
    player?.let { runCatching { it.release() } }
    player = null
  }
}
