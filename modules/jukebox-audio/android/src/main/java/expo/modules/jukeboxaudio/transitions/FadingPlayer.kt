package expo.modules.jukeboxaudio.transitions

import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.Player

/**
 * The player as everything else sees it, with the transitions folded in.
 *
 * Commands reach the player from more places than the app: the notification,
 * the home screen widget, a steering wheel button, a headset, the car. All of
 * them arrive through the media session, so wrapping the player is the one
 * place that catches every one of them — and the app's own controls come the
 * same way, so nothing needs a second path for them.
 *
 * Each override asks the crossfader whether it wants the command. Where it does
 * not, the player gets it unchanged, which is what keeps the transitions a
 * thing that can be switched off rather than a thing playback now depends on.
 */
class FadingPlayer(
  player: Player,
  private val crossfader: Crossfader
) : ForwardingPlayer(player) {

  override fun play() {
    if (crossfader.play()) return
    super.play()
  }

  override fun pause() {
    // Taken over means the player is still running, fading down, and will be
    // paused when it gets there. Pausing now would cut the fade off.
    if (crossfader.pause()) return
    super.pause()
  }

  override fun setPlayWhenReady(playWhenReady: Boolean) {
    if (playWhenReady) {
      if (crossfader.play()) return
    } else if (crossfader.pause()) {
      return
    }
    super.setPlayWhenReady(playWhenReady)
  }

  override fun seekToNext() {
    if (crossfader.skip(toNext = true)) return
    super.seekToNext()
  }

  override fun seekToNextMediaItem() {
    if (crossfader.skip(toNext = true)) return
    super.seekToNextMediaItem()
  }

  /**
   * Previous is a button with two jobs — back to the start of this track, or
   * back to the one before — and the player decides which by where it is. The
   * crossfader is only asked about it when the player would actually change
   * track, since fading a track into its own beginning is not a transition
   * anybody asked for.
   */
  override fun seekToPrevious() {
    if (atStartOfTrack() && crossfader.skip(toNext = false)) return
    super.seekToPrevious()
    // Whichever of the two it did, it has landed somewhere new and wants the
    // same softening as any other seek.
    crossfader.afterSeek()
  }

  override fun seekToPreviousMediaItem() {
    if (crossfader.skip(toNext = false)) return
    super.seekToPreviousMediaItem()
  }

  override fun seekTo(positionMs: Long) {
    super.seekTo(positionMs)
    crossfader.afterSeek()
  }

  override fun seekTo(mediaItemIndex: Int, positionMs: Long) {
    // Choosing a track out of the queue, which is a jump rather than a
    // transition: the crossfader is told so it can drop anything it had
    // planned, and the new track begins the ordinary way.
    crossfader.abort()
    super.seekTo(mediaItemIndex, positionMs)
    crossfader.afterSeek()
  }

  override fun stop() {
    crossfader.abort()
    super.stop()
  }

  /**
   * Whether pressing previous would leave this track rather than restart it.
   *
   * Media3 restarts the current track when it is more than a few seconds in;
   * the threshold is the player's own, so it is read from there rather than
   * guessed at.
   */
  private fun atStartOfTrack(): Boolean =
    currentPosition <= maxSeekToPreviousPosition
}
