package expo.modules.jukeboxaudio

import android.app.PendingIntent
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.LibraryResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.jukeboxaudio.auto.BrowseTree
import expo.modules.jukeboxaudio.transitions.Crossfader
import expo.modules.jukeboxaudio.transitions.Crossfades
import expo.modules.jukeboxaudio.transitions.FadeGainProvider
import expo.modules.jukeboxaudio.transitions.FadingPlayer
import expo.modules.jukeboxaudio.transitions.FadingRenderersFactory
import expo.modules.jukeboxaudio.transitions.TransitionStore
import expo.modules.jukeboxaudio.widget.JukeboxWidget
import expo.modules.jukeboxaudio.widget.NowPlaying
import java.util.concurrent.Executors

/**
 * How many times one item may be prepared again after a fault before it is
 * taken at its word. Two, because a fault in the audio chain clears on the
 * first retry and a file that cannot be decoded will not clear on any.
 */
private const val MAX_RECOVERY_TRIES = 2

/**
 * The surfaces a media app is expected to appear in, and the only callers
 * outside this app allowed to browse the library.
 *
 * Short on purpose. A name that is not here is not refused because it is
 * suspect but because nothing else has any business reading somebody's
 * listening history, and a list of what a player might plausibly be asked by
 * is far easier to be sure of than a list of what it should fear.
 */
private val BROWSERS = setOf(
  // The car.
  "com.google.android.projection.gearhead",
  // The watch.
  "com.google.android.wearable.app",
  "com.google.android.wearable.media.sessions",
  // The assistant, which is also what a squeezed phone or a headset button
  // reaches when it is asked to play something.
  "com.google.android.googlequicksearchbox",
  // The shade and the lock screen.
  "com.android.systemui",
  // A head unit or a pair of headphones talking over Bluetooth.
  "com.android.bluetooth"
)

/**
 * Owns the ExoPlayer instance and publishes it as a media session.
 *
 * Media3 runs this as a foreground service for as long as something is playing,
 * which is the only sanctioned way to keep audio alive in the background. It
 * also builds the media notification, and because the player holds the whole
 * queue the notification gets working next/previous buttons for free — that is
 * the entire reason the queue lives here rather than in JavaScript.
 */
class PlaybackService : MediaLibraryService() {
  private var mediaSession: MediaLibrarySession? = null
  private var crossfader: Crossfader? = null

  private val widgetHandler = Handler(Looper.getMainLooper())
  private val widgetTick = object : Runnable {
    override fun run() {
      val player = mediaSession?.player ?: return
      if (!player.isPlaying) return
      if (getSystemService(PowerManager::class.java).isInteractive && JukeboxWidget.hasWidgets(this@PlaybackService)) {
        JukeboxWidget.progress(this@PlaybackService, player.currentPosition, player.duration)
      }
      widgetHandler.postDelayed(this, 1000)
    }
  }

  /**
   * Covers are read out of the audio files themselves, which means opening and
   * parsing them — not something to do on the thread playback is driven from.
   * One thread, so a burst of skips resolves in order and the last one wins.
   */
  private val artworkReader = Executors.newSingleThreadExecutor()

  /**
   * Keeps the home screen widget in step with playback.
   *
   * The widget is drawn by the launcher from a written-down snapshot, so
   * something has to do the writing, and the player is the only thing that
   * knows. Both events matter and neither implies the other: a track can change
   * while paused, and play/pause moves without the track changing.
   */
  /**
   * Writes the queue down when it changes, and not on the thread playback runs
   * on.
   *
   * It used to be saved from `publish`, which fires on every playback event —
   * a play, a pause, a seek, a metadata update. Each one serialised the whole
   * queue, up to two thousand entries, to JSON and wrote it to disk on the main
   * looper: the same thread Media3 and every transport command use. Only a
   * timeline change can alter what is in the queue, so that is the only thing
   * worth writing for.
   */
  private fun saveQueue() {
    val player = mediaSession?.player ?: return
    val snapshot = QueueStore.snapshot(player)
    artworkReader.execute { QueueStore.save(this, snapshot) }
  }

