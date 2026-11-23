package expo.modules.jukeboxaudio.sleep

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.jukeboxaudio.transitions.Crossfader
import expo.modules.jukeboxaudio.transitions.WindDown

/**
 * Stops the music after a while, or at the end of a track.
 *
 * Here, in the service, and not in the app. A sleep timer is for somebody who
 * is about to stop looking at the phone: the screen goes off, the app is
 * swiped away or simply reclaimed, and the music carries on because nothing in
 * JavaScript is needed for it to. The timer has to carry on the same way, so
 * it lives beside the player it stops and the app only asks after it.
 *
 * **The clock.** The deadline is a reading of `elapsedRealtime`, which counts
 * through sleep, and it is the only thing that decides whether the time is up.
 * What wakes the timer at the deadline is a delayed message on the main
 * looper, which does not count through sleep -- and does not have to. While
 * music is sounding the processor is awake: an audio track that is running
 * holds it so, which is the same thing that lets a track change with the
 * screen off, and doze does not hold back a handler in a process that is
 * running. So with something to stop, the message is on time. With nothing to
 * stop -- paused, the phone asleep on a table -- it may come late, and all it
 * had to do then was clear the timer; in case the music is started before it
 * arrives, the deadline is looked at again whenever playing begins. An alarm
 * would be the other way to do it, and would need the permission for exact
 * alarms to be any more punctual than this already is where it matters.
 *
 * **Paused by hand.** The timer goes on counting, on the clock rather than in
 * music heard: half an hour is half an hour from when it was asked for. If it
 * runs out while paused it clears and that is all.
 *
 * **The end of a track** is the player's own doing, not a position watched for
 * from here: asked to pause at the end of its items, it plays the last sample
 * and stops with the next track unstarted. That holds under repeat-one, where
 * the next thing is the same track again, and the crossfader is told as well,
 * so it does not leave the track early. It means the end of whichever track
 * is playing when one ends; skip to another and it is that one.
 *
 * **Nothing is written down.** A timer does not survive the process, on
 * purpose. One that came back with a service started hours later by a press
 * on the widget would stop music that somebody had only just asked for; and
 * because none of this is on disk -- not the deadline, not the player's
 * pausing at the end of a track, not the fade -- there is nothing stale for a
 * new process to find.
 *
 * **A shake** in the last few minutes of a duration adds ten more (see
 * [ShakeToExtend]), for somebody who hears the music begin to go and is not
 * yet asleep. The accelerometer is listened to only then, and only while the
 * music plays.
 *
 * Everything here runs on the main thread, which is the player's.
 */
