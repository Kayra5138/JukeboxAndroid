package expo.modules.jukeboxaudio.work

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

/**
 * Keeps a lookup going behind the screen: a run over the library's details,
 * covers or lyrics, which is JavaScript asking catalogues one question every
 * second or so for as long as the library is long.
 *
 * Without it the run stopped the moment the app went behind another or the
 * screen went off. Nothing cancelled it; Android stopped the timers it paces
 * itself by, and could freeze or end the process outright, so a library left
 * looking itself up overnight had got as far as wherever the phone was put
 * down. A service in front, with its notification, is what tells Android the
 * app is doing something somebody asked for, and a partial wake lock keeps
 * the processor on for it with the screen off.
 *
 * It does none of the work. JavaScript does, and says what to show: every
 * word here, the channel's name included, is handed over in the app's
 * language, because the service is up only while JavaScript is running and
 * talking to it. Its Stop is passed back to JavaScript, which stops the run as
 * the screen's Stop does, and puts the service away itself in any case, in
 * case nothing is listening.
 */
class LookupService : Service() {
  /** What the notification says, as JavaScript last put it. */
  data class Words(
    val channel: String,
    val title: String,
    val text: String,
    val stop: String,
    val done: Int,
    val total: Int,
  )

  companion object {
    private const val CHANNEL = "lookups"
    private const val NOTIFICATION = 2720
    private const val STOP = "expo.modules.jukeboxaudio.work.STOP"
    /**
     * How long the processor is held for each time the notification changes.
     * A run says how far it has got every few seconds, and sits out a minute
     * at most when a catalogue asks it to slow down, so this is only reached
     * when JavaScript has gone and nobody let go.
     */
    private const val HOLD_MS = 10 * 60 * 1000L

    @Volatile private var words: Words? = null
    @Volatile private var running: LookupService? = null
    /** The channel's name as last given, for a notification made after the run has ended. */
    @Volatile private var channelName = "Lookups"
    private val main by lazy { Handler(Looper.getMainLooper()) }

    /** Told when the notification's Stop is pressed. */
    @Volatile var onStop: (() -> Unit)? = null

    /**
     * Shows [said], starting the service where it is not up. False when
     * Android would not start it: a run begun from behind the screen, which
     * none is, since each is begun by a button. The run goes on regardless,
     * as it did before there was a service.
     */
    fun hold(context: Context, said: Words): Boolean {
      words = said
      if (said.channel.isNotEmpty()) channelName = said.channel
      running?.let {
        main.post { it.show() }
        return true
      }
      val app = context.applicationContext
      return try {
        app.startForegroundService(Intent(app, LookupService::class.java))
        true
      } catch (_: Exception) {
        false
      }
    }

    /** The run is over: the notification goes, and with it the hold on the processor. */
    fun release() {
      words = null
      /*
        Not stopped from here when it is still on its way up: a service started
        in front that is stopped before it has shown its notification is a crash.
        It finds nothing to say when it gets there, and goes by itself.
      */
      val service = running ?: return
      main.post { service.finish() }
    }
  }

  /**
   * The last start asked for. The service is put away by it, never by none:
   * stopped with no number while a later start is on its way, Android would
   * close the app for the foreground that start was owed and never got.
   */
  @Volatile private var latestStartId = 0

  private val awake by lazy {
    getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Jukebox:Lookup").apply { setReferenceCounted(false) }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    latestStartId = startId
    if (intent?.action == STOP) {
      onStop?.invoke()
      finish()
      return START_NOT_STICKY
    }
    val said = words
    try {
      // Promised to Android by startForegroundService, so made even for a run that has already ended.
      startForeground(NOTIFICATION, notification(said ?: Words("", "", "", "", 0, 0)), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } catch (_: Exception) {
      stopSelf(startId)
      return START_NOT_STICKY
    }
    if (said == null) {
      finish()
      return START_NOT_STICKY
    }
    running = this
    awake.acquire(HOLD_MS)
    // Let go of in the moment between the words being read and this being kept.
    if (words == null) finish()
    return START_NOT_STICKY
  }

  private fun show() {
    val said = words ?: return
    awake.acquire(HOLD_MS)
    runCatching { getSystemService(NotificationManager::class.java).notify(NOTIFICATION, notification(said)) }
  }

  private fun notification(said: Words): Notification {
    // Creating a channel that exists is how it is renamed, which is what a change of language needs.
    getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL, said.channel.ifEmpty { channelName }, NotificationManager.IMPORTANCE_LOW)
    )
    val builder = Notification.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle(said.title)
      .setContentText(said.text)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setProgress(said.total, said.done, said.total <= 0)
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      builder.setContentIntent(PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    if (said.stop.isNotEmpty()) {
      val stop = PendingIntent.getService(
        this, 1, Intent(this, LookupService::class.java).setAction(STOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      builder.addAction(Notification.Action.Builder(null, said.stop, stop).build())
    }
    return builder.build()
  }

  private fun finish() {
    if (running === this) running = null
    if (awake.isHeld) awake.release()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf(latestStartId)
  }

  /**
   * Android 15's daily allowance for a service of this kind has run out. The
   * run is not stopped for it: it goes on while the app is in front, as it
   * always could.
   */
  override fun onTimeout(startId: Int, fgsType: Int) {
    finish()
  }

  override fun onDestroy() {
    if (running === this) running = null
    if (awake.isHeld) awake.release()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
