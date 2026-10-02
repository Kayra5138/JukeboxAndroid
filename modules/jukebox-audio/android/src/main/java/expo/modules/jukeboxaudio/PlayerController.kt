package expo.modules.jukeboxaudio

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.jukeboxaudio.transitions.Crossfades

/** Keys under which a queue entry's own fields ride along in the media metadata. */
private const val EXTRA_URI = "jukebox.uri"
private const val EXTRA_DURATION = "jukebox.durationSec"
private const val EXTRA_TRACK_NUMBER = "jukebox.trackNumber"
private const val EXTRA_FILENAME = "jukebox.filename"
private const val EXTRA_FOLDER = "jukebox.folder"

/**
 * A session that never connects would otherwise let every command taken in the
 * meantime pile up for the life of the process, and past a handful they are all
 * stale anyway.
 */
private const val MAX_PENDING_COMMANDS = 32

/** Attempts at building the controller before the session is given up on. */
private const val MAX_CONNECT_ATTEMPTS = 4

/** Multiplied by the attempt number, so the waits are 1s, 2s, 3s. */
private const val CONNECT_RETRY_MS = 1_000L

/** ExoPlayer rejects a speed of zero outright, and both ends are unusable well before this. */
private const val MIN_RATE = 0.25
private const val MAX_RATE = 4.0

/**
 * Talks to [PlaybackService] through a Media3 [MediaController].
 *
 * Connecting is asynchronous, so commands issued before the session is ready are
 * queued rather than dropped — otherwise the first tap after a cold start would
 * silently do nothing.
 *
 * Everything here must run on the main thread; [MediaController] enforces it.
 */
