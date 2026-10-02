package expo.modules.jukeboxaudio.transitions

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.PlayerMessage

/**
 * Overlapping the end of one track with the start of the next.
 *
 * Media3 has no crossfade and cannot have one from a single player: one player
 * is one decoder, and an overlap needs two. The usual answer is two players
 * taking turns, with the queue, the notification and the media session sitting
 * on top of whichever is currently in front — a rewrite of everything, and a
 * new way for playback to break every time one hands over to the other.
 *
 * This does it the other way round, and the difference is the whole design.
 * The real player never stops being the real player: at the crossfade point it
 * simply moves to the next track early, and a **second, throwaway player picks
 * up the tail of the old one** and fades it out underneath. That player has no
 * queue, is not in the session, is never seen by the notification or the
 * widget, and is released a few seconds later.
 *
 * So the only seek into the middle of a track lands on the track that is
 * already on its way out — the one place a splice cannot be heard — and
 * everything that makes playback work carries on undisturbed.
 *
 * Everything here runs on the main thread, which is the one the player belongs
 * to. The position-accurate triggers arrive on the playback thread and are
 * posted across.
 */
@OptIn(UnstableApi::class)
class Crossfader(
  private val context: Context,
  private val main: ExoPlayer,
  private val mainFade: FadeGainProvider,
  /** The session the equalizer is on, so the tail is coloured the same way. */
  private val audioSessionId: Int
) : Player.Listener {
  /** Long enough for a local file to open and seek; short enough not to be felt. */
  private val READY_WAIT_MS = 300L

  /** A ramp this short hides a seek that landed a few milliseconds out. */
  private val SPLICE_MS = 40L

  /** Slack before the tail is let go, so its last samples are not cut off. */
  private val TAIL_SLACK_MS = 400L

  private val handler = Handler(Looper.getMainLooper())

  var settings: TransitionSettings = TransitionSettings()
    set(value) {
      field = value
      reschedule()
    }

  private var prepareMessage: PlayerMessage? = null
  private var swapMessage: PlayerMessage? = null

  private var tail: ExoPlayer? = null
  private var tailFade: FadeGainProvider? = null

  /**
   * Whether the tail has to be put back in step before it starts.
   *
   * An automatic handover needs no such thing: the second player is parked at
   * the exact position the trigger fires at, so the two agree by construction.
   * A pressed button has no such luxury — the tail is opened at wherever the
   * track happens to be and then takes a moment to become ready, during which
   * the real player carries on. Starting it where it was opened would replay
   * the intervening audio, which at a fade of a few hundred milliseconds means
   * the whole fade is a stutter of what was just heard.
   */
  private var resyncTail = false

  /** Set while a handover is being set up, so a second one cannot start. */
  private var handingOver = false

  /**
   * Counts handovers, so a callback can tell whether it is still wanted.
   *
   * A manual skip waits for the second player to be ready, and that wait can
   * outlive the thing it was waiting for — the listener presses next again, or
   * pauses, or picks something else out of the queue. Without this the stale
   * wait would come back and skip a track nobody asked to skip.
   */
  private var token = 0L

  // ---- the automatic handover ----

  /**
   * Works out whether this track hands over, and books the two moments it
   * needs: one to get the second player ready, one to make the swap.
   *
   * Called on anything that can change the answer — a new track, a seek, a
   * change of repeat mode, a change of settings.
   */
  fun reschedule() {
    cancelPending()
    if (handingOver) return

    val duration = main.duration
    val start = crossfadeStartMs(
      settings = settings,
      durationMs = if (duration == C.TIME_UNSET) 0 else duration,
      hasNext = main.hasNextMediaItem(),
      albumOfCurrent = main.currentMediaItem?.mediaMetadata?.albumTitle?.toString(),
      albumOfNext = nextItem()?.mediaMetadata?.albumTitle?.toString()
    ) ?: return

    // Already past it — a seek into the last few seconds, say. Handing over
    // from here would mean a fade that starts halfway through itself, so this
    // track simply ends the ordinary way.
    if (main.currentPosition >= start - 200) return

    val index = main.currentMediaItemIndex
    prepareMessage = post(index, (start - TransitionSettings.PREPARE_MS).coerceAtLeast(0)) {
      openTail(settings.autoMs)
    }
    swapMessage = post(index, start) { handOver(Direction.NEXT, settings.autoMs, automatic = true) }
  }

  private fun post(index: Int, positionMs: Long, action: () -> Unit): PlayerMessage =
    main.createMessage { _, _ -> handler.post(action) }
      .setPosition(index, positionMs)
      .setDeleteAfterDelivery(true)
      .send()

  private fun cancelPending() {
    runCatching { prepareMessage?.cancel() }
    runCatching { swapMessage?.cancel() }
    prepareMessage = null
    swapMessage = null
  }

  private fun nextItem(): MediaItem? {
    val index = main.nextMediaItemIndex
    return if (index == C.INDEX_UNSET) null else main.getMediaItemAt(index)
  }

  // ---- the tail player ----

  /**
   * Opens a second player on the current track, parked where the fade begins.
   *
   * Parked rather than playing: opening, preparing and seeking cost real time,
   * and doing it at the moment of the crossfade would leave a hole exactly
   * where the crossfade was meant to be.
   */
  private fun openTail(fadeMs: Long, fromMs: Long = -1) {
    releaseTail()

    val item = main.currentMediaItem ?: return
    val at = if (fromMs >= 0) fromMs else (main.duration - fadeMs).coerceAtLeast(0)

    val fade = FadeGainProvider()
    val player = runCatching {
      ExoPlayer.Builder(context, FadingRenderersFactory(context, fade))
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build(),
          /*
            Emphatically not. The main player holds the audio focus for this
            app, and a second one asking for it would either be refused or
            take it away from the player that is still using it.
          */
          /* handleAudioFocus = */ false
        )
        .build()
    }.getOrNull() ?: return

    // The same session as the main player, so the equalizer is on the outgoing
    // track too. A crossfade where one side is equalized and the other is not
    // would be heard as the tone shifting across the join.
    runCatching { player.audioSessionId = audioSessionId }

    fade.fadeOut(fadeMs, settings.equalPower, leadInMs = SPLICE_MS)
    player.playWhenReady = false
    player.setMediaItem(item)
    player.prepare()
    player.seekTo(at)

    tail = player
    tailFade = fade
  }

  private fun releaseTail() {
    tail?.let { player ->
      runCatching {
        player.stop()
        player.release()
      }
    }
    tail = null
    tailFade = null
  }

  private enum class Direction { NEXT, PREVIOUS }

  /**
   * Starts the tail and moves the real player on.
   *
   * The order matters. The fade-in is set before the move because the move
   * flushes the audio pipeline, and the provider takes the first sample after
   * a flush as the start of its fade — so the new track is already quiet by the
   * time its first sample is heard.
   */
  private fun handOver(direction: Direction, fadeMs: Long, automatic: Boolean) {
    handingOver = true
    val player = tail
    if (player == null) {
      handingOver = false
      // Nothing ready to carry the old track. Better a plain change than a
      // silent gap where the overlap should be.
      move(direction)
      return
    }

    // Cheap, because the region is already buffered: this is a move within
    // what the player is holding, not a fresh read.
    if (resyncTail) {
      runCatching { player.seekTo(main.currentPosition) }
      resyncTail = false
    }

    player.play()
    mainFade.fadeIn(fadeMs, settings.equalPower)
    if (automatic) Crossfades.mark()
    move(direction)

    handler.postDelayed({
      releaseTail()
      handingOver = false
      reschedule()
    }, fadeMs + TAIL_SLACK_MS)
  }

  private fun move(direction: Direction) {
    if (direction == Direction.NEXT) main.seekToNextMediaItem() else main.seekToPreviousMediaItem()
  }

  // ---- what the forwarding player asks ----

  /**
   * A next or previous that was pressed rather than arrived at.
   *
   * Answers whether it was taken care of. The tail cannot be got ready in
   * advance here — nobody knew the button was coming — so it is opened now and
   * the swap waits for it, up to a limit short enough not to be felt as lag.
   *
   * A second press while one is being set up abandons the whole thing and
   * reports back false, so holding down next skips at the speed of the button
   * rather than at the speed of the fades.
   */
  fun skip(toNext: Boolean): Boolean {
    if (handingOver) {
      abort()
      return false
    }
    if (!settings.enabled || settings.manualMs <= 0) return false
    if (toNext && !main.hasNextMediaItem()) return false
    if (!toNext && !main.hasPreviousMediaItem()) return false
    if (!main.isPlaying) return false

    cancelPending()
    // Claimed before the waiting starts, not when the swap happens: the gap
    // between the two is exactly where a second press lands.
    handingOver = true
    val mine = ++token

    resyncTail = true
    openTail(settings.manualMs, fromMs = main.currentPosition)
    val player = tail
    if (player == null) {
      handingOver = false
      return false
    }

    val direction = if (toNext) Direction.NEXT else Direction.PREVIOUS
    waitForReady(player) {
      if (token == mine) handOver(direction, settings.manualMs, automatic = false)
    }
    return true
  }

  /**
   * Runs [action] once the tail can produce sound, or when waiting stops being
   * worth it.
   *
   * The timeout is not a fallback so much as a promise: a button has to answer
   * inside a couple of hundred milliseconds whatever the storage is doing, and
   * a handover with a tail that is not quite ready is still better than one
   * that arrives late.
   */
  private fun waitForReady(player: ExoPlayer, action: () -> Unit) {
    var done = false
    val run = {
      if (!done) {
        done = true
        action()
      }
    }

    val listener = object : Player.Listener {
      override fun onPlaybackStateChanged(state: Int) {
        if (state == Player.STATE_READY) {
          player.removeListener(this)
          run()
        }
      }
    }
    player.addListener(listener)
    if (player.playbackState == Player.STATE_READY) {
      player.removeListener(listener)
      run()
    } else {
      handler.postDelayed(run, READY_WAIT_MS)
    }
  }

  /** A pending pause, held so that pressing play again can call it off. */
  private var pendingPause: Runnable? = null

  /**
   * Fades down and then pauses, rather than stopping where it stands.
   *
   * Answers whether the pause has been taken over. Where it has, the caller
   * must not pause as well — the player has to keep running for as long as the
   * fade does.
   */
  fun pause(): Boolean {
    if (!settings.enabled || settings.pauseMs <= 0) return false
    if (!main.isPlaying) return false
    if (pendingPause != null) return true

    mainFade.fadeOut(settings.pauseMs, settings.equalPower)
    tailFade?.fadeOut(settings.pauseMs, settings.equalPower)

    val run = Runnable {
      pendingPause = null
      main.pause()
      tail?.pause()
      // Cleared only once stopped, or the next play would start at silence and
      // stay there.
      mainFade.clear()
      tailFade?.clear()
    }
    pendingPause = run
    handler.postDelayed(run, settings.pauseMs)
    return true
  }

  /**
   * Fades up on the way in.
   *
   * Answers whether play has been taken over, which happens only when a pause
   * was still fading out: the player never stopped, so starting it again is
   * nothing but calling the pause off.
   */
  fun play(): Boolean {
    val pending = pendingPause
    if (pending != null) {
      handler.removeCallbacks(pending)
      pendingPause = null
      mainFade.fadeIn(settings.pauseMs, settings.equalPower)
      tailFade?.fadeIn(settings.pauseMs, settings.equalPower)
      return true
    }

    if (settings.enabled && settings.pauseMs > 0 && !main.isPlaying) {
      mainFade.fadeIn(settings.pauseMs, settings.equalPower)
    }
    return false
  }

  /**
   * Takes the edge off a seek, which otherwise begins mid-waveform and clicks.
   *
   * Afterwards rather than before: fading out first would mean holding the seek
   * back until the fade finished, and a seek bar that answers late is worse
   * than one that answers sharply.
   */
  fun afterSeek() {
    abort()
    if (settings.enabled && settings.seekMs > 0) {
      mainFade.fadeIn(settings.seekMs, settings.equalPower)
    }
    reschedule()
  }

  /** Drops a handover in progress and everything booked for one. */
  fun abort() {
    // Anything still waiting is now waiting for something that is not going to
    // happen, and checks this before acting.
    token += 1
    cancelPending()
    pendingPause?.let { handler.removeCallbacks(it) }
    pendingPause = null
    releaseTail()
    handingOver = false
    resyncTail = false
    mainFade.clear()
  }

  fun release() {
    handler.removeCallbacksAndMessages(null)
    cancelPending()
    releaseTail()
  }

  // ---- keeping up with the player ----

  override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
    if (!handingOver) reschedule()
  }

  override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) {
    if (!handingOver) reschedule()
  }

  override fun onRepeatModeChanged(repeatMode: Int) = reschedule()

  override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) = reschedule()

  override fun onPlaybackStateChanged(playbackState: Int) {
    /*
      A track's length is not known the moment it becomes the current one — the
      transition arrives before the media is prepared, and asking then gives
      TIME_UNSET, which means no handover is ever booked. By the time the
      player is ready the length is known, so this is where the booking
      actually sticks.
    */
    if (playbackState == Player.STATE_READY && !handingOver) reschedule()
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    /*
      The tail is not in the session and hears nothing about play and pause, so
      it is walked along by hand — but only once the handover has begun. Before
      that it is parked on the last seconds of the current track waiting its
      turn, and starting it here would play the end of the song over the middle
      of it.
    */
    if (!handingOver) return
    if (isPlaying) tail?.play() else tail?.pause()
  }
}

