package expo.modules.jukeboxaudio.transitions

import androidx.annotation.OptIn
import androidx.media3.common.FlagSet
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import expo.modules.jukeboxaudio.CallQuiet

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
  private val crossfader: Crossfader,
  private val quiet: CallQuiet,
  /** A press of previous or next on a tape, taken as a jump within it: true where it was one. See [expo.modules.jukeboxaudio.Tapes.jump]. */
  private val tapeJump: (forward: Boolean) -> Boolean = { false },
  /** Whether a tape is playing: its previous and next are always there to press, being jumps, at its first part and its last. */
  private val tapeNow: () -> Boolean = { false },
  /** The chapter of the tape playing, said in place of its artist: see [expo.modules.jukeboxaudio.ChapterLine]. */
  private val chapter: () -> String? = { null },
) : ForwardingPlayer(player) {

  /** Everything listening to this player, for telling of a chapter as of any other change to what is playing. */
  private val listeners = java.util.concurrent.CopyOnWriteArraySet<Player.Listener>()

  override fun addListener(listener: Player.Listener) {
    super.addListener(listener)
    listeners.add(listener)
  }

  override fun removeListener(listener: Player.Listener) {
    super.removeListener(listener)
    listeners.remove(listener)
  }

  /** What is playing, with the chapter of a tape that has one where its artist would be. */
  override fun getMediaMetadata(): MediaMetadata {
    val own = super.getMediaMetadata()
    val now = chapter() ?: return own
    return own.buildUpon().setArtist(now).build()
  }

  /**
   * The chapter has changed: told as a change to what is playing, which is
   * what has the session draw it again. On the player's own thread, as the
   * player's own news is.
   */
  @OptIn(UnstableApi::class)
  fun chapterChanged() {
    val metadata = mediaMetadata
    val events = Player.Events(FlagSet.Builder().add(Player.EVENT_MEDIA_METADATA_CHANGED).build())
    for (listener in listeners) {
      listener.onMediaMetadataChanged(metadata)
      listener.onEvents(this, events)
    }
  }

  override fun getAvailableCommands(): Player.Commands {
    val commands = super.getAvailableCommands()
    if (!tapeNow()) return commands
    return commands.buildUpon().addAll(Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_PREVIOUS).build()
  }

  override fun isCommandAvailable(command: Int): Boolean =
    ((command == Player.COMMAND_SEEK_TO_NEXT || command == Player.COMMAND_SEEK_TO_PREVIOUS) && tapeNow()) ||
      super.isCommandAvailable(command)


  override fun play() {
    woken()
    // A press of play, from wherever: during a call it is taken to mean it.
    quiet.pressed()
    if (crossfader.play()) return
    super.play()
  }

  /**
   * A stopped player made ready again, before it is asked to play.
   *
   * Stopped is not paused. A player that has been stopped -- which is what
   * swiping the notification away does -- keeps its queue and lets go of
   * everything it needs to play it, and play on a player in that state is
   * accepted and does nothing. So the next press of play, from a headset or
   * the car or the widget, lit the button and made no sound. Every one of
   * those presses comes through here, which makes this the one place to put
   * it right.
   */
  private fun woken() {
    if (playbackState == Player.STATE_IDLE && mediaItemCount > 0) prepare()
  }

  override fun pause() {
    // Taken over means the player is still running, fading down, and will be
    // paused when it gets there. Pausing now would cut the fade off.
    if (crossfader.pause()) return
    super.pause()
  }

  override fun setPlayWhenReady(playWhenReady: Boolean) {
    if (playWhenReady) {
      woken()
      quiet.pressed()
      if (crossfader.play()) return
    } else if (crossfader.pause()) {
      return
    }
    super.setPlayWhenReady(playWhenReady)
  }

  override fun seekToNext() {
    if (tapeJump(true)) return
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
    if (tapeJump(false)) return
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