class PlayerController(
  private val context: Context,
  private val emit: (name: String, payload: Map<String, Any?>) -> Unit
) {
  private var controller: MediaController? = null
  private var connecting: ListenableFuture<MediaController>? = null
  private var released = false
  private var attempts = 0
  private val pending = mutableListOf<(MediaController) -> Unit>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val reconnect = Runnable { connect() }

  /**
   * Media3 binds a [MediaController] to the thread it was *built* on and then
   * rejects calls from anywhere else. Building it anywhere but the main looper
   * therefore poisons every later call, so both construction and every command
   * are funnelled through here rather than trusting the caller's thread.
   */
  private fun onMain(block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
  }

  private val listener = object : Player.Listener {
    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
      emit(
        "onTrackChange",
        mapOf(
          "trackId" to mediaItem?.mediaId,
          "index" to (controller?.currentMediaItemIndex ?: -1),
          /*
            All three mean the previous track reached its end; anything else is
            a skip. REPEAT is what arrives when a single track loops, and
            counting it as a skip meant an hour of one song on repeat recorded
            every play as unfinished.

            A crossfade arrives as a seek, because that is how it is done —
            the player is moved on early so a second one can carry the tail.
            Indistinguishable from the listener pressing next without the mark
            the crossfader leaves, and every crossfaded track would be filed as
            skipped. Asked last, so an ordinary ending never consumes it.
          */
          "completedPrevious" to (
            reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO ||
              reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT ||
              Crossfades.justHandedOver()
          ),
          // A queue can be loaded without being started, and that transition
          // arrives looking exactly like one that begins playing. History has
          // to be able to tell them apart, or a track nobody listened to
          // accrues wall clock from the moment it was queued.
          "playWhenReady" to (controller?.playWhenReady ?: false)
        )
      )
    }

    /*
      Both figures, because they answer different questions. `isPlaying` is
      whether sound is coming out, and it drops to false for the moment a seek
      spends buffering — which is right for counting listening time and wrong
      for the play button, which then blinks to "play" and back for no reason
      the listener can see. `playWhenReady` is whether playback was *asked* for,
      and a seek does not change that.
    */
    override fun onIsPlayingChanged(isPlaying: Boolean) = emitPlayback()
    override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) = emitPlayback()

    private fun emitPlayback() {
      val player = controller ?: return
      emit(
        "onPlaybackStateChange",
        mapOf("isPlaying" to player.isPlaying, "playWhenReady" to player.playWhenReady)
      )
    }

    override fun onPlaybackStateChanged(state: Int) {
      if (state == Player.STATE_ENDED) {
        emit("onQueueEnded", emptyMap())
      }
    }

    /**
     * A missing file, a revoked permission or a codec the device does not have
     * all land here and leave the player idle. Reported rather than swallowed,
     * because otherwise the app shows a track that simply never starts.
     *
     * The cause is carried along with the message. A fault raised inside the
     * audio pipeline reaches us as "Unexpected runtime error" and nothing else,
     * which names the messenger rather than the fault; the exception underneath
     * it is the only part worth reading.
     */
    override fun onPlayerError(error: PlaybackException) {
      val said = error.message ?: error.errorCodeName
      val underneath = error.cause?.let { "${it::class.java.simpleName}: ${it.message}" }

      emit(
        "onPlaybackError",
        mapOf(
          "trackId" to controller?.currentMediaItem?.mediaId,
          "message" to listOfNotNull(said, underneath).joinToString(" — ")
        )
      )
    }
  }

  fun connect() = onMain {
    if (released || controller != null || connecting != null) return@onMain

    val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
    val future = MediaController.Builder(context, token).buildAsync()
    connecting = future
    future.addListener({
      connecting = null
      val ready = runCatching { future.get() }.getOrNull()
      if (ready == null) {
        retry()
        return@addListener
      }
      // release() can land while the connection is still in flight, in which
      // case it nulled a controller that did not exist yet. Handing this one
      // straight back is what keeps the service binding from outliving us.
      if (released) {
        ready.release()
        return@addListener
      }
      controller = ready
      attempts = 0
      ready.addListener(listener)
      pending.forEach { it(ready) }
      pending.clear()
    }, ContextCompat.getMainExecutor(context))
  }

  /**
   * Connecting is attempted once, at module creation, and it can fail for
   * reasons that pass — a background start restriction is the usual one. There
   * is nothing to call connect() a second time, so without this the controller
   * stays null for the life of the process and every command from then on fills
   * [pending] and is silently dropped: the transport looks alive and does
   * nothing at all. The delay grows so that a device that is going to refuse
   * for a while is not asked in a tight loop.
   */
  private fun retry() {
    if (released || ++attempts >= MAX_CONNECT_ATTEMPTS) {
      // Whatever was queued before the session gave up is long stale, and
      // keeping it only fills the buffer so later commands are dropped too.
      pending.clear()
      return
    }
    mainHandler.postDelayed(reconnect, CONNECT_RETRY_MS * attempts)
  }

  fun release() = onMain {
    released = true
    mainHandler.removeCallbacks(reconnect)
    connecting?.let { MediaController.releaseFuture(it) }
    connecting = null
    controller?.removeListener(listener)
    controller?.release()
    controller = null
    pending.clear()
  }

  /** Runs [block] on the main thread, now or as soon as the session connects. */
  fun withPlayer(block: (MediaController) -> Unit) = onMain {
    if (released) return@onMain
    val ready = controller
    if (ready != null) block(ready)
    else if (pending.size < MAX_PENDING_COMMANDS) pending.add(block)
  }

  /**
   * A fatal [PlaybackException] — one missing or corrupt file is enough — drops
   * the player into STATE_IDLE, and in that state play() and the seeks all move
   * the player's bookkeeping without ever resuming. Only prepare() restarts a
   * source. Stopping on a bad file is a defensible policy; leaving the user with
   * a dead transport and a stuck error banner until they build a whole new queue
   * is not, and these three are the ways back out of it.
   */
  private fun MediaController.prepareIfIdle() {
    if (playbackState == Player.STATE_IDLE) prepare()
  }

  fun play() = withPlayer { player ->
    player.prepareIfIdle()
    player.play()
  }

  fun next() = withPlayer { player ->
    player.seekToNextMediaItem()
    // Seeking first, so that the retry lands on the track the user asked for
    // rather than immediately failing again on the one that broke.
    player.prepareIfIdle()
  }

  /**
   * Media3 already implements the "restart the track unless you press twice"
   * convention through seekToPrevious().
   */
  fun previous() = withPlayer { player ->
    player.seekToPrevious()
    player.prepareIfIdle()
  }

  fun setQueue(tracks: List<Map<String, Any?>>, startIndex: Int, autoPlay: Boolean) = withPlayer { player ->
    val items = tracks.map(::toMediaItem)
    if (items.isEmpty()) {
      player.clearMediaItems()
      return@withPlayer
    }
    // An index past the end throws IllegalSeekPositionException, on the main
    // thread, so a queue that shrank between the two sides would be fatal.
    player.setMediaItems(items, startIndex.coerceIn(0, items.size - 1), 0L)
    player.prepare()
    player.playWhenReady = autoPlay
  }

  /**
   * Insert a track into the live queue.
   *
   * Done here rather than by rebuilding the queue from JavaScript so that
   * playback is not interrupted: the player keeps its position, and the
   * notification's next/previous keep matching what the app shows.
   */
  fun insert(track: Map<String, Any?>, index: Int) = withPlayer { player ->
    val at = if (index < 0) player.mediaItemCount else index.coerceIn(0, player.mediaItemCount)
    player.addMediaItem(at, toMediaItem(track))
  }

  fun move(from: Int, to: Int) = withPlayer { player ->
    val count = player.mediaItemCount
    if (from in 0 until count && to in 0 until count) player.moveMediaItem(from, to)
  }

  fun removeAt(index: Int) = withPlayer { player ->
    if (index in 0 until player.mediaItemCount) player.removeMediaItem(index)
  }

  fun skipToIndex(index: Int) = withPlayer { player ->
    if (index in 0 until player.mediaItemCount) player.seekTo(index, 0L)
  }

  /**
   * Speed and pitch are independent in ExoPlayer: it time-stretches with Sonic,
   * so changing tempo keeps the original pitch unless pitch is moved too.
   */
  fun setPlaybackParams(speed: Double, pitch: Double) = withPlayer { player ->
    player.playbackParameters = PlaybackParameters(rate(speed), rate(pitch))
  }

  fun setRepeatMode(mode: String) = withPlayer { player ->
    player.repeatMode = when (mode) {
      "one" -> Player.REPEAT_MODE_ONE
      "all" -> Player.REPEAT_MODE_ALL
      else -> Player.REPEAT_MODE_OFF
    }
  }

  /** Callback rather than a return value because reading state is main-thread only. */
  fun status(onResult: (Map<String, Any?>) -> Unit) = onMain {
    val player = controller
    if (player == null) {
      onResult(mapOf("connected" to false))
      return@onMain
    }
    onResult(
      mapOf(
        "connected" to true,
        "isPlaying" to player.isPlaying,
        "playWhenReady" to player.playWhenReady,
        "isBuffering" to (player.playbackState == Player.STATE_BUFFERING),
        "trackId" to player.currentMediaItem?.mediaId,
        "index" to player.currentMediaItemIndex,
        "positionSec" to player.currentPosition / 1000.0,
        "durationSec" to player.duration.takeIf { it > 0 }?.div(1000.0),
        "shuffle" to player.shuffleModeEnabled,
        "speed" to player.playbackParameters.speed.toDouble(),
        "pitch" to player.playbackParameters.pitch.toDouble(),
        "repeat" to when (player.repeatMode) {
          Player.REPEAT_MODE_ONE -> "one"
          Player.REPEAT_MODE_ALL -> "all"
          else -> "off"
        }
      )
    )
  }

  /**
   * The queue as the player holds it.
   *
   * A JavaScript reload throws away the app's mirror of the queue while the
   * foreground service happily keeps playing it, and this is the only way back
   * to what is actually loaded.
   */
  fun queue(onResult: (List<Map<String, Any?>>) -> Unit) = onMain {
    val player = controller
    if (player == null) {
      onResult(emptyList())
      return@onMain
    }
    onResult((0 until player.mediaItemCount).map { fromMediaItem(player.getMediaItemAt(it)) })
  }

  /**
   * Shuffles the queue itself, leaving what is playing where it is.
   *
   * Not the player's own shuffle mode, which keeps the queue in order and
   * merely picks a random window to go to next — so the list said one thing and
   * the playing said another, and the order it would take was invisible.
   * Rearranging the items means the queue on screen *is* the order, and a
   * second press genuinely reshuffles rather than toggling a flag.
   *
   * Everything but the current item is removed and added back in a new order.
   * Removing items other than the one playing leaves playback untouched, which
   * a rebuild of the whole queue would not.
   *
   * @param order The ids to lay the rest of the queue out in, worked out by the
   *   caller. What a shuffle should feel like is a judgement — an artist ought
   *   not to come round twice in a row — and it is made where it can be tested
   *   and where a track's artist is known, rather than here against media items
   *   that carry only what was put in them. Null asks for a plain shuffle,
   *   which is what is left when there is nobody to ask.
   */
  fun shuffleQueue(order: List<String>?, onResult: (Map<String, Any?>) -> Unit) = onMain {
    val player = controller
    if (player == null) {
      onResult(mapOf("items" to emptyList<Map<String, Any?>>(), "index" to -1))
      return@onMain
    }

    /*
      The index comes back with the list, rather than the caller assuming the
      playing track was moved to the front. It usually is — but not when there
      was too little to shuffle, and a caller that assumed otherwise would then
      point at the wrong row: the wrong title everywhere, `play next` inserting
      before the playing track, and removing the top row ending a listening
      session that had not finished.
    */
    val count = player.mediaItemCount
    val current = player.currentMediaItemIndex
    if (count < 3 || current !in 0 until count) {
      onResult(
        mapOf(
          "items" to (0 until count).map { fromMediaItem(player.getMediaItemAt(it)) },
          "index" to current
        )
      )
      return@onMain
    }

    val held = (0 until count).filter { it != current }.map { player.getMediaItemAt(it) }

    /*
      Laid out as asked, then anything the caller did not name appended in a
      shuffle of its own. The two lists can disagree — a download landing
      between working the order out and applying it is enough — and an item
      dropped here would be an item gone from the queue, which is a worse
      answer than one in an unconsidered place.
    */
    val rest = if (order == null) held.shuffled() else {
      val named = order.withIndex().associate { (at, id) -> id to at }
      val (asked, extra) = held.partition { named.containsKey(it.mediaId) }
      asked.sortedBy { named[it.mediaId] } + extra.shuffled()
    }

    // After the current item, then before it — in that order, so the second
    // removal is the only one that shifts the index being kept.
    if (current + 1 < count) player.removeMediaItems(current + 1, count)
    if (current > 0) player.removeMediaItems(0, current)
    player.addMediaItems(rest)

    onResult(
      mapOf(
        "items" to (0 until player.mediaItemCount).map { fromMediaItem(player.getMediaItemAt(it)) },
        "index" to player.currentMediaItemIndex
      )
    )
  }

  /** Use the player's timeline, including its shuffled order and repeat mode. */
  fun upcoming(limit: Int, onResult: (List<Map<String, Any?>>) -> Unit) = onMain {
    val player = controller
    if (player == null || player.currentTimeline.isEmpty) {
      onResult(emptyList())
      return@onMain
    }
    val result = mutableListOf<Map<String, Any?>>()
    val seen = mutableSetOf<Int>()
    var index = player.currentMediaItemIndex
    if (index !in 0 until player.currentTimeline.windowCount) {
      onResult(emptyList())
      return@onMain
    }
    repeat(limit.coerceIn(0, 20)) {
      index = player.currentTimeline.getNextWindowIndex(index, player.repeatMode, player.shuffleModeEnabled)
      if (index < 0 || !seen.add(index)) { onResult(result); return@onMain }
      result.add(fromMediaItem(player.getMediaItemAt(index)) + ("index" to index))
    }
    onResult(result)
  }

  private fun rate(value: Double): Float =
    if (value.isNaN()) 1f else value.coerceIn(MIN_RATE, MAX_RATE).toFloat()

  private fun toMediaItem(track: Map<String, Any?>): MediaItem {
    // Artwork used to be left unset, because the only thing that ever reached
    // this field was the media store's album art — which is per *album*, and an
    // untagged library is filed as a single album, so passing it put one cover
    // on every song. The library stopped reading that column entirely, and what
    // arrives here now is the cover a lookup downloaded for this track: per
    // track, and the same picture the app itself shows.
    //
    // Without it the notification and the widget could only show a cover that
    // was already inside the file, so a song whose art was found online had one
    // everywhere except the two places you see while the phone is locked.
    //
    // Media3 still reads the file's own picture; this only fills the gap for
    // files that have none.
    //
    // Everything else rides in the metadata extras rather than being left on the
    // MediaItem: a media item's local configuration — the uri included — is
    // stripped before it reaches a controller, so whatever [queue] has to read
    // back out has to be somewhere that survives the session boundary.
    val extras = Bundle().apply {
      putString(EXTRA_URI, track["uri"] as? String)
      putString(EXTRA_FILENAME, track["filename"] as? String)
      putString(EXTRA_FOLDER, track["folder"] as? String)
      putDouble(EXTRA_DURATION, (track["durationSec"] as? Number)?.toDouble() ?: -1.0)
      putInt(EXTRA_TRACK_NUMBER, (track["trackNumber"] as? Number)?.toInt() ?: -1)
    }

    val metadata = MediaMetadata.Builder()
      .setTitle(track["title"] as? String)
      .setArtist(track["artist"] as? String)
      .setAlbumTitle(track["album"] as? String)
      .apply {
        /*
          The cover the notification shows.

          Two places keep one, and only one of them used to reach here. A
          lookup writes what it found to the database, which is where
          `artworkUri` comes from — but a lookup often finds a track's words
          and tags and no picture at all. A download keeps the thumbnail it
          came with, and that is what the library rows have been showing for
          those tracks all along.

          So the notification had a cover for a track whose lookup happened to
          turn one up and none for a track whose lookup did not, which from
          the outside looks like nothing in particular. Asked in the same
          order the app asks, both have one.
        */
        val artwork = (track["artworkUri"] as? String)?.takeIf { it.isNotBlank() }
          ?: (track["id"] as? String)?.let {
            expo.modules.jukeboxaudio.downloads.DownloadStore.artwork(context, it)
          }
        artwork?.let { setArtworkUri(Uri.parse(it)) }
      }
      .setExtras(extras)
      .build()

    return MediaItem.Builder()
      .setMediaId(track["id"] as? String ?: "")
      .setUri(track["uri"] as? String)
      .setMediaMetadata(metadata)
      .build()
  }

  private fun fromMediaItem(item: MediaItem): Map<String, Any?> {
    val metadata = item.mediaMetadata
    val extras = metadata.extras
    return mapOf(
      "id" to item.mediaId,
      "uri" to extras?.getString(EXTRA_URI),
      "title" to (metadata.title?.toString() ?: ""),
      "artist" to metadata.artist?.toString(),
      "album" to metadata.albumTitle?.toString(),
      "artworkUri" to null,
      "durationSec" to extras?.getDouble(EXTRA_DURATION, -1.0)?.takeIf { it >= 0.0 },
      "trackNumber" to extras?.getInt(EXTRA_TRACK_NUMBER, -1)?.takeIf { it >= 0 },
      "filename" to extras?.getString(EXTRA_FILENAME),
      "folder" to extras?.getString(EXTRA_FOLDER)
    )
  }
}