/**
 * A note that one track handed over to the next of its own accord.
 *
 * The history counts a track as finished when the player moved on by itself,
 * and a crossfade moves on with a seek — which is otherwise indistinguishable
 * from the listener pressing next, and would file every crossfaded track as
 * skipped. This is how the two are told apart across the gap between the
 * service that does the handing over and the controller that reports it.
 *
 * Only automatic handovers are marked. Pressing next is a skip whether or not
 * it happens to be dressed in a fade.
 */
object Crossfades {
  /** Beyond this the mark belongs to some earlier transition, not this one. */
  private const val WINDOW_MS = 3_000L

  @Volatile private var at = 0L

  /**
   * The crossfader belonging to the running service, when there is one.
   *
   * The module and the service share a process, so this is a plain reference
   * rather than anything sent across a boundary. Null whenever playback is not
   * up, which is ordinary: settings changed then are read off the disk by
   * whatever service starts next.
   */
  @Volatile private var live: Crossfader? = null

  fun register(crossfader: Crossfader?) {
    live = crossfader
  }

  /** Hands new settings to the running player, on the thread it belongs to. */
  fun apply(settings: TransitionSettings) {
    val crossfader = live ?: return
    Handler(Looper.getMainLooper()).post { crossfader.settings = settings }
  }

  fun mark() {
    at = SystemClock.elapsedRealtime()
  }

  /** True once per handover, and false for every other way a track can change. */
  @Synchronized
  fun justHandedOver(): Boolean {
    val marked = at
    if (marked == 0L || SystemClock.elapsedRealtime() - marked > WINDOW_MS) return false
    at = 0L
    return true
  }
}
