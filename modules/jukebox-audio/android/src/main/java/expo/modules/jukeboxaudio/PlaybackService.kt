package expo.modules.jukeboxaudio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.view.KeyEvent
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import androidx.media3.session.LibraryResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.jukeboxaudio.auto.BrowseTree
import expo.modules.jukeboxaudio.loudness.Loudness
import expo.modules.jukeboxaudio.loudness.Normaliser
import expo.modules.jukeboxaudio.sleep.SleepTimer
import expo.modules.jukeboxaudio.sleep.SleepTimers
import expo.modules.jukeboxaudio.transitions.Crossfader
import expo.modules.jukeboxaudio.transitions.Crossfades
import expo.modules.jukeboxaudio.transitions.FadeGainProvider
import expo.modules.jukeboxaudio.transitions.FadingPlayer
import expo.modules.jukeboxaudio.transitions.FadingRenderersFactory
import expo.modules.jukeboxaudio.transitions.TransitionStore
import expo.modules.jukeboxaudio.transitions.WindDown
import expo.modules.jukeboxaudio.widget.JukeboxWidget
import expo.modules.jukeboxaudio.widget.NowPlaying
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

/**
 * How many times one item may be prepared again after a fault before it is
 * taken at its word. Two, because a fault in the audio chain clears on the
 * first retry and a file that cannot be decoded will not clear on any.
 */
private const val MAX_RECOVERY_TRIES = 2

/**
 * How long a media button is given to bring the service into the foreground by
 * playing before the service does it for itself; see `foregroundOwed`. Well
 * inside the ten seconds Android allows, and long enough that a press which
 * does start the music has always done so first.
 */
private const val FOREGROUND_OWED_AFTER_MS = 2_000L

/** Not Media3's own notification id, so removing this one leaves that one be. */
private const val FOREGROUND_OWED_ID = 1002

/**
 * How often the place in a track is noted while it plays; see `placeTick`.
 * What a kill mid-track can cost, set against a small write that often.
 */
private const val PLACE_EVERY_MS = 10_000L

/**
 * The mark Media3 puts on the stop key it sends when its notification is
 * swiped away.
 *
 * Not a public constant: it is read out of the library, which is one more
 * reason the media3 version in build.gradle is pinned. If an upgrade renames
 * it, a swipe goes back to stopping the player and no further -- the music
 * still stops, the service is only slower to go.
 */
private const val NOTIFICATION_DISMISSED = "androidx.media3.session.NOTIFICATION_DISMISSED_EVENT_KEY"

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
 * A note that the queue was just set by something other than the app.
 *
 * The app keeps its own copy of the queue and edits the two together, which
 * works for as long as it is the only one editing. A car choosing a record, or
 * a press of play putting the saved queue back, sets one here that the app was
 * never shown -- and its screens then go on reading the player's positions off
 * a list the player no longer holds. A changed queue looks the same from the
 * controller's side whoever changed it, so the ones that were not the app's
 * doing are marked on the way in, and the controller passes the news on.
 *
 * The same arrangement as [Crossfades], for the same reason: the service and
 * the module share a process, and this is the gap between them.
 */
object QueueReplaced {
  /** Beyond this the mark belongs to an earlier change, not the one being reported. */
  private const val WINDOW_MS = 3_000L

  @Volatile private var at = 0L

  fun mark() {
    at = android.os.SystemClock.elapsedRealtime()
  }

