package expo.modules.jukeboxaudio

import android.Manifest
import android.net.Uri
import android.os.Build
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.jukeboxaudio.transitions.Crossfades
import expo.modules.jukeboxaudio.transitions.TransitionStore
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import java.lang.ref.WeakReference

/**
 * Where a backup's pictures wait between being opened and being imported.
 *
 * In the cache, so that a backup opened and then not imported costs nothing
 * that the system will not clear away by itself.
 */
private const val BACKUP_STAGING = "backup-import"

/** Permission that grants access to audio files created by other apps. */
private val AUDIO_PERMISSION =
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    Manifest.permission.READ_MEDIA_AUDIO
  } else {
    Manifest.permission.READ_EXTERNAL_STORAGE
  }

/** Shape Expo's permission helpers produce, for the versions that have nothing to ask. */
private val ALWAYS_GRANTED = mapOf(
  "status" to "granted",
  "expires" to "never",
  "granted" to true,
  "canAskAgain" to true
)

class JukeboxAudioModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var player: PlayerController? = null
  private var destroyed = false
  private var remover: AppContextActivityResultLauncher<DeleteRequest.Input, Boolean>? = null
  private var imagePicker: AppContextActivityResultLauncher<ImagePicker.Input, String?>? = null
  private var backupSave: AppContextActivityResultLauncher<BackupSave.Input, String?>? = null
  private var backupOpen: AppContextActivityResultLauncher<BackupOpen.Input, String?>? = null

  /**
   * Scanning a library, extracting a cover and downloading three hundred
   * megabytes all happen here rather than on the queue Expo hands out, which is
   * a single thread shared by every Expo module in the app. Left on it, one
   * download stalls the database, the position poll and every playback command
   * behind it — the seek bar freezes and play/pause stops answering.
   */
  private val io = CoroutineScope(Dispatchers.IO + SupervisorJob())

  override fun definition() = ModuleDefinition {
    Name("JukeboxAudio")
    Constant("buildTimestamp") { BuildConfig.BUILD_TIMESTAMP }

    Events("onTrackChange", "onPlaybackStateChange", "onQueueEnded", "onPlaybackError")

    OnCreate {
      destroyed = false
      // Held weakly on purpose. The listener lives for as long as the media
      // session does, so a direct reference would pin the module past its own
      // teardown; and release() is posted to the main thread, so there is a
      // window after OnDestroy in which a Media3 callback can still arrive.
      val self = WeakReference(this@JukeboxAudioModule)
      PlayerController(context) { name, payload ->
        self.get()?.takeUnless { it.destroyed }?.sendEvent(name, payload)
      }
        .also { player = it }
        .connect()
    }

    RegisterActivityContracts {
      imagePicker = registerForActivityResult(ImagePicker())
      backupSave = registerForActivityResult(BackupSave())
      backupOpen = registerForActivityResult(BackupOpen())
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        remover = registerForActivityResult(DeleteRequest())
      }
    }

    OnDestroy {
      destroyed = true
      player?.release()
      player = null
      imagePicker = null
      backupSave = null
      backupOpen = null
      io.cancel()
    }

    // ---- library ----

    AsyncFunction("getPermissionsAsync") { promise: Promise ->
      Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, AUDIO_PERMISSION)
    }

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, AUDIO_PERMISSION)
    }

    // Kept apart from the audio permission because they fail differently: no
    // audio permission means an empty library, while no notification permission
    // means a foreground service playing with no controls anywhere on screen.
    AsyncFunction("getNotificationPermissionsAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Permissions.getPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.POST_NOTIFICATIONS
        )
      } else {
        promise.resolve(ALWAYS_GRANTED)
      }
    }

    AsyncFunction("requestNotificationPermissionsAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Permissions.askForPermissionsWithPermissionsManager(
          appContext.permissions,
          promise,
          Manifest.permission.POST_NOTIFICATIONS
        )
      } else {
        promise.resolve(ALWAYS_GRANTED)
      }
    }

    AsyncFunction("queryTracksAsync") { rootFolder: String ->
      MediaStoreLibrary.queryTracks(context, rootFolder)
    }.runOnQueue(io)

    AsyncFunction("queryTrackAsync") { trackId: String, rootFolder: String ->
      MediaStoreLibrary.queryTrack(context, trackId, rootFolder)
    }.runOnQueue(io)

    /*
      The play-along chart for a song, made if it has not been made before.

      On the io queue because making one decodes the whole recording and looks
      at every window of it -- seconds of work, not milliseconds. Once made it
      is kept, so the second ask is a file read.
    */
    AsyncFunction("chartForAsync") { trackId: String ->
      expo.modules.jukeboxaudio.game.ChartStore.chart(context, trackId)
        ?.let { expo.modules.jukeboxaudio.game.ChartStore.asMap(it) }
    }.runOnQueue(io)

    /*
      Everything a run will want, found before the run rather than inside it.

      Opening an audio track talks to the mixer and finding the vibrator talks
      to the system server; both are trips out of this process, both are free
      afterwards, and paid at the first key they are a hitch a second or two
      into a song. Called when the screen appears, which is while somebody is
      still reading the setup page.
    */
    Function("prepareGame") {
      expo.modules.jukeboxaudio.game.Tap.ready()
      warmUp(context)
    }

    /*
      A run is on, or it is not.

      Nothing is done to the record either way. Three goes at answering a key
      with sound taught the same lesson three times -- a piano chord was in the
      wrong key, drums were a second drummer, and turning the song up and down
      was heard as the app being broken rather than as the game responding. The
      record is left alone; this only opens and closes the tap's own track.
    */
    Function("gameAudio") { on: Boolean ->
      if (on) {
        expo.modules.jukeboxaudio.game.Tap.ready()
        warmUp(context)
      } else {
        expo.modules.jukeboxaudio.game.Tap.close()
      }
    }

    /**
     * Something happened on the board: a key struck, nothing struck, or a key
     * let past.
     *
     * Three knocks rather than one, because those are three different facts and
     * a player should not have to read the screen to tell them apart. None of
     * them is a note -- see [expo.modules.jukeboxaudio.game.Tap].
     */
    Function("knocked") { kind: String ->
      expo.modules.jukeboxaudio.game.Tap.play(expo.modules.jukeboxaudio.game.Tap.of(kind))
    }

    /**
     * A key is being held down, or no longer is.
     *
     * The one board sound that lasts, so it is switched rather than played:
     * on when the first finger settles on a hold, off when the last one leaves.
     */
    Function("held") { on: Boolean ->
      expo.modules.jukeboxaudio.game.Tap.hold(on)
    }

    AsyncFunction("getAudioEffectsAsync") {
      expo.modules.jukeboxaudio.effects.Effects.load(context)
      expo.modules.jukeboxaudio.effects.Effects.asMap(
        expo.modules.jukeboxaudio.effects.Effects.settings()
      )
    }.runOnQueue(io)

    /*
      Stored as well as applied, and stored first: a widget press after the app
      has been killed brings the service up with no JavaScript anywhere, and it
      reads these off the disk. The running players need telling nothing — the
      processors read the settings on the next buffer.
    */
    AsyncFunction("setAudioEffectsAsync") { settings: Map<String, Any?> ->
      val wanted = expo.modules.jukeboxaudio.effects.Effects.fromMap(settings)
      expo.modules.jukeboxaudio.effects.Effects.apply(context, wanted)
      expo.modules.jukeboxaudio.effects.Effects.asMap(wanted)
    }.runOnQueue(io)

    AsyncFunction("coverColoursAsync") { path: String ->
      CoverColour.of(path)
    }.runOnQueue(io)

    AsyncFunction("saveImageAsync") { path: String ->
      ImageExport.save(context, java.io.File(Uri.parse(path).path ?: path)).toString()
    }.runOnQueue(io)

    /*
      Shared from the gallery copy rather than from the app's own file. Handing
      out a private file needs a provider of our own, and a picture shared to a
      chat and nowhere else is one that cannot be found again afterwards.
    */
    AsyncFunction("shareImageAsync") { path: String ->
      ImageExport.share(context, java.io.File(Uri.parse(path).path ?: path))
    }.runOnQueue(io)

    /**
     * Asks for a picture and keeps a copy of it.
     *
     * Answers with where the copy landed, or null if the user backed out. The
     * copy is the point: a picked uri's read grant dies with the task, and the
     * file behind it belongs to the user to move or delete, so a list wearing
     * one would lose its cover without anything having gone wrong.
     */
    AsyncFunction("pickImageAsync") Coroutine { ->
      val launcher = imagePicker ?: return@Coroutine null
      val picked = withContext(Dispatchers.Main) { launcher.launch(ImagePicker.Input()) }
        ?: return@Coroutine null
      // Anything thrown in here reaches the caller as a rejected promise,
      // which is the point: a picture that will not load has to say so.
      withContext(Dispatchers.IO) { ImagePicker.adopt(context, picked) }
    }

    // ---- backup ----

    /**
     * Saves a backup wherever the user says, and answers whether it was saved.
     *
     * [document] is the backup itself, already written out; [pictures] are the
     * names of the covers it refers to, which are looked for in the app's own
     * artwork folder and nowhere else. False means the user backed out of
     * choosing a place, which is not a failure and is not reported as one.
     */
    AsyncFunction("exportBackupAsync") Coroutine { name: String, document: String, pictures: List<String> ->
      val launcher = backupSave ?: return@Coroutine false
      val target = withContext(Dispatchers.Main) { launcher.launch(BackupSave.Input(name)) }
        ?: return@Coroutine false
      withContext(Dispatchers.IO) {
        val uri = android.net.Uri.parse(target)
        val home = java.io.File(context.filesDir, "album-artwork")
        val files = pictures.filter(BackupArchive::safeName).map { java.io.File(home, it) }
        try {
          val out = context.contentResolver.openOutputStream(uri, "w")
            ?: throw IllegalStateException("That place could not be written to.")
          out.use { BackupArchive.write(it, document, files) }
        } catch (trouble: Exception) {
          // A file with half a backup in it is worse than no file: it looks
          // like one, and would be found later by somebody who needed it.
          runCatching { android.provider.DocumentsContract.deleteDocument(context.contentResolver, uri) }
          throw trouble
        }
      }
      true
    }

    /**
     * Lets the user choose a backup and answers what is in it, or null if they
     * backed out.
     *
     * The pictures are unpacked to one side and not yet put anywhere they
     * would be used. Opening a backup is looking at it; nothing on the phone
     * changes until the import is confirmed, and [adoptBackupArtworkAsync] is
     * what moves them then.
     */
    AsyncFunction("openBackupAsync") Coroutine { ->
      val launcher = backupOpen ?: return@Coroutine null
      val picked = withContext(Dispatchers.Main) { launcher.launch(BackupOpen.Input()) }
        ?: return@Coroutine null
      withContext(Dispatchers.IO) {
        val staging = java.io.File(context.cacheDir, BACKUP_STAGING)
        staging.deleteRecursively()
        staging.mkdirs()
        val input = context.contentResolver.openInputStream(android.net.Uri.parse(picked))
          ?: throw IllegalStateException("That file could not be opened.")
        val document = input.use { BackupArchive.read(it, staging) }
        val home = java.io.File(context.filesDir, "album-artwork")
        mapOf(
          "json" to document,
          // With the slash, so a file name can simply be put on the end.
          "artworkHome" to android.net.Uri.fromFile(home).toString().trimEnd('/') + "/"
        )
      }
    }

    /**
     * Moves the named pictures from the backup just opened into the artwork
     * folder. One that is already there is left alone: covers are named after
     * their contents, so the same name is the same picture.
     */
    AsyncFunction("adoptBackupArtworkAsync") { names: List<String> ->
      val staging = java.io.File(context.cacheDir, BACKUP_STAGING)
      val home = java.io.File(context.filesDir, "album-artwork").apply { mkdirs() }
      for (name in names) {
        if (!BackupArchive.safeName(name)) continue
        val from = java.io.File(staging, name)
        val to = java.io.File(home, name)
        if (!from.isFile || (to.isFile && to.length() > 0)) continue
        val temporary = java.io.File.createTempFile("restored-", ".tmp", home)
        try {
          from.copyTo(temporary, overwrite = true)
          temporary.renameTo(to)
        } finally {
          temporary.delete()
        }
      }
      staging.deleteRecursively()
    }.runOnQueue(io)

    /**
     * Starts the app again from nothing.
     *
     * After an import everything the app holds in memory is about the data
     * that was there before: the queue, the lists on screen, what the player
     * thinks the settings are. Each of those could be told to read itself
     * again, and the first one forgotten would show the old data until it was
     * next opened. Starting again cannot forget one.
     */
    AsyncFunction("restartAsync") {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) {
        context.startActivity(android.content.Intent.makeRestartActivityTask(launch.component))
        Runtime.getRuntime().exit(0)
      }
    }

    /**
     * The click of a detent, for something that snaps.
     *
     * The platform's own tick rather than a duration: it is what every other
     * list that clicks under a finger uses, so it feels like the phone rather
     * than like this app buzzing. Falls back to the shortest buzz that can be
     * asked for where the effect is not available.
     */
    Function("tick") { buzz(context, android.os.VibrationEffect.EFFECT_TICK) }

    /**
     * The same thing with weight behind it, for a key going down.
     *
     * A detent's tick is right for a list snapping past under a thumb and far
     * too polite for a game: it is meant not to be noticed, and here the touch
     * is the only thing that answers immediately. The platform's heavy click is
     * the strongest effect it will name, so this is as much as can be asked for
     * without describing a buzz in milliseconds and having it feel like a
     * different phone on every handset.
     */
    Function("thump") { buzz(context, android.os.VibrationEffect.EFFECT_HEAVY_CLICK) }

    AsyncFunction("getEmbeddedArtworkAsync") { trackId: String ->
      expo.modules.jukeboxaudio.downloads.DownloadStore.artwork(context, trackId)
        ?: MediaStoreLibrary.embeddedArtwork(context, trackId)
    }.runOnQueue(io)

    AsyncFunction("downloadArtworkAsync") { url: String ->
      AlbumArtwork.download(context, url)
    }.runOnQueue(io)

    AsyncFunction("queryFoldersAsync") { rootFolder: String ->
      MediaStoreLibrary.queryFolders(context, rootFolder)
    }.runOnQueue(io)

    // ---- playback ----
    // Left on Expo's own queue: these are all a handful of instructions before
    // PlayerController hops to the main looper, which Media3 requires; callers
    // do not have to care which thread they are on.

    AsyncFunction("setQueueAsync") { tracks: List<Map<String, Any?>>, startIndex: Int, autoPlay: Boolean ->
      player?.setQueue(tracks, startIndex, autoPlay)
    }

    AsyncFunction("playAsync") {
      player?.play()
    }

    AsyncFunction("pauseAsync") {
      player?.withPlayer { it.pause() }
    }

    AsyncFunction("nextAsync") {
      player?.next()
    }

    AsyncFunction("previousAsync") {
      player?.previous()
    }

    AsyncFunction("skipToIndexAsync") { index: Int ->
      player?.skipToIndex(index)
    }

    AsyncFunction("seekToAsync") { seconds: Double ->
      player?.withPlayer { it.seekTo((seconds * 1000).toLong()) }
    }

    AsyncFunction("setShuffleAsync") { enabled: Boolean ->
      player?.withPlayer { it.shuffleModeEnabled = enabled }
    }

    AsyncFunction("insertIntoQueueAsync") { track: Map<String, Any?>, index: Int ->
      player?.insert(track, index)
    }

    AsyncFunction("moveInQueueAsync") { from: Int, to: Int ->
      player?.move(from, to)
    }

    AsyncFunction("removeFromQueueAsync") { index: Int ->
      player?.removeAt(index)
    }

    AsyncFunction("setPlaybackParamsAsync") { speed: Double, pitch: Double ->
      player?.setPlaybackParams(speed, pitch)
    }

    // ---- equalizer ----

    /**
     * Everything the equalizer screen draws itself from.
     *
     * One call rather than a getter per field, because the band count, the
     * level range and the current gains only make sense together: sliders
     * drawn from one device's ranges and another's values would be wrong in a
     * way nothing later could correct.
     */
    AsyncFunction("getEqualizerAsync") {
      AudioEffects.describe(context)
    }

    /**
     * Stores the whole setting and applies it.
     *
     * Whole rather than by field: the settings are one document on disk, and a
     * per-field write would have to read, change and write it back for every
     * band a drag crosses. Sending all of it costs a handful of numbers and
     * makes each call independent of the last.
     *
     * Answers with the state that resulted, which is not always the state that
     * was sent — a preset is a curve the device owns, and the bands it moves
     * to only become knowable afterwards.
     */
    AsyncFunction("setEqualizerAsync") { settings: Map<String, Any?> ->
      AudioEffects.update(
        context,
        EffectsStore.Settings(
          enabled = settings["enabled"] as? Boolean ?: false,
          preset = (settings["preset"] as? Number)?.toInt() ?: -1,
          bands = (settings["bands"] as? List<*>)?.map { (it as? Number)?.toInt() ?: 0 }
            ?: emptyList(),
          bass = (settings["bass"] as? Number)?.toInt() ?: 0,
          virtualizer = (settings["virtualizer"] as? Number)?.toInt() ?: 0,
          loudness = (settings["loudness"] as? Number)?.toInt() ?: 0
        )
      )
    }

    // ---- transitions ----

    AsyncFunction("getTransitionsAsync") {
      TransitionStore.toMap(TransitionStore.read(context))
    }

    /**
     * Stores the transition settings and puts them into effect.
     *
     * Stored first and separately from the player, because they have to hold
     * for a service that has not started yet: a widget press after the app is
     * gone brings playback up with no JavaScript in the process, and it reads
     * these off the disk.
     */
    AsyncFunction("setTransitionsAsync") { values: Map<String, Any?> ->
      val settings = TransitionStore.fromMap(values)
      TransitionStore.write(context, settings)
      Crossfades.apply(settings)
      TransitionStore.toMap(settings)
    }

    AsyncFunction("setRepeatModeAsync") { mode: String ->
      player?.setRepeatMode(mode)
    }

    AsyncFunction("getStatusAsync") { promise: Promise ->
      val controller = player
      if (controller == null) promise.resolve(mapOf("connected" to false))
      else controller.status { promise.resolve(it) }
    }

    /**
     * Erases tracks from the device, once the user has agreed to it.
     *
     * Answers with whether they did. A refusal is an ordinary outcome and not
     * an error: the caller has to leave the library alone either way until it
     * knows which happened.
     */
    AsyncFunction("deleteTracksAsync") Coroutine { ids: List<String> ->
      val launcher = remover
        ?: throw IllegalStateException("Deleting needs Android 11 or newer.")
      if (ids.isEmpty()) return@Coroutine false
      // Launching raises a system dialog, which is a main-thread affair.
      withContext(Dispatchers.Main) {
        launcher.launch(DeleteRequest.Input(ArrayList(ids)))
      }
    }

    AsyncFunction("shuffleQueueAsync") { order: List<String>?, promise: Promise ->
      val controller = player
      if (controller == null) promise.resolve(emptyList<Map<String, Any?>>())
      else controller.shuffleQueue(order) { promise.resolve(it) }
    }

    AsyncFunction("getQueueAsync") { promise: Promise ->
      val controller = player
      if (controller == null) promise.resolve(emptyList<Map<String, Any?>>())
      else controller.queue { promise.resolve(it) }
    }

  }
}

