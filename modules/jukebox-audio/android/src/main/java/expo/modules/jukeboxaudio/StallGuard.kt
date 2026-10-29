package expo.modules.jukeboxaudio

import android.os.Handler
import android.os.SystemClock
import android.util.Log
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.jukeboxaudio.transitions.Crossfader

/**
 * Sets the player going again when it says it is playing and is not.
 *
 * It happens when the phone has frozen the app while it was paused for
 * another app's sound, and lets it go again later: the decoder and the audio
 * track it had are no longer what they were, and the player goes on saying
 * it is playing while the clock it reads from the sound stands still or
 * jumps back. Left to itself it notices after ten seconds or so; somebody
 * looking at it hears nothing and sees the bar run forward and back.
 *
 * So while the player says it is playing, how far it has got is looked at
 * once a second, and if in [STUCK_MS] it has not got a fair part of that
 * far, it is sent to the place it is at, which builds what plays the sound
 * anew from there. Not while the next track is being mixed in, when another
 * clock is in charge; and not twice for the same stall in quick succession.
 */
internal class StallGuard(
  private val player: ExoPlayer,
  private val transitions: Crossfader,
) : Player.Listener {
  private val handler = Handler(player.applicationLooper)
  /** Where the player was, and when, at the start of the stretch being watched. */
  private var fromPosition = 0L
  private var fromAt = 0L
  private var lastRecovery = 0L

  private val look = object : Runnable {
    override fun run() {
      check()
      if (player.isPlaying) handler.postDelayed(this, LOOK_EVERY_MS)
    }
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    handler.removeCallbacks(look)
    restart()
    if (isPlaying) handler.postDelayed(look, LOOK_EVERY_MS)
  }

  override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) = restart()

  override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) = restart()

  private fun restart() {
    fromPosition = player.currentPosition
    fromAt = SystemClock.elapsedRealtime()
  }

  private fun check() {
    if (!player.isPlaying || transitions.mixing) return restart()
    val now = SystemClock.elapsedRealtime()
    val speed = player.playbackParameters.speed.coerceAtLeast(0.1f)
    val gone = now - fromAt
    val got = player.currentPosition - fromPosition
    when (verdict(gone, got, speed, now - lastRecovery)) {
      // Moving as it should, near enough: watched afresh from here.
      Verdict.MOVING -> return restart()
      Verdict.WAIT -> return
      Verdict.STUCK -> Unit
    }
    lastRecovery = now
    val at = player.currentPosition.coerceAtLeast(0)
    Log.w("JukeboxPlayback", "Playing but standing still for ${gone}ms at ${at}ms; starting the sound again from there")
    player.seekTo(player.currentMediaItemIndex, at)
    restart()
  }

  fun release() = handler.removeCallbacks(look)

  enum class Verdict { MOVING, WAIT, STUCK }

  companion object {
    /**
     * What [gone] milliseconds in which the position moved [got] at [speed]
     * come to, [sinceLast] after the last time the sound was started again:
     * moving, if it moved a fair share of that; stuck, if it did not for
     * [STUCK_MS] and the last start is not too recent to try again; and
     * otherwise, wait and see.
     */
    fun verdict(gone: Long, got: Long, speed: Float, sinceLast: Long): Verdict = when {
      got >= gone * speed * MOVING_SHARE -> Verdict.MOVING
      gone < STUCK_MS || sinceLast < AGAIN_AFTER_MS -> Verdict.WAIT
      else -> Verdict.STUCK
    }

    const val LOOK_EVERY_MS = 1_000L
    const val STUCK_MS = 2_000L
    /** How much of the time gone by the position has to have moved to count as moving. */
    const val MOVING_SHARE = 0.4f
    const val AGAIN_AFTER_MS = 6_000L
  }
}