@OptIn(UnstableApi::class)
class SleepTimer(
  private val main: ExoPlayer,
  private val crossfader: Crossfader,
  private val windDown: WindDown,
  private val context: Context? = null
) : Player.Listener {
  private enum class Kind(val id: String) {
    OFF("off"),
    DURATION("duration"),
    END_OF_TRACK("endOfTrack"),
    END_OF_CHAPTER("endOfChapter")
  }

  private val handler = Handler(Looper.getMainLooper())
  private val due = Runnable { expire() }
  private val watch = Runnable { watchChapter() }
  private val listen = Runnable { updateShake() }
  private val shake = context?.let { ShakeToExtend(it) { shaken() } }

  private var kind = Kind.OFF

  /** On the `elapsedRealtime` clock. Only meaningful for a duration. */
  private var deadline = 0L
  private var finishTrack = false
  private var fade = false

  /** A duration that has run out and is letting the track play to its end. */
  private var finishing = false

  /** Whether the player has been asked to pause at the end of the track. */
  private var stoppingAtEnd = false

  /** For the end of a chapter: where in which item it ends, in the item's own milliseconds. */
  private var chapterItem = -1
  private var chapterEndMs = 0L

  // ---- what the app asks ----

  /** Pauses in [durationMs], replacing whatever timer there was. */
  fun start(durationMs: Long?, finishTrack: Boolean, fade: Boolean) {
    reset()
    val length = sleepLength(durationMs)
    if (length != null) {
      val now = SystemClock.elapsedRealtime()
      kind = Kind.DURATION
      deadline = now + length
      this.finishTrack = finishTrack
      this.fade = fade
      // Booked now, for later. The ramp is counted on the same clock as the
      // deadline, so it begins on time with no message to wake it.
      fadeWindow(now, deadline, fade, finishTrack)?.let { (from, silentAt) ->
        windDown.over(from, silentAt)
      }
      handler.postDelayed(due, length)
      bookShake(now)
    }
    announce()
  }

  /** Pauses when the track that is playing ends, replacing whatever timer there was. */
  fun untilTrackEnds() {
    reset()
    // With nothing loaded there is no track to end, and the request would sit
    // on the player waiting for the first thing anybody played next.
    if (main.mediaItemCount > 0) {
      kind = Kind.END_OF_TRACK
      stopAtTrackEnd(true)
    }
    announce()
  }

  /**
   * Pauses when the tape playing gets to [positionMs] — the end of the
   * chapter it is in — however long that takes in time: a pause holds it
   * back, a faster speed brings it on, and it is the place that counts, not
   * the clock. Gone to another item, or past the place by hand, it is let go.
   */
  fun atPosition(positionMs: Long) {
    reset()
    if (main.mediaItemCount > 0 && positionMs > main.currentPosition) {
      kind = Kind.END_OF_CHAPTER
      chapterItem = main.currentMediaItemIndex
      chapterEndMs = positionMs
      watchChapter()
    }
    announce()
  }

  fun cancel() {
    reset()
    announce()
  }

  /**
   * The timer as the app is told about it.
   *
   * `endsAt` is on the wall clock, in the milliseconds JavaScript counts in,
   * so the time left can be worked out there once a second without asking
   * again. Null where there is no time to count: the end of a track, or a
   * duration that has run out and is waiting for one.
   */
  fun state(): Map<String, Any?> = mapOf(
    "kind" to kind.id,
    "endsAt" to if (kind == Kind.DURATION && !finishing) {
      (System.currentTimeMillis() + deadline - SystemClock.elapsedRealtime()).toDouble()
    } else if (kind == Kind.END_OF_CHAPTER && main.isPlaying) {
      // When it will get there at the speed it plays, while it plays; nothing to count down while it waits.
      val speed = main.playbackParameters.speed.coerceAtLeast(0.1f)
      (System.currentTimeMillis() + ((chapterEndMs - main.currentPosition).coerceAtLeast(0L) / speed)).toDouble()
    } else null,
    "finishTrack" to finishTrack,
    "fade" to fade,
    "finishing" to finishing
  )

  /** The service is going. Nothing is done to a player that is about to be released. */
  fun release() {
    handler.removeCallbacks(due)
    handler.removeCallbacks(watch)
    handler.removeCallbacks(listen)
    shake?.stop()
    windDown.clear()
    kind = Kind.OFF
    finishing = false
    stoppingAtEnd = false
    announce()
  }

  // ---- a shake for more ----

  /**
   * The shake setting turned in the app: in force on a timer already in its
   * last minutes, which may be the very moment somebody thinks to change it.
   */
  fun reshake() = updateShake()

  /** A message for when the last minutes of the timer begin, to start listening then. */
  private fun bookShake(now: Long) {
    handler.removeCallbacks(listen)
    updateShake()
    val wait = shakeListenIn(deadline, now)
    if (wait > 0) handler.postDelayed(listen, wait)
  }

  /**
   * Listening exactly while it is wanted: a duration in its last minutes, or
   * run out and letting the track finish, with the music playing and the
   * setting on. Asked again whenever any of those may have changed.
   */
  private fun updateShake() {
    val shake = shake ?: return
    val now = SystemClock.elapsedRealtime()
    // Run out and letting a track finish, only for a while: a tape's chapter can be an hour of the sensor awake.
    val late = now >= deadline + SHAKE_AFTER_MS
    val wanted = kind == Kind.DURATION && main.isPlaying &&
      now >= deadline - SHAKE_WINDOW_MS && !late &&
      context?.let { ShakeToExtend.enabled(it) } == true
    if (wanted) shake.start() else shake.stop()
    if (wanted && finishing) {
      handler.removeCallbacks(listen)
      handler.postDelayed(listen, deadline + SHAKE_AFTER_MS - now)
    }
  }

  /**
   * Ten minutes more, felt as a buzz. The fade, if it had begun, comes back
   * up over a moment rather than at once, and is booked again before the new
   * end; a timer that had run out and was letting the track finish counts
   * again from now, and the track is no longer stopped at its end.
   */
  private fun shaken() {
    if (kind != Kind.DURATION) return
    val now = SystemClock.elapsedRealtime()
    deadline = extendedDeadline(deadline, now)
    if (finishing) {
      finishing = false
      stopAtTrackEnd(false)
    }
    windDown.lift(LIFT_MS)
    fadeWindow(now, deadline, fade, finishTrack)?.let { (from, silentAt) -> windDown.over(from, silentAt) }
    handler.removeCallbacks(due)
    handler.postDelayed(due, deadline - now)
    bookShake(now)
    shake?.buzz()
    // Said on the screen as well as felt, over whatever is on it: the app need not be in front for a shake to count.
    context?.let { here ->
      runCatching {
        android.widget.Toast.makeText(here, expo.modules.jukeboxaudio.Localised.text(here, expo.modules.jukeboxaudio.R.string.jukebox_sleep_extended), android.widget.Toast.LENGTH_SHORT).show()
      }
    }
    announce()
  }

  // ---- when the time is up ----

  private fun expire() {
    if (kind != Kind.DURATION || finishing) return

    // The message is counted on a clock that stops when the phone sleeps and
    // the deadline on one that does not, so early is possible. Never acted on.
    val left = deadline - SystemClock.elapsedRealtime()
    if (left > 0) {
      handler.removeCallbacks(due)
      handler.postDelayed(due, left)
      return
    }

    when (atExpiry(playing(), finishTrack)) {
      Expiry.CLEAR -> finish()
      Expiry.PAUSE -> {
        /*
          The player itself, not the session's wrapper around it. That one
          would hand the pause to the crossfader for a fade of its own, on
          music the last half minute has already taken to silence. Paused and
          not stopped: the queue and the place in it are what tomorrow's
          press of play carries on from.
        */
        main.pause()
        finish()
      }
      Expiry.FINISH_TRACK -> {
        finishing = true
        stopAtTrackEnd(true)
        announce()
      }
    }
  }

  /**
   * Looks at where the tape has got to as it plays: paused there once it has
   * got to the end of the chapter. Looked at again when the chapter should
   * end, at the speed the tape plays, rather than four times a second the
   * whole chapter long; never more than half a minute on, in case the clock
   * and the tape part company. Not looked at while paused;
   * [onIsPlayingChanged] starts it again.
   */
  private fun watchChapter() {
    handler.removeCallbacks(watch)
    if (kind != Kind.END_OF_CHAPTER) return
    if (main.currentMediaItemIndex != chapterItem) return finish()
    if (main.currentPosition >= chapterEndMs) {
      main.pause()
      return finish()
    }
    if (!main.isPlaying) return
    val speed = main.playbackParameters.speed.coerceAtLeast(0.25f)
    handler.postDelayed(watch, ((chapterEndMs - main.currentPosition) / speed).toLong().coerceIn(CHAPTER_SOONEST_MS, CHAPTER_LATEST_MS))
  }

  /** Asked to play, with something to play; see [atExpiry] for why not `isPlaying`. */
  private fun playing(): Boolean =
    main.playWhenReady &&
      (main.playbackState == Player.STATE_READY || main.playbackState == Player.STATE_BUFFERING)

  private fun stopAtTrackEnd(on: Boolean) {
    stoppingAtEnd = on
    main.pauseAtEndOfMediaItems = on
    crossfader.stopsHere = on
  }

  /** The timer has done what it was for, or found it had nothing to do. */
  private fun finish() {
    reset()
    announce()
  }

  /**
   * Puts everything back as if there had never been a timer.
   *
   * The one place that does, so that firing, cancelling and being replaced
   * cannot differ in what they leave behind. The ramp above all: left in
   * place it is a player that plays and cannot be heard.
   */
  private fun reset() {
    handler.removeCallbacks(due)
    handler.removeCallbacks(watch)
    handler.removeCallbacks(listen)
    shake?.stop()
    chapterItem = -1
    chapterEndMs = 0L
    val turnedDown = windDown.begun()
    windDown.clear()
    if (stoppingAtEnd) stopAtTrackEnd(false)
    kind = Kind.OFF
    deadline = 0L
    finishTrack = false
    fade = false
    finishing = false
    if (turnedDown && !main.playWhenReady) dropQuietAudio()
  }

  /**
   * Throws away what the sink is still holding from the fade.
   *
   * Clearing the ramp changes what is shaped from now on, and the sink already
   * has most of a second shaped before: the bottom of the fade, which would be
   * the first thing heard at the next press of play -- a silence, and then the
   * music arriving all at once. Seeking to where the player already is empties
   * the sink and reads that stretch again at full volume.
   *
   * Only while paused. With the music running, which is a fade cancelled
   * part-way, the gap a seek makes would be worse than the swell it saves.
   */
  private fun dropQuietAudio() {
    val state = main.playbackState
    if (state != Player.STATE_READY && state != Player.STATE_BUFFERING) return
    if (!main.isCurrentMediaItemSeekable) return
    main.seekTo(main.currentPosition)
  }

  private fun announce() = SleepTimers.changed(state())

  private companion object {
    /** How long the fade takes to come back up after a shake. */
    const val LIFT_MS = 2_000L
  }

  // ---- keeping up with the player ----

  override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
    if (kind == Kind.OFF) return

    if (!playWhenReady) {
      val trackEnded = reason == Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM
      /*
        The track ended and the player stopped there, which is the timer
        firing. Or the time had already run out and the music has now been
        stopped some other way -- by hand, by headphones pulled out -- and
        there is nothing left to wait for. A wait for the end of a track that
        was asked for as such is kept through a pause: it was said about the
        track, and the track has not ended.
      */
      if (finishing || (kind == Kind.END_OF_TRACK && trackEnded)) finish()
      return
    }

    // Started again after the time ran out while paused, and before the late
    // message that would have cleared it. Cleared here, so that message does
    // not arrive to find music playing and stop it.
    if (kind == Kind.DURATION && !finishing && SystemClock.elapsedRealtime() >= deadline) finish()
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    // The end of a chapter is counted in the tape, not the clock: looked for while it plays, and the time to it said again.
    if (kind == Kind.END_OF_CHAPTER) {
      if (isPlaying) watchChapter()
      announce()
      return
    }
    // Sound coming back without anybody having pressed play: a call ending,
    // after a timer that ran out while the phone slept through it.
    if (isPlaying && kind == Kind.DURATION && !finishing) {
      val now = SystemClock.elapsedRealtime()
      if (now >= deadline) expire()
      else {
        // Booked again from the clock that counts sleep: the message was
        // booked on one that stops while the phone sleeps paused, and would
        // come as late as the phone slept.
        handler.removeCallbacks(due)
        handler.postDelayed(due, deadline - now)
      }
    }
    // A shake is listened for only while there is music to keep going.
    updateShake()
  }

  override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
    if (kind != Kind.END_OF_CHAPTER) return
    val past = reason == Player.DISCONTINUITY_REASON_SEEK && newPosition.mediaItemIndex == chapterItem && newPosition.positionMs >= chapterEndMs
    // Carried over the end by a part being passed over, a sponsor's message that runs on into the next chapter: the end
    // was got to, and it pauses there, at the start of what comes after.
    if (past && SleepTimers.passingOver && oldPosition.positionMs < chapterEndMs) {
      main.pause()
      return finish()
    }
    // Gone past it by hand, or on to something else: there is no end of this chapter to wait for.
    if (past || newPosition.mediaItemIndex != chapterItem) return finish()
    announce()
    // Somewhere else in the chapter: its end is as far off as that leaves it.
    watchChapter()
  }

  override fun onPlaybackParametersChanged(playbackParameters: androidx.media3.common.PlaybackParameters) {
    if (kind != Kind.END_OF_CHAPTER) return
    announce()
    // Faster or slower, its end comes sooner or later.
    watchChapter()
  }

  override fun onPlaybackStateChanged(playbackState: Int) {
    if (playbackState == Player.STATE_ENDED && kind == Kind.END_OF_CHAPTER) return finish()
    // The last track of a queue ends the queue rather than pausing at its own
    // end, and that is the track ending all the same.
    if (playbackState == Player.STATE_ENDED && (finishing || kind == Kind.END_OF_TRACK)) finish()
  }
}