  /** True once per replacement, and false for every change the app made itself. */
  @Synchronized
  fun justHappened(): Boolean {
    val marked = at
    if (marked == 0L || android.os.SystemClock.elapsedRealtime() - marked > WINDOW_MS) return false
    at = 0L
    return true
  }
}

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
  private var sleepTimer: SleepTimer? = null
  private var normaliser: Normaliser? = null

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

  /**
   * Writes down where in the queue playback is, which is a different matter
   * from what is in it.
   *
   * The reasoning above was right about the list and wrong about the place:
   * the two were one file, so not writing on a pause or a change of track
   * meant the place was never written at all after the queue was set. A
   * service reclaimed while paused then came back, at a press of play, on
   * whatever track the queue had been started with. The place is a few dozen
   * bytes in a file of its own, so it can be written whenever it moves without
   * bringing the two thousand entries along.
   *
   * Only the newest is kept waiting. Dragging a seek bar is a seek per frame,
   * and the reader of covers shares this thread; there is no use in writing
   * forty places it has already left.
   */
  private val pendingPlace = AtomicReference<String?>(null)

  private fun savePlace() {
    val player = mediaSession?.player ?: return
    val place = QueueStore.place(player)
    if (place.isEmpty()) return
    if (pendingPlace.getAndSet(place) != null) return
    runCatching {
      artworkReader.execute { pendingPlace.getAndSet(null)?.let { QueueStore.savePlace(this, it) } }
    }
  }

  /**
   * Notes the place every so often while something is playing.
   *
   * Nothing happens during a track for the events to report, and a process
   * that is killed is not asked first. Without this a kill half an hour into a
   * mix would come back at the start of it; with it, at most this far back.
   */
  private val placeTick = object : Runnable {
    override fun run() {
      val player = mediaSession?.player ?: return
      if (!player.isPlaying) return
      savePlace()
      widgetHandler.postDelayed(this, PLACE_EVERY_MS)
    }
  }

  private val widgetWatcher = object : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) {
      if (events.contains(Player.EVENT_TIMELINE_CHANGED)) saveQueue()
      // Everything that moves the place by more than playing does: a new
      // track, a seek, a pause, the end of the queue. A changed list is here
      // too, because the place that was noted belonged to the old one.
      if (events.containsAny(Player.EVENT_MEDIA_ITEM_TRANSITION, Player.EVENT_IS_PLAYING_CHANGED,
          Player.EVENT_POSITION_DISCONTINUITY, Player.EVENT_TIMELINE_CHANGED,
          Player.EVENT_PLAYBACK_STATE_CHANGED)) savePlace()
      if (events.contains(Player.EVENT_IS_PLAYING_CHANGED)) {
        widgetHandler.removeCallbacks(placeTick)
        if (player.isPlaying) widgetHandler.postDelayed(placeTick, PLACE_EVERY_MS)
      }
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
   * Finds a cover for the widget, in the order the app's own screens do: the
   * one kept for the track, then the one inside the file, then what a download
   * came with. The widget disagreeing with the player about which cover a song
   * has would be worse than a plain square.
   */
  private fun resolveArtwork(trackId: String, downloaded: Uri?) {
    artworkReader.execute {
      // The cover the app keeps for the track first, as every screen of the
      // app does. It used to arrive here as [downloaded], and no longer does:
      // a queue item's cover is an address for other apps now, not a file.
      val path = expo.modules.jukeboxaudio.auto.LibraryDatabase.cover(this, trackId)
        ?.let { runCatching { Uri.parse(it).path }.getOrNull() }?.takeIf { java.io.File(it).isFile }
        ?: MediaStoreLibrary.embeddedArtwork(this, trackId)
        ?.let { runCatching { Uri.parse(it).path }.getOrNull() }
        ?: downloaded?.takeIf { it.scheme == "file" }?.path?.takeIf { java.io.File(it).isFile }
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

    /*
      Let go of the foreground as soon as the music is paused.

      Media3 holds the service in the foreground for ten minutes after a pause,
      and a notification that belongs to a foreground service cannot be swiped
      away. So for ten minutes after pausing, the player in the shade could not
      be got rid of, which is exactly when somebody wants to: they have stopped
      listening. Released at once, it can be swiped the moment it is paused.

      What the ten minutes were buying is a process the system will not reclaim
      while paused. That is given up, and it is safe to, though only because of
      what is written down and when: the queue whenever it changes, and the
      place in it on every pause, seek and change of track and every few
      seconds in between (see savePlace). A pause is therefore on disk before
      the foreground is let go, and a press of play that finds the service gone
      starts it again and puts both back (see onStartCommand).
    */
    setForegroundServiceTimeoutMs(0)

    /*
      No notification for a player that has been stopped.

      Left to itself Media3 keeps one up after a stop unless it was swiped
      away, and it forgets the swipe the moment it hears from a player that
      is not yet idle. A swipe arrives as a pause and then a stop, so the
      pause wiped the mark the swipe had just made, the stop found none, and
      the notification was posted again: one swipe to stop, a second to be
      rid of it. Stopped is stopped; there is nothing for it to offer.
    */
    setShowNotificationForIdlePlayer(SHOW_NOTIFICATION_FOR_IDLE_PLAYER_NEVER)

    val audioSessionId = getSystemService(AudioManager::class.java).generateAudioSessionId()

    /*
      The fader the whole output passes through. Built before the player
      because it has to be inside the player's audio pipeline, which is what
      makes a fade sample-accurate rather than a timer turning the volume down.
    */
    // Read before the sink is built, so a service started by a widget press
    // comes up sounding the way it was left rather than flat.
    expo.modules.jukeboxaudio.effects.Effects.load(this)
    // The same for the equalizer, which is a stage of that pipeline now. The
    // first time after an update this is also where what was set on the
    // phone's own equalizer is carried over; see [EffectsStore.parametric].
    AudioEffects.load(this)

    // The sleep timer's ramp is in the same fader, for the same reason: see
    // [WindDown].
    val windDown = WindDown()
    val fade = FadeGainProvider(windDown)

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
      The sleep timer, on the player itself and not on the session. Nothing
      that reaches the session has any business with it -- the car, the widget
      and the notification are given no timer to set -- and what it does when
      it fires is a plain pause that all of them see like any other.
    */
    sleepTimer = SleepTimer(player, transitions, windDown).also {
      player.addListener(it)
      SleepTimers.register(it)
    }

    /*
      Evening the tracks out, on the player itself for the same reason: it
      has to work for a queue the app never saw, so it watches the one thing
      every queue goes through. It reads its own setting off the disk.
    */
    normaliser = Normaliser(this, player).also {
      player.addListener(it)
      Loudness.register(it)
      it.refresh()
    }

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
    speak()
    Localised.watch(languageChanged)
    publish()
    /*
      Nothing is saved here, and something used to be. The player is empty at
      this point by construction, so what was written was an empty queue over
      the one being kept for exactly this moment -- on the writer's thread, in
      a race with the read in onStartCommand that the read usually won, and
      with the car's "Continue", which comes seconds later, never.
    */
  }

  /**
   * Puts the notification into the app's language.
   *
   * Media3 draws the notification, and reads its words — the name of its
   * channel, what each button is called — from whatever context its provider
   * was built with. Left to make its own it uses the application's, which
   * answers in the phone's language. So it is handed one built on a context
   * that answers in the app's, and handed another whenever that changes.
   *
   * The channel is named here as well as there because the provider only
   * names a channel it has to create; one that exists keeps the name it was
   * given, and creating it again under a new name is how Android renames it.
   */
  @OptIn(UnstableApi::class)
  private fun speak() {
    val words = Localised.context(this)
    runCatching {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(
          DefaultMediaNotificationProvider.DEFAULT_CHANNEL_ID,
          words.getString(R.string.jukebox_playback_channel),
          NotificationManager.IMPORTANCE_LOW
        )
      )
      setMediaNotificationProvider(
        DefaultMediaNotificationProvider.Builder(words)
          .setChannelName(R.string.jukebox_playback_channel)
          .build()
      )
    }.onFailure { android.util.Log.w("JukeboxPlayback", "could not name the notification", it) }
  }

  /**
   * The language was changed while this was running.
   *
   * The notification is drawn again, and a car is told that every node whose
   * words are this side's has changed, which is what makes it ask for them
   * again: it otherwise keeps the tabs as it was first told them for as long
   * as it stays connected. Song titles and the names of records are not
   * words of ours and do not change.
   */
  @OptIn(UnstableApi::class)
  private val languageChanged: () -> Unit = {
    speak()
    mediaSession?.let { session ->
      runCatching { onUpdateNotification(session, false) }
      BrowseTree.SPOKEN.forEach { node ->
        runCatching { session.notifyChildrenChanged(node, Int.MAX_VALUE, null) }
      }
    }
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
      // An order was just chosen for a shelf, and the car is still holding the
      // shelf's own tab the way it was. Told, it asks for it again.
      BrowseTree.refreshes(parentId)?.let { tab ->
        runCatching { session.notifyChildrenChanged(tab, Int.MAX_VALUE, null) }
      }
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
     * A car's search, typed or spoken.
     *
     * Asked in two steps because that is how the car asks: it says what it is
     * looking for and is told how many there are, then comes back for them.
     * Answering the first is what puts a search button on the screen at all.
     * A throw is an empty answer here for the same reason as everywhere else
     * in this callback: it would otherwise take the whole connection down.
     */
    override fun onSearch(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      query: String,
      params: LibraryParams?
    ): ListenableFuture<LibraryResult<Void>> {
      val count = runCatching { BrowseTree.search(this@PlaybackService, query).size }.getOrDefault(0)
      runCatching { session.notifySearchResultChanged(browser, query, count, params) }
      return Futures.immediateFuture(LibraryResult.ofVoid())
    }

    override fun onGetSearchResult(
      session: MediaLibrarySession,
      browser: MediaSession.ControllerInfo,
      query: String,
      page: Int,
      pageSize: Int,
      params: LibraryParams?
    ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
      val items = runCatching { BrowseTree.search(this@PlaybackService, query) }.getOrElse { emptyList() }
      return Futures.immediateFuture(LibraryResult.ofItemList(ImmutableList.copyOf(items), params))
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
        "Continue": whatever was playing, from where it was left.

        Answered here and not by the tree, because here is where the queue is.
        A player that still holds one is asked for it as it stands. One that
        was closed since is given the queue that was written down as it
        changed. With neither there is nothing to carry on with, and the tree
        answers with something to play anyway.
      */
      if (chosen == BrowseTree.CONTINUE) {
        val player = mediaSession.player
        if (player.mediaItemCount > 0) {
          val held = List(player.mediaItemCount) { player.getMediaItemAt(it) }
          return Futures.immediateFuture(
            MediaSession.MediaItemsWithStartPosition(
              held, player.currentMediaItemIndex, player.currentPosition.coerceAtLeast(0)
            )
          )
        }
        QueueStore.load(this@PlaybackService)?.let { saved ->
          QueueReplaced.mark()
          return Futures.immediateFuture(
            MediaSession.MediaItemsWithStartPosition(saved.items, saved.index, saved.positionMs)
          )
        }
      }

      /*
        Asked for by voice: "play such-and-such". It arrives as one item with
        no id and the words that were said, and the best answer is the songs
        those words find, the likeliest first. Said with no words at all it is
        "play some music", which the same tile as above already means.
      */
      val spoken = mediaItems.first().requestMetadata.searchQuery
      if (chosen.isEmpty() && spoken != null) {
        val found = runCatching {
          if (spoken.isBlank()) BrowseTree.resolve(this@PlaybackService, BrowseTree.CONTINUE).first
          else BrowseTree.search(this@PlaybackService, spoken)
        }.getOrElse { emptyList() }
        if (found.isNotEmpty()) {
          QueueReplaced.mark()
          return Futures.immediateFuture(
            MediaSession.MediaItemsWithStartPosition(found.map(BrowseTree::queued), 0, 0)
          )
        }
      }

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
      /*
        Into the queue under the tracks' own ids, not the ones the tree gave
        the car. Those carry the shelf a row was found on, which was needed to
        get this far and is in the way from here on: the widget asked for the
        cover of a track called `t|albums|42` and was told there was none, and
        the app was told that was what had started playing.
      */
      QueueReplaced.mark()
      return Futures.immediateFuture(
        MediaSession.MediaItemsWithStartPosition(items.map(BrowseTree::queued), index, 0)
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
   * Not for a pause, though. The widget draws its button from what was last
   * written down, and a process killed mid-song leaves "playing" written: the
   * press that follows is a pause sent to a service with nothing running, and
   * starting the music in order to stop it again is nobody's idea of pausing.
   *
   * A queue that was already there is untouched, so none of this applies to
   * the ordinary case of a press while the music is running.
   *
   * Playing is not the only way a press can end, and the obligation above
   * does not care how it ends: see [foregroundOwed] for the ones that end
   * with nothing playing.
   */
  @OptIn(UnstableApi::class)
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    /*
      Swiping the notification away closes the music.

      Media3 sends the swipe here as a stop key with a mark on it, and stops
      the player. That is half of closing: the service would live on with
      nothing to do, holding the session open and the widget's controls lit.
      So the service is stopped as well, and a swipe is never taken for a
      press that wants the last queue put back.

      Only stopped, and not with pauseAllPlayersAndStopSelf, which looks like
      the same thing said properly. That one redraws the notification first,
      and it would do it here before Media3 has got round to the stop key: the
      player still looks ready and nothing is marked as swiped, so the
      notification that was just thrown away is posted again, and it took a
      second swipe to be rid of it. There is nothing left for it to pause
      anyway. A notification can only be swiped once the music is paused.
    */
    val dismissed = intent?.getBooleanExtra(NOTIFICATION_DISMISSED, false) == true
    if (dismissed) {
      val result = super.onStartCommand(intent, flags, startId)
      stopSelf()
      return result
    }

    if (intent?.action == Intent.ACTION_MEDIA_BUTTON) {
      @Suppress("DEPRECATION")
      val key = intent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT)?.keyCode
      if (restoreQueueIfEmpty() && key != KeyEvent.KEYCODE_MEDIA_PAUSE) {
        mediaSession?.player?.playWhenReady = true
      }
      // Not pushed back by a second press: the clock Android is running
      // started at the first.
      if (!widgetHandler.hasCallbacks(foregroundOwed)) {
        widgetHandler.postDelayed(foregroundOwed, FOREGROUND_OWED_AFTER_MS)
      }
    }
    return super.onStartCommand(intent, flags, startId)
  }

  /**
   * Keeps the promise a foreground start makes, where playing has not kept it.
   *
   * A media button reaches this service through `startForegroundService` --
   * from the widget always, and from a headset when nothing is running -- and
   * Android then expects `startForeground` within ten seconds or kills the
   * whole process, music and app and all. Media3 only goes into the foreground
   * for a player that is playing, and with the timeout above set to nothing it
   * leaves again the moment one is paused. So every press that does not end in
   * music was a crash on a ten second fuse: next or previous while paused, any
   * key with no queue to put back, a pause sent to a service that had gone.
   *
   * Checked a moment after the press rather than at it, and that is on
   * purpose. A press that does start the music is left exactly as it was,
   * which is the path that has always worked; this only acts where nothing
   * else is going to. What it does there is the least that counts: into the
   * foreground behind a notification of its own and straight back out, taking
   * that notification with it. Android holds a plain notification back for
   * some seconds before drawing it, so this one is gone before it is seen.
   * Media3's own, which may be sitting in the shade for the paused player, has
   * a different id and is not touched.
   *
   * Guarded because the allowance is the system's to give. A press that came
   * by an ordinary start owes nothing and may not be permitted this either;
   * refused, it has lost nothing.
   */
  @OptIn(UnstableApi::class)
  private val foregroundOwed = Runnable {
    // In the foreground already, which is to say playing. Nothing is owed.
    if (mediaSession == null || isPlaybackOngoing) return@Runnable
    runCatching {
      // Media3's channel, made here in case this arrives before it has had a
      // notification of its own to make it for. A second one would be a second
      // row in the app's settings for something nobody is meant to see.
      val channel = DefaultMediaNotificationProvider.DEFAULT_CHANNEL_ID
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(
          channel,
          Localised.text(this, R.string.jukebox_playback_channel),
          NotificationManager.IMPORTANCE_LOW
        )
      )
      startForeground(
        FOREGROUND_OWED_ID,
        Notification.Builder(this, channel)
          .setSmallIcon(androidx.media3.session.R.drawable.media3_notification_small_icon)
          .setContentTitle(applicationInfo.loadLabel(packageManager))
          .build(),
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
      stopForeground(STOP_FOREGROUND_REMOVE)
    }.onFailure { android.util.Log.w("JukeboxPlayback", "could not answer a foreground start", it) }
  }

  /** True when there was nothing loaded and the last queue was put back. */
  private fun restoreQueueIfEmpty(): Boolean {
    val player = mediaSession?.player ?: return false
    if (player.mediaItemCount > 0) return false

    val saved = QueueStore.load(this) ?: return false
    QueueReplaced.mark()
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
    // The last word on where playback was. The writer is shut down below, and
    // shutting it down lets what it has already been given finish.
    savePlace()
    mediaSession?.player?.let { player ->
      NowPlaying.write(this, NowPlaying.read(this).copy(positionMs = player.currentPosition.coerceAtLeast(0),
        durationMs = player.duration.coerceAtLeast(0)))
    }
    NowPlaying.markStopped(this)
    JukeboxWidget.refresh(this)
    Localised.unwatch(languageChanged)

    // Both let go before the player: the effects hold a native handle on that
    // player's session, and the crossfader may be holding a second player of
    // its own that nothing else knows about.
    // The timer first of the three, because it speaks to the other two.
    SleepTimers.register(null)
    sleepTimer?.release()
    sleepTimer = null
    Crossfades.register(null)
    crossfader?.release()
    crossfader = null
    Loudness.register(null)
    normaliser?.release()
    normaliser = null
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
