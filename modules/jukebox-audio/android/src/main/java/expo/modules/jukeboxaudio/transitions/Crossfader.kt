package expo.modules.jukeboxaudio.transitions

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.PlayerMessage
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.extractor.mp3.Mp3Extractor
import kotlin.math.abs

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
 * The second player is not started at the crossfade point. Started there it
 * takes a tenth or a fifth of a second to make its first sound -- a decoder to
 * open, an audio track to create -- and the main player has by then already
 * let go of the old track, so the overlap opened with a hole exactly as long
 * as that, in the outgoing track at full volume. It is started a couple of
 * seconds early instead, **silent and playing beside the main player**, and
 * put in step with it while nobody can hear the adjustment. At the crossfade
 * point it is already where the main player is, and all that happens is that
 * its volume comes up as the main player moves on.
 *
 * Everything here runs on the main thread, which is the one the player belongs
 * to. The position-accurate triggers arrive on the playback thread and are
 * posted across.
 */
private const val TAG = "JukeboxCrossfade"

@OptIn(UnstableApi::class)
class Crossfader(
  private val context: Context,
  private val main: ExoPlayer,
  private val mainFade: FadeGainProvider,
  /** The session the phone's effects are on, so the tail is coloured the same way. */
  private val audioSessionId: Int
) : Player.Listener {
  /**
   * How long a pressed next or previous waits past the second player's first
   * sound. The music carries on meanwhile, so this and the start itself are
   * how late the button answers: about a third of a second together, which is
   * what can be asked of it. There is no room in that for moving the tail, and
   * there need not be -- it is aimed by what the last start cost.
   */
  private val MANUAL_WARM_MS = 120L

  /** The least time the second player can be got running in; under it, no overlap. */
  private val LEAST_WARM_MS = 250L

  /** How long after starting the second player its place is first looked at. */
  private val LOOK_AFTER_MS = 200L

  /**
   * How long a player has to have been running, undisturbed, before where it
   * says it is can be believed to the millisecond.
   *
   * A player works its position out from its audio track's clock, and for the
   * first moments after a start, a seek or a change of speed it has only a
   * rough idea of that clock: readings then were seen to wander by twenty to
   * forty milliseconds with nothing having moved. Acting on those put the
   * tail exactly where a wrong reading said it should be.
   */
  private val SETTLE_MS = 450L

  /** And between looks, while it is not yet running or two looks disagree. */
  private val LOOK_AGAIN_MS = 50L

  /**
   * How far out of step is close enough, in milliseconds.
   *
   * A player's position is read from its audio track's clock and worked
   * forward from there, good to a handful of milliseconds; chasing an error
   * smaller than the reading can see would be correcting the noise, and each
   * correction is a seek that has to settle again.
   */
  private val IN_STEP_MS = 12L

  /** At most this many corrections. Past it the storage is the problem, not the aim. */
  private val MOST_CORRECTIONS = 3

  /**
   * Under this far out, the tail is not moved but hurried or held back.
   *
   * A seek lands where it was aimed and then takes its own time to make a
   * sound again, and that time was measured at anything from a tenth of a
   * second to three: good for closing a quarter of a second, useless for
   * closing a twentieth, since each try is a fresh roll of the same dice --
   * three seeks in a row were seen to leave it seventy milliseconds out.
   * Running the silent tail a little fast or slow for a moment closes a small
   * distance exactly, with nothing restarted. The audio track takes the speed
   * itself, so the samples the fade is counting are not disturbed.
   */
  private val NUDGE_UNDER_MS = 300L

  /**
   * How much faster or slower, at most. Nobody hears it; it only has to be
   * quick, and to stay inside what an audio track will do without complaint.
   */
  private val MOST_NUDGE = 0.35f

  /** Set while the tail is running off-speed, with what puts it back. */
  private var nudgeEnd: Runnable? = null

  /** When the tail's position can next be believed; nought until it is seen running. */
  private var settledAt = 0L

  /** Slack before the tail is let go, so its last samples are not cut off. */
  private val TAIL_SLACK_MS = 400L

  private val handler = Handler(Looper.getMainLooper())

  var settings: TransitionSettings = TransitionSettings()
    set(value) {
      field = value
      reschedule()
    }

  /**
   * Whether the music is to stop at the end of the track that is playing.
   *
   * The sleep timer's to set. The stopping itself is the player's doing; all
   * this does is keep the crossfade from leaving the track before it ends.
   */
  var stopsHere: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      reschedule()
    }

  private var prepareMessage: PlayerMessage? = null
  private var swapMessage: PlayerMessage? = null

  private var tail: ExoPlayer? = null
  private var tailFade: FadeGainProvider? = null

  /** True from the tail being started, silent, until its volume comes up. */
  private var tailWarm = false

  /** Where in the track the tail was last started from, and so where its fade counts from. */
  private var tailFrom = 0L

  /** The place in the track the main player lets go and the tail is heard. */
  private var tailSwapAt = 0L
  private var tailFadeMs = 0L

  /** Whether the tail is still on its first start, as opposed to a correction. */
  private var tailCold = true
  private var corrections = 0

  /** The last look at how far behind the tail is, to be agreed with before it is believed. */
  private var lastBehind = Long.MIN_VALUE

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
      albumOfNext = nextItem()?.mediaMetadata?.albumTitle?.toString(),
      repeatOne = main.repeatMode == Player.REPEAT_MODE_ONE,
      stopsHere = stopsHere
    )
    if (start == null) {
      // A tail may already be parked for a handover that has just been called
      // off -- repeat-one switched on in the last second of a track, say. It
      // would otherwise sit there holding a decoder for as long as the loop ran.
      releaseTail()
      return
    }

    val speed = main.playbackParameters.speed
    val now = main.currentPosition

    // Too close to it for a second player to be got running — a seek into the
    // last few seconds, say. Handing over from here would be the old hole
    // again, so this track simply ends the ordinary way.
    if (now >= start - trackMs(LEAST_WARM_MS + Crossfades.coldMs, speed)) {
      if (tailWarm && tailSwapAt != start) releaseTail()
      if (!tailWarm) return
    }

    val index = main.currentMediaItemIndex
    // The trigger is a position in the track, and the tail needs its time on
    // the clock: played fast, the same stretch of track goes by sooner, so the
    // head start is taken further back to match.
    val lead = trackMs(TransitionSettings.PREPARE_MS, speed)

    if (now >= start - lead) {
      /*
        Inside the head start already: a seek to just before the end, or play
        pressed again there. The moment for making the tail ready has gone by,
        and a moment booked in the past is never delivered — which used to
        leave the swap with nothing to carry the old track, and cut it off
        where the overlap should have begun. So the tail is started now, with
        whatever time is left. One already running for this same handover is
        left alone: this is called for many reasons, and most of them change
        nothing about a tail that is on its way.
      */
      val running = tailWarm && tail != null && tailSwapAt == start
      if (!running && !openTail(settings.autoMs, start)) return
    } else {
      releaseTail()
      prepareMessage = post(index, start - lead) { openTail(settings.autoMs, start) }
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
   * Starts a second player on the current track, silent, beside the main one.
   *
   * [swapAtMs] is the place in the track where it will be heard. Its fade is
   * booked for that place now, counted in its own samples from where it
   * starts, so the fade begins on the right sample however long the audio sat
   * in the sink before being heard.
   *
   * It is started a little ahead of the main player, by as long as a start
   * was last seen to take, so that by the time it makes a sound it is where
   * the main player has got to. That is a guess, and [look] checks it.
   *
   * Answers false when there is no room left before [swapAtMs] to do any of
   * this, or the player could not be made.
   */
  private fun openTail(fadeMs: Long, swapAtMs: Long): Boolean {
    releaseTail()

    val item = main.currentMediaItem ?: return false
    val speed = main.playbackParameters.speed
    val from = main.currentPosition + trackMs(Crossfades.coldMs, speed)
    // It has to be running before the place, with a moment to spare.
    if (swapAtMs - from < trackMs(50, speed)) return false

    // Under the same wind-down as the main player, so a track that hands over
    // while a sleep timer is fading does not leave at full volume.
    val fade = FadeGainProvider(mainFade.windDown)
    val player = runCatching {
      // Named, so that the tail is levelled as the track it is the end of and
      // not as the one the main player has by then moved on to.
      ExoPlayer.Builder(context, FadingRenderersFactory(context, fade, item.mediaId.takeIf { it.isNotEmpty() }))
        /*
          An MP3 is found its way around by a table of a hundred entries, or
          by assuming every frame is the same size, and either lands a seek
          near the place rather than on it. The player then calls wherever it
          landed by the name it was asked for. The main player came here by
          playing, so its positions are true; the tail comes by a seek, and
          has to land on the same sample or the two are the same music a few
          hundredths apart. Reading the file through to count its frames makes
          the seek exact, and for a file on the phone costs next to nothing.
        */
        .setMediaSourceFactory(
          DefaultMediaSourceFactory(
            context,
            DefaultExtractorsFactory().setMp3ExtractorFlags(Mp3Extractor.FLAG_ENABLE_INDEX_SEEKING)
          )
        )
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
    }.getOrNull() ?: return false

    // The same session as the main player, so the bass boost and the other
    // effects of the phone's are on the outgoing track too. A crossfade where
    // one side is coloured and the other is not would be heard as the tone
    // shifting across the join. (The equalizer needs no such care: it is in
    // each player's own chain, and both read the one curve.)
    runCatching { player.audioSessionId = audioSessionId }

    // At the speed and the pitch the track is being heard at. Left at its own
    // defaults the tail would be the same song at a different tempo and key
    // for exactly the length of the overlap, which is the one stretch where
    // both can be heard side by side.
    player.playbackParameters = main.playbackParameters

    // Silent at the audio track, which answers at once, rather than in the
    // fade, which is heard a buffer late. The fade is for the shape of the
    // overlap; this is the switch.
    player.volume = 0f
    fade.fadeOut(fadeMs, settings.equalPower, holdMs = swapAtMs - from)
    player.setMediaItem(item, from)
    player.prepare()
    player.playWhenReady = true

    tail = player
    tailFade = fade
    tailWarm = true
    tailFrom = from
    tailSwapAt = swapAtMs
    tailFadeMs = fadeMs
    tailCold = true
    corrections = 0
    lastBehind = Long.MIN_VALUE
    settledAt = 0L
    nudged = false
    handler.postDelayed({ look(player) }, LOOK_AFTER_MS)
    return true
  }

  /**
   * Sees how far the silent tail is from the main player, and moves it.
   *
   * Two players cannot be started together: each has its own audio track, and
   * how long one takes to make its first sound is the phone's business. What
   * can be done is to start one, see where it turned out to be, and move it —
   * and since it is silent, moving it costs nothing anybody hears. What a
   * start was seen to cost is remembered, so the next one is aimed better and
   * mostly needs no moving at all.
   *
   * A reading is believed only once the tail is actually running and two
   * readings in a row agree: for its first moments a player's position is
   * worked out from less than it will have shortly, and it jumps.
   */
  private fun look(player: ExoPlayer) {
    if (tail !== player || !tailWarm) return
    val speed = main.playbackParameters.speed
    val left = tailSwapAt - main.currentPosition
    if (left <= 0) return

    val again = { handler.postDelayed({ look(player) }, LOOK_AGAIN_MS) }
    if (!player.isPlaying || player.currentPosition < tailFrom + 30) {
      again()
      return
    }
    // Running, but not for long enough to be believed.
    if (settledAt == 0L) settledAt = SystemClock.elapsedRealtime() + SETTLE_MS
    if (SystemClock.elapsedRealtime() < settledAt) {
      again()
      return
    }

    val behind = main.currentPosition - player.currentPosition
    if (lastBehind == Long.MIN_VALUE || abs(behind - lastBehind) > IN_STEP_MS) {
      lastBehind = behind
      again()
      return
    }
    lastBehind = Long.MIN_VALUE

    // Remembered on the clock rather than in the track, since it is the
    // phone's time that a start takes, whatever speed the music is at. Half
    // of what was seen, not all of it: a start takes a different time every
    // time, and believing the last one whole swings the next as far the other
    // way. Not learned from a nudge, which is no start at all.
    val late = clockMs(behind, speed)
    if (!nudged) {
      if (tailCold) Crossfades.coldMs = (Crossfades.coldMs + late / 2).coerceIn(0, 800)
      else Crossfades.warmMs = (Crossfades.warmMs + late / 2).coerceIn(0, 500)
    }
    val how = if (nudged) "nudged" else if (tailCold) "started" else "moved"
    nudged = false
    Log.i(TAG, "tail $how: $behind ms behind, $left ms to go")

    if (abs(late) <= IN_STEP_MS) return

    if (abs(late) <= NUDGE_UNDER_MS && nudge(player, behind, left, speed)) return
    if (corrections >= MOST_CORRECTIONS) return
    // No room to move it and see it settle. Left where it is: a little out is
    // better than silent.
    if (clockMs(left, speed) < Crossfades.warmMs + LEAST_WARM_MS) return

    corrections += 1
    tailCold = false
    val to = main.currentPosition + trackMs(Crossfades.warmMs, speed)
    // The fade is booked again from the new start. A seek empties the chain
    // and its count of samples begins again at nought, which the fader takes
    // as its cue to count from there.
    tailFade?.fadeOut(tailFadeMs, settings.equalPower, holdMs = tailSwapAt - to)
    player.seekTo(to)
    tailFrom = to
    settledAt = 0L
    handler.postDelayed({ look(player) }, LOOK_AFTER_MS / 2)
  }

  /** Whether the look in hand follows a nudge rather than a start or a seek. */
  private var nudged = false

  /**
   * Runs the silent tail fast or slow for just long enough to close [behind].
   *
   * Answers false when there is no room before the swap to do it gently
   * enough, and the caller falls back on what it would have done anyway.
   */
  private fun nudge(player: ExoPlayer, behind: Long, left: Long, speed: Float): Boolean {
    // Time on the clock to spend on it: most of what is left, and no more
    // than the better part of a second, with a moment kept to look again
    // afterwards and put right whatever the first go left over.
    val room = (clockMs(left, speed) - 150).coerceAtMost(700)
    if (room < 80) return false
    // The tail gains on the main player by this share of the clock.
    val share = clockMs(abs(behind), speed).toFloat() / room
    if (share > MOST_NUDGE) return false

    val normal = main.playbackParameters
    val by = if (behind > 0) 1f + share else 1f - share
    runCatching { player.playbackParameters = PlaybackParameters(normal.speed * by, normal.pitch) }
    val end = Runnable {
      nudgeEnd = null
      if (tail !== player) return@Runnable
      runCatching { player.playbackParameters = main.playbackParameters }
      nudged = true
      lastBehind = Long.MIN_VALUE
      // A change of speed unsettles the reading as a start does.
      settledAt = SystemClock.elapsedRealtime() + SETTLE_MS
      handler.postDelayed({ look(player) }, SETTLE_MS)
    }
    nudgeEnd = end
    handler.postDelayed(end, room)
    return true
  }

  private fun releaseTail() {
    tail?.let { player ->
      runCatching {
        player.stop()
        player.release()
      }
    }
    nudgeEnd?.let { handler.removeCallbacks(it) }
    nudgeEnd = null
    tail = null
    tailFade = null
    tailWarm = false
  }

  private enum class Direction { NEXT, PREVIOUS }

  /**
   * Brings the tail up and moves the real player on.
   *
   * The tail has been playing in silence beside the main player; its volume
   * coming up and the main player letting go are one moment, with the same
   * music on both sides of it.
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

    Log.i(
      TAG,
      "handing over ${if (automatic) "at the end" else "on a press"}: tail " +
        "${main.currentPosition - player.currentPosition} ms behind, " +
        "${if (player.isPlaying) "running" else "not running yet"}, $corrections moved"
    )
    tailWarm = false
    // Caught mid-nudge, it goes back to the speed of the music before it is heard.
    nudgeEnd?.let {
      handler.removeCallbacks(it)
      nudgeEnd = null
      runCatching { player.playbackParameters = main.playbackParameters }
    }
    player.volume = 1f
    mainFade.fadeIn(fadeMs, settings.equalPower)
    if (automatic) Crossfades.mark()
    move(direction)

    /*
      The fade is counted in samples of the track, upstream of where the speed
      is applied, so its length is a length of music; this timer is a length of
      time on the clock. At half speed the same fade takes twice as long to be
      heard, and letting the tail go after the plain figure would cut it off
      in the middle. Measured once, at the speed the overlap began at: a speed
      changed during those few seconds leaves it a little out, and no more.
    */
    val heardFor = clockMs(fadeMs, main.playbackParameters.speed)
    handler.postDelayed({
      // Only for the tail this was set for. Skipped away from, and skipped
      // again, the tail by now belongs to a later handover, and letting that
      // one go would cut its fade off in the middle.
      if (tail !== player) return@postDelayed
      releaseTail()
      handingOver = false
      reschedule()
    }, heardFor + TAIL_SLACK_MS)
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

    val speed = main.playbackParameters.speed
    val swapAt = main.currentPosition + trackMs(MANUAL_WARM_MS + Crossfades.coldMs, speed)
    // So near the end that the track will have finished first. It is left to.
    val duration = main.duration
    if (duration != C.TIME_UNSET && swapAt >= duration - 200) return false

    cancelPending()
    // Claimed before the waiting starts, not when the swap happens: the gap
    // between the two is exactly where a second press lands.
    handingOver = true
    val mine = ++token

    /*
      Nobody knew the button was coming, so the tail is started now and the
      swap booked for a moment on, at a place in the track: by then the tail
      is running. The music carries on
      until then, which is the whole of what the listener waits.
    */
    if (!openTail(settings.manualMs, swapAt)) {
      handingOver = false
      return false
    }

    val direction = if (toNext) Direction.NEXT else Direction.PREVIOUS
    swapMessage = post(main.currentMediaItemIndex, swapAt) {
      if (token == mine) handOver(direction, settings.manualMs, automatic = false)
    }
    // The place may never be reached -- paused on the way there and left. A
    // press that was never answered must not hold the next one up for good.
    handler.postDelayed({ if (token == mine && tailWarm) abort() }, 4_000)
    return true
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
    // The fade is a length of music, counted in the track's own samples; the
    // wait for it to finish is a length of time. At half speed the same fade
    // takes twice as long to be heard, and pausing after the plain figure cut
    // it off half way down.
    handler.postDelayed(run, clockMs(settings.pauseMs, main.playbackParameters.speed))
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

  override fun onPlaybackParametersChanged(playbackParameters: PlaybackParameters) {
    // The tail hears nothing from the session, so it is told by hand, parked
    // or sounding; and the head start it is given depends on the speed.
    nudgeEnd?.let { handler.removeCallbacks(it) }
    nudgeEnd = null
    runCatching { tail?.playbackParameters = playbackParameters }
    if (!handingOver) reschedule()
  }

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
      it is walked along by hand once a handover is under way.
    */
    if (handingOver) {
      if (isPlaying) tail?.play() else tail?.pause()
      return
    }
    /*
      Before that it is running in silence towards a place the main player has
      now stopped approaching. Kept, it would arrive alone; so it is let go
      along with what was booked for it, and playing again books the whole
      thing afresh from wherever that is.
    */
    if (!isPlaying) {
      if (tailWarm) {
        cancelPending()
        releaseTail()
      }
    } else {
      reschedule()
    }
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

  /**
   * How long a second player was last seen to take to make its first sound,
   * from nothing and after a seek, in milliseconds on the clock.
   *
   * Learned as it goes and kept for the life of the process, so each start is
   * aimed by the one before. The figures to begin with are a mid-range phone's.
   */
  @Volatile var coldMs = 180L
  @Volatile var warmMs = 90L

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