/**
 * The way from the app to the timer of the running service, and back.
 *
 * The same arrangement as the crossfader's: the module and the service share
 * a process, so this is a reference and a callback rather than anything sent
 * across a boundary. With no service there is no timer, which is said rather
 * than treated as a failure.
 */
object SleepTimers {
  private val OFF = mapOf<String, Any?>(
    "kind" to "off",
    "endsAt" to null,
    "finishTrack" to false,
    "fade" to false,
    "finishing" to false
  )

  @Volatile private var live: SleepTimer? = null

  /** While a tape's part is being passed over (`TapeKeeper`'s skipper): its jump is the tape playing on, not a hand. */
  @Volatile var passingOver = false
    private set

  /** [jump], a part of a tape passed over, told apart from a seek by hand. On the player's thread. */
  fun passOver(jump: () -> Unit) {
    passingOver = true
    try {
      jump()
    } finally {
      passingOver = false
    }
  }

  /**
   * Told every time the timer changes: set, cancelled, fired, or run out and
   * waiting for a track. Not every second -- the time left is arithmetic the
   * app can do for itself.
   */
  @Volatile var listener: ((Map<String, Any?>) -> Unit)? = null

  fun register(timer: SleepTimer?) {
    live = timer
  }

  fun set(request: Map<String, Any?>, answer: (Map<String, Any?>) -> Unit) = withTimer(answer) { timer ->
    if (request["kind"] == "endOfTrack") {
      timer.untilTrackEnds()
    } else if (request["kind"] == "endOfChapter") {
      timer.atPosition((request["positionMs"] as? Number)?.toLong() ?: 0L)
    } else {
      timer.start(
        durationMs = (request["durationMs"] as? Number)?.toLong(),
        finishTrack = request["finishTrack"] as? Boolean ?: false,
        fade = request["fade"] as? Boolean ?: true
      )
    }
  }

  fun cancel(answer: (Map<String, Any?>) -> Unit) = withTimer(answer) { it.cancel() }

  fun read(answer: (Map<String, Any?>) -> Unit) = withTimer(answer) {}

  /** The shake setting changed: see [SleepTimer.reshake]. */
  fun reshake() {
    Handler(Looper.getMainLooper()).post { live?.reshake() }
  }

  internal fun changed(state: Map<String, Any?>) {
    listener?.invoke(state)
  }

  /** On the thread the player belongs to, answering with the timer as it then stands. */
  private fun withTimer(answer: (Map<String, Any?>) -> Unit, act: (SleepTimer) -> Unit) {
    Handler(Looper.getMainLooper()).post {
      val timer = live
      if (timer == null) {
        answer(OFF)
      } else {
        act(timer)
        answer(timer.state())
      }
    }
  }
}

/** Not sooner than this after a look at the end of a chapter, which is wanted to the moment. */
private const val CHAPTER_SOONEST_MS = 50L
/** Nor later than this, whatever the clock says. */
private const val CHAPTER_LATEST_MS = 30_000L