/**
 * The motor, found once.
 *
 * Asking the system for a service is a lookup and the first one is a trip out
 * of the process. Done per buzz it was being paid on every key of a rhythm
 * game, on the thread that must answer the next touch.
 */
private var motor: android.os.Vibrator? = null
private var motorFound = false

/**
 * Somewhere other than the thread the game runs on to do the buzzing.
 *
 * `vibrate` is a call into another process. Micro­seconds when that process is
 * idle and not always idle, and a game asks for one on every key — so it is
 * handed over rather than waited for. Nothing reads the result and a buzz that
 * arrives a millisecond late is a buzz; a frame that arrives late is a stutter.
 */
private val buzzer by lazy {
  java.util.concurrent.Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "jukebox-haptics").apply { isDaemon = true }
  }
}

private fun vibrator(context: android.content.Context): android.os.Vibrator? {
  if (!motorFound) {
    motorFound = true
    motor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      context.getSystemService(android.os.VibratorManager::class.java)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(android.os.Vibrator::class.java)
    }?.takeIf { it.hasVibrator() }
  }
  return motor
}

/**
 * One of the platform's named effects, if this phone has a motor at all.
 *
 * Named rather than described in milliseconds, so that a tick feels like the
 * tick everything else on the device makes. A duration would feel like a
 * different phone on every handset, since what a given number of milliseconds
 * does depends entirely on the motor behind it.
 */
private fun buzz(context: android.content.Context, effect: Int) {
  val found = vibrator(context) ?: return
  val shape = android.os.VibrationEffect.createPredefined(effect)
  buzzer.execute { runCatching { found.vibrate(shape) } }
}

/**
 * Everything a run will need, found before the first key rather than under it.
 *
 * All of this is cheap the second time and none of it is the first: a service
 * looked up across processes, an audio track opened with the mixer. Paid at
 * the start of a run they are nothing; paid on the third key of a song they
 * are the stutter somebody noticed.
 */
private fun warmUp(context: android.content.Context) {
  vibrator(context)
}