  private val widgetWatcher = object : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) {
      if (events.contains(Player.EVENT_TIMELINE_CHANGED)) saveQueue()
      if (events.containsAny(Player.EVENT_MEDIA_ITEM_TRANSITION, Player.EVENT_IS_PLAYING_CHANGED,
          Player.EVENT_POSITION_DISCONTINUITY, Player.EVENT_TIMELINE_CHANGED,
          Player.EVENT_PLAYBACK_STATE_CHANGED, Player.EVENT_MEDIA_METADATA_CHANGED)) publish()
    }
  }

  /**
   * Puts the player back on its feet after a fault, here rather than in the app.
   *
   * A playback error leaves the player idle, and this service outlives the app
   * that started it — so a fault that arrives while nothing is on screen has
   * nobody to answer it, and closing the app and opening it again reaches the
   * same wedged player it left behind. From the outside that is an app which
   * has simply stopped making any sound, and the only cure is force-stopping
   * it, which no one should have to know to do.
   *
   * Preparing again rebuilds the renderers, which is what a fault in the audio
   * chain needs; the position is put back so the recovery is heard as a hiccup
   * rather than a track starting over. Bounded, and counted per item, because
   * a file that cannot be decoded at all would otherwise be retried forever —
   * two goes, then it is left alone and reported, which is the existing
   * behaviour for a track that genuinely cannot play.
   */
  private val faultRecovery = object : Player.Listener {
    private var tries = 0
    private var triedFor = -1

    override fun onPlayerError(error: PlaybackException) {
      val player = mediaSession?.player ?: return

      if (player.currentMediaItemIndex != triedFor) {
        triedFor = player.currentMediaItemIndex
        tries = 0
      }
      if (tries >= MAX_RECOVERY_TRIES) return
      tries += 1

      val resumeAt = player.currentPosition.coerceAtLeast(0)
      val wasPlaying = player.playWhenReady
      player.prepare()
      if (resumeAt > 0) player.seekTo(resumeAt)
      player.playWhenReady = wasPlaying
    }

    override fun onPlaybackStateChanged(state: Int) {
      // Whatever it was, it is playing again; the next fault starts afresh.
      if (state == Player.STATE_READY) tries = 0
    }
  }

  private fun publish() {
    val player = mediaSession?.player ?: return
    val metadata = player.mediaMetadata
    val trackId = player.currentMediaItem?.mediaId

    val state = NowPlaying(
      trackId = trackId,
      title = metadata.title?.toString(),
      artist = metadata.artist?.toString(),
      playing = player.isPlaying,
      // Carried over so the cover does not blink away and back on every
      // pause while the same track is loaded.
      artworkPath = NowPlaying.read(this)
        .takeIf { it.trackId == trackId }
        ?.artworkPath,
      live = true,
      positionMs = player.currentPosition.coerceAtLeast(0),
      durationMs = player.duration.coerceAtLeast(0)
    )

    NowPlaying.write(this, state)
    JukeboxWidget.refresh(this)
    widgetHandler.removeCallbacks(widgetTick)
    if (player.isPlaying) widgetHandler.postDelayed(widgetTick, 1000)

    if (trackId != null && state.artworkPath == null) {
      resolveArtwork(trackId, metadata.artworkUri)
    }
  }

  /**
   * Finds a cover for the widget, preferring the one inside the file.
   *
   * [downloaded] is whatever a lookup found for this track, already on disk and
   * free to use — but second in line, because the picture stored in the file is
   * the one the rest of the app shows, and the widget disagreeing with the
   * player about which cover a song has would be worse than a plain square.
   */
  private fun resolveArtwork(trackId: String, downloaded: Uri?) {
    artworkReader.execute {
      val path = MediaStoreLibrary.embeddedArtwork(this, trackId)
        ?.let { runCatching { Uri.parse(it).path }.getOrNull() }
        ?: downloaded?.path?.takeIf { java.io.File(it).isFile }
        ?: expo.modules.jukeboxaudio.downloads.DownloadStore.artwork(this, trackId)?.let { Uri.parse(it).path }
        ?: return@execute

      // The track may have moved on while the file was being read; a cover
      // belongs to the track it came from, not to whatever is playing now.
      widgetHandler.post {
        if (mediaSession == null) return@post
        val current = NowPlaying.read(this)
        if (current.trackId != trackId) return@post
        NowPlaying.write(this, current.copy(artworkPath = path,
          positionMs = mediaSession!!.player.currentPosition.coerceAtLeast(0),
          durationMs = mediaSession!!.player.duration.coerceAtLeast(0)))
        JukeboxWidget.refresh(this)
      }
    }
  }

  /**
   * The audio session every effect is hung off.
   *
   * Generated here and given to the player rather than read back from it. An
   * id ExoPlayer picks for itself can change when the audio sink is rebuilt —
   * a route change, a format the previous sink could not take — and an
   * equalizer attached to the old one goes on filtering nothing. Choosing it
   * up front makes it a constant for the life of the service, so there is one
   * attach and no listener watching for it to move.
   *
   * setAudioSessionId is @UnstableApi, which is what the opt-in below covers;
   * the media3 version is pinned, which is the containment for that.
   */
  @OptIn(UnstableApi::class)
  override fun onCreate() {
    super.onCreate()

    val audioSessionId = getSystemService(AudioManager::class.java).generateAudioSessionId()

    /*
      The fader the whole output passes through. Built before the player
      because it has to be inside the player's audio pipeline, which is what
      makes a fade sample-accurate rather than a timer turning the volume down.
    */
    // Read before the sink is built, so a service started by a widget press
    // comes up sounding the way it was left rather than flat.
    expo.modules.jukeboxaudio.effects.Effects.load(this)

    val fade = FadeGainProvider()

    val player = ExoPlayer.Builder(this, FadingRenderersFactory(this, fade))
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
          .build(),
        // Let ExoPlayer request audio focus so playback ducks for navigation
        // prompts and pauses when another app takes over.
        /* handleAudioFocus = */ true
      )
      // Pause when headphones are unplugged instead of blasting the speaker.
      .setHandleAudioBecomingNoisy(true)
      .build()
      .also { it.audioSessionId = audioSessionId }

    // Before anything is prepared, so the first note out is already shaped the
    // way the user left it rather than a second of flat sound then a jump.
    AudioEffects.attach(this, audioSessionId)

    val transitions = Crossfader(this, player, fade, audioSessionId)
    transitions.settings = TransitionStore.read(this)
    player.addListener(transitions)
    crossfader = transitions
    Crossfades.register(transitions)

    /*
      The session is given the wrapper rather than the player. Every transport
      command in the app arrives through the session — from the notification,
      the widget, a headset, the car — so this is the one place that catches
      all of them, and the only place the fades have to be woven in.
    */
    mediaSession = MediaLibrarySession.Builder(this, FadingPlayer(player, transitions), browsing)
      .apply { launchAppIntent()?.let { setSessionActivity(it) } }
      .build()

    player.addListener(widgetWatcher)
    player.addListener(faultRecovery)
    publish()
    saveQueue()
  }

  /**
   * Tapping the notification should reopen the app rather than do nothing.
   *
   * There is no guarantee the app has a launcher entry to reopen — a disabled
   * install or a restricted profile has none — and PendingIntent.getActivity
   * refuses a null intent, which would take service creation down and with it
   * every bit of playback.
   */
  private fun launchAppIntent(): PendingIntent? {
    val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    return PendingIntent.getActivity(
      this,
      0,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? =
    mediaSession

  /**
   * Whether a caller is one of the few things that ought to be browsing.
   *
   * This app itself, the system, and the handful of Google surfaces a media
   * app is expected to appear in -- the car, the watch, the assistant, the
   * notification shade, a Bluetooth head unit. Anything else is told no.
   */
  private fun mayBrowse(controller: MediaSession.ControllerInfo): Boolean =
    controller.uid == android.os.Process.myUid() ||
      controller.uid == android.os.Process.SYSTEM_UID ||
      controller.packageName == packageName ||
      controller.packageName in BROWSERS

  /**
   * The library as something that browses it can see.
   *
   * A head unit never draws this app's screens: it asks for a tree and renders
   * that itself, to its own rules about what a driver may be shown. So the
   * whole of car support is answering these three questions, and none of it
   * touches anything the phone displays.
   */
  private val browsing = object : MediaLibrarySession.Callback {
    /**
     * Who is allowed to ask.
     *
     * The service is exported, and has to be: a car cannot bind to something
     * private, and that export is the whole of what makes Android Auto work.
     * But Media3's own answer to a connection, if nobody overrides it, is yes
     * to everyone -- so any installed app, holding no permission whatsoever,
     * could bind here, walk the tree below and read the entire library back,
     * listening history and all. Browsing does not look like a sensitive
     * operation, which is exactly why it was worth closing: what it discloses
     * is what somebody listens to, and that is a more personal thing than a
     * list of filenames looks.
     *
     * A caller's package name is derived from its uid rather than from
     * anything it says about itself, and Android will not install two apps
     * under one name -- so a name on this list is the app that name belongs
     * to. The hole left is a phone where an impostor claimed one of these
     * names before the real app was ever installed, which is a device already
     * in trouble; closing that as well means pinning signing certificates,
     * and those rotate.
     */
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo
    ): MediaSession.ConnectionResult =
      if (mayBrowse(controller)) {
        MediaSession.ConnectionResult.AcceptedResultBuilder(session).build()
      } else {
        android.util.Log.i("JukeboxPlayback", "refused ${controller.packageName}")
        MediaSession.ConnectionResult.reject()
      }

    override fun onGetLibraryRoot(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      params: LibraryParams?
    ): ListenableFuture<LibraryResult<MediaItem>> =
      Futures.immediateFuture(
        LibraryResult.ofItem(BrowseTree.rootItem(this@PlaybackService), params)
      )

    override fun onGetChildren(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      parentId: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      /*
        A throw in here does not fail one folder, it drops the browser
        connection and the car says the app is not working. The media store
        query is the realistic thrower: a head unit can start this service on a
        boot where the app's own screens never ran, so the audio permission may
        not have been asked for yet. An empty folder is a far better answer than
        a dead connection.
      */
      val items = runCatching { BrowseTree.children(this@PlaybackService, parentId) }
        .getOrElse { emptyList() }
      return Futures.immediateFuture(
        LibraryResult.ofItemList(ImmutableList.copyOf(items), params)
      )
    }

    override fun onGetItem(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      mediaId: String
    ): ListenableFuture<LibraryResult<MediaItem>> {
      // Guarded for the same reason as the children above: the lookup reads the
      // media store, and a throw here would take the whole browser down with it.
      val (items, index) = runCatching { BrowseTree.resolve(this@PlaybackService, mediaId) }
        .getOrElse { emptyList<MediaItem>() to 0 }
      val found = items.getOrNull(index)
      return Futures.immediateFuture(
        if (found == null) LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE)
        else LibraryResult.ofItem(found, null)
      )
    }

    /**
     * Choosing a track in a car queues what it was found in, starting there.
     *
     * What comes back from a head unit is an id and not much else, so the
     * record or list it was chosen from is read back out of that id — which is
     * why it was put there. Playing the one track alone would leave a car with
     * nothing to follow it.
     */
    override fun onSetMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
      startIndex: Int,
      startPositionMs: Long
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      val chosen = mediaItems.firstOrNull()?.mediaId
      val passThrough = Futures.immediateFuture(
        MediaSession.MediaItemsWithStartPosition(mediaItems, startIndex, startPositionMs)
      )
      if (mediaItems.size != 1 || chosen == null) return passThrough

      /*
        Asked of the tree rather than decided here.

        This used to check the id began with the tree's own prefix for a track,
        which meant two files had to agree about what the tree can answer for.
        They stopped agreeing the moment a row was added that is not a track --
        "shuffle everything" -- and the symptom was the row doing nothing at
        all: an item with no address reached the player, which had nothing to
        open. The tree knows what it can resolve; nothing else needs to.
      */
      val (items, index) = runCatching {
        BrowseTree.resolve(this@PlaybackService, chosen)
      }.getOrElse { emptyList<MediaItem>() to 0 }

      if (items.isEmpty()) return passThrough
      return Futures.immediateFuture(
        MediaSession.MediaItemsWithStartPosition(items, index, 0)
      )
    }
  }

  /**
   * Puts the last queue back when a media button arrives at an empty player.
   *
   * This is what a widget press lands on after the app has been closed: the
   * service is created fresh, with a player holding nothing, and a play command
   * against an empty queue does nothing at all. Loading the saved queue first
   * means the command has something to act on, and the key event that follows
   * starts it.
   *
   * Playing is asked for, and only where the queue had to be put back.
   *
   * It used to be left to the key event, on the grounds that a press of next
   * should not start music that was not playing. That reasoning belonged to a
   * service started with `startService`, which nothing obliged to do anything.
   * The widget now has to start it in the foreground — Android refuses a
   * background start outright — and a service started that way has a few
   * seconds to post its notification or be killed. Playing is what posts it.
   *
   * It is also the better answer. Reaching a widget for next, after the app
   * has been closed, is asking to hear the next thing rather than to silently
   * move a bookmark.
   *
   * A queue that was already there is untouched, so none of this applies to
   * the ordinary case of a press while the music is running.
   */
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == Intent.ACTION_MEDIA_BUTTON && restoreQueueIfEmpty()) {
      mediaSession?.player?.playWhenReady = true
    }
    return super.onStartCommand(intent, flags, startId)
  }

  /** True when there was nothing loaded and the last queue was put back. */
  private fun restoreQueueIfEmpty(): Boolean {
    val player = mediaSession?.player ?: return false
    if (player.mediaItemCount > 0) return false

    val saved = QueueStore.load(this) ?: return false
    player.setMediaItems(saved.items, saved.index, saved.positionMs)
    player.prepare()
    return true
  }

  /**
   * Swiping the app away should not leave a dead notification behind, but it
   * should not stop music that is still playing either.
   *
   * super is deliberately not called. MediaSessionService's implementation
   * keeps playback only when `isPlaying()` is true, and `isPlaying()` is
   * narrower than the intent here: it also demands STATE_READY and no
   * suppression. A phone call holding transient audio focus leaves
   * playWhenReady true with playback suppressed, and the buffering window after
   * a skip is not READY, so in both cases super would pause every player and
   * stopSelf before this method ever got to look — losing the queue for music
   * that was supposed to come back. The guard below is the same policy, only
   * more permissive.
   *
   * The teardown is still Media3's. Doing it by hand looked simpler and was
   * wrong twice: stopForeground is ignored once Media3 has already detached
   * the notification, and stopSelf cannot destroy a service the app's own
   * MediaController still holds bound — so a pending user-engaged timeout
   * would survive and repost the notification for a service we believed we had
   * stopped. pauseAllPlayersAndStopSelf cancels that timeout as part of its
   * work.
   *
   * That method is @UnstableApi, which is why the opt-in is here. The risk it
   * warns about — the contract changing under us — is the same risk the pinned
   * media3 version in build.gradle already exists to contain.
   */
  @OptIn(UnstableApi::class)
  override fun onTaskRemoved(rootIntent: Intent?) {
    val player = mediaSession?.player
    if (player != null && player.playWhenReady && player.mediaItemCount > 0) return

    pauseAllPlayersAndStopSelf()
  }

  override fun onDestroy() {
    // Written before the player goes, so the widget stops offering controls for
    // a service that is about to stop existing.
    widgetHandler.removeCallbacksAndMessages(null)
    mediaSession?.player?.let { player ->
      NowPlaying.write(this, NowPlaying.read(this).copy(positionMs = player.currentPosition.coerceAtLeast(0),
        durationMs = player.duration.coerceAtLeast(0)))
    }
    NowPlaying.markStopped(this)
    JukeboxWidget.refresh(this)

    // Both let go before the player: the effects hold a native handle on that
    // player's session, and the crossfader may be holding a second player of
    // its own that nothing else knows about.
    Crossfades.register(null)
    crossfader?.release()
    crossfader = null
    AudioEffects.release()

    artworkReader.shutdown()
    mediaSession?.run {
      player.removeListener(widgetWatcher)
      player.release()
      release()
    }
    mediaSession = null
    super.onDestroy()
  }
}
