package expo.modules.jukeboxaudio.downloads

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import expo.modules.jukeboxaudio.LibraryImport
import expo.modules.jukeboxaudio.Localised
import expo.modules.jukeboxaudio.R
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class DownloadService : Service() {
  private val executor = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())
  private val running = AtomicBoolean(false)
  private var latestStartId = 0
  private var lastNotification = 0L
  @Volatile private var stopping = false

  /** What the notification last said, so it can be said again in another language. */
  @Volatile private var showing: Pair<Int, Array<out Any?>> = R.string.jukebox_downloads_preparing to emptyArray<Any?>()
  @Volatile private var showingProgress = 0

  companion object {
    private const val CHANNEL = "youtube-downloads"
    private const val NOTIFICATION = 2719
    @Volatile private var currentId: String? = null
    @Volatile private var cancellation: AtomicBoolean? = null
    fun cancel(id: String) { if (currentId == id) cancellation?.set(true) }
  }

  override fun onCreate() {
    super.onCreate()
    nameChannel()
    Localised.watch(languageChanged)
  }

  /** Creating a channel that exists is how it is renamed, which is what a change of language needs. */
  private fun nameChannel() {
    getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL, Localised.text(this, R.string.jukebox_downloads_channel), NotificationManager.IMPORTANCE_LOW)
    )
  }

  /** The language changed with a download under way: the same line, in the new one. */
  private val languageChanged: () -> Unit = {
    runCatching {
      nameChannel()
      if (running.get() && !stopping) {
        getSystemService(NotificationManager::class.java)
          .notify(NOTIFICATION, notification(showing.first, *showing.second, progress = showingProgress))
      }
    }
  }

  private fun notification(words: Int, vararg with: Any?, progress: Int = 0): Notification {
    showing = words to with
    showingProgress = progress
    val builder = Notification.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle(Localised.text(this, R.string.jukebox_downloads_title))
      .setContentText(Localised.text(this, words, *with))
      .setOnlyAlertOnce(true).setOngoing(true)
      .setProgress(100, progress, progress == 0)
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      builder.setContentIntent(PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    return builder.build()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    latestStartId = startId
    try {
      startForeground(NOTIFICATION, notification(R.string.jukebox_downloads_preparing), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      DownloadStore.init(this)
      startWorker()
    } catch (error: Exception) {
      DownloadStore.failPending(Failure.SERVICE)
      stopSelf()
    }
    return START_NOT_STICKY
  }

  private fun startWorker() {
    if (stopping || !running.compareAndSet(false, true)) return
    executor.execute {
      try {
        while (!stopping) {
          val job = DownloadStore.takeNext() ?: break
          val id = job.getString("id")
          val cancelled = AtomicBoolean(DownloadStore.isCancelling(id))
          cancellation = cancelled
          currentId = id
          // Cancellation can arrive between takeNext and publishing currentId.
          if (DownloadStore.isCancelling(id)) cancelled.set(true)
          val directory = File(cacheDir, "youtube/$id")
          val wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Jukebox:YouTubeDownload")
          try {
            wakeLock.acquire(35 * 60 * 1000L)
            val video = job.getJSONObject("video")
            if (video.optBoolean("discoverWifiOnly") && DiscoverFiles.networkAllowed(this)["wifi"] != true) throw YouTubeTrouble(Failure.WAITING_WIFI)
            val progress: (String, Int) -> Unit = { state, percent ->
              if (video.optBoolean("discoverWifiOnly") && DiscoverFiles.networkAllowed(this)["wifi"] != true) cancelled.set(true)
              DownloadStore.change(id, state, percent)
              val now = android.os.SystemClock.elapsedRealtime()
              if (now - lastNotification > 1000) {
                lastNotification = now
                getSystemService(NotificationManager::class.java).notify(NOTIFICATION,
                  notification(
                    if (state == "converting") R.string.jukebox_downloads_converting else R.string.jukebox_downloads_downloading,
                    video.getString("title"), progress = percent))
              }
            }
            val (file, info) = YouTubeEngine.download(
              this, video.getString("id"), job.getString("format"), directory, cancelled, video, progress)
            if (cancelled.get() || !DownloadStore.beginSaving(id)) throw YoutubeCancelled()
            val trackId = if (!job.isNull("discoverKey")) {
              DiscoverFiles.store(this, id, file, info, job.getJSONObject("video"))
              "discover:$id"
            } else LibraryImport.fromDownload(this, file, job.getString("folder"),
              "${info.getString("title")}.${file.extension}") { trackId ->
                DownloadStore.reserve(id, trackId, info.optString("artworkUri").takeIf { it.startsWith("file://") })
              }
            DownloadStore.complete(id, trackId)
          } catch (error: Exception) {
            val waiting = job.getJSONObject("video").optBoolean("discoverWifiOnly") && DiscoverFiles.networkAllowed(this)["wifi"] != true
            val wasCancelled = !waiting && (cancelled.get() || error is YoutubeCancelled)
            DownloadStore.change(id, if (wasCancelled) "cancelled" else "failed",
              error = if (waiting) Failed(Failure.WAITING_WIFI) else if (wasCancelled) null else failed(error))
          } finally {
            if (wakeLock.isHeld) wakeLock.release()
            currentId = null
            cancellation = null
            directory.deleteRecursively()
          }
        }
      } finally {
        main.post {
          running.set(false)
          if (stopping) return@post
          // An enqueue may have arrived after the worker observed an empty queue.
          if (!stopping && DownloadStore.list().any { it["status"] == "queued" }) startWorker()
          else { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(latestStartId) }
        }
      }
    }
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    stopping = true
    cancellation?.set(true)
    DownloadStore.failPending(Failure.STOPPED)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    stopping = true
    Localised.unwatch(languageChanged)
    cancellation?.set(true)
    executor.shutdown()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
  private class YoutubeCancelled : Exception()
}
