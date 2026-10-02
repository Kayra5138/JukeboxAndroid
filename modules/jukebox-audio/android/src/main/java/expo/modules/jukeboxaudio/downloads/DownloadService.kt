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

  companion object {
    private const val CHANNEL = "youtube-downloads"
    private const val NOTIFICATION = 2719
    @Volatile private var currentId: String? = null
    @Volatile private var cancellation: AtomicBoolean? = null
    fun cancel(id: String) { if (currentId == id) cancellation?.set(true) }
  }

  override fun onCreate() {
    super.onCreate()
    getSystemService(NotificationManager::class.java).createNotificationChannel(
      NotificationChannel(CHANNEL, "Music downloads", NotificationManager.IMPORTANCE_LOW)
    )
  }

  private fun notification(text: String, progress: Int = 0): Notification {
    val builder = Notification.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_download)
      .setContentTitle("Jukebox · Downloads").setContentText(text)
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
      startForeground(NOTIFICATION, notification("Preparing download…"), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      DownloadStore.init(this)
      startWorker()
    } catch (error: Exception) {
      DownloadStore.failPending(error.message ?: "Could not start the download service.")
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
            val progress: (String, Int) -> Unit = { state, percent ->
              DownloadStore.change(id, state, percent)
              val now = android.os.SystemClock.elapsedRealtime()
              if (now - lastNotification > 1000) {
                lastNotification = now
                getSystemService(NotificationManager::class.java).notify(NOTIFICATION,
                  notification("${if (state == "converting") "Converting" else "Downloading"}: ${video.getString("title")}", percent))
              }
            }
            val (file, info) = YouTubeEngine.download(
              this, video.getString("id"), job.getString("format"), directory, cancelled, progress)
            if (cancelled.get() || !DownloadStore.beginSaving(id)) throw YoutubeCancelled()
            val trackId = LibraryImport.fromDownload(this, file, job.getString("folder"),
              "${info.getString("title")}.${file.extension}") { trackId ->
                DownloadStore.reserve(id, trackId, info.optString("artworkUri").takeIf { it.startsWith("file://") })
              }
            DownloadStore.complete(id, trackId)
          } catch (error: Exception) {
            val wasCancelled = cancelled.get() || error is YoutubeCancelled
            DownloadStore.change(id, if (wasCancelled) "cancelled" else "failed",
              error = if (wasCancelled) null else friendlyError(error))
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
    DownloadStore.failPending("Android stopped background downloading. Open Search and retry.")
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    stopping = true
    cancellation?.set(true)
    executor.shutdown()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
  private class YoutubeCancelled : Exception()
}

fun friendlyError(error: Exception): String {
  val text = error.message.orEmpty()
  return when {
    text.contains("Sign in", true) || text.contains("bot", true) -> "YouTube requires verification for this video. Try another recording."
    text.contains("private", true) || text.contains("unavailable", true) -> "This video is unavailable or private."
    text.contains("network", true) || text.contains("resolve", true) -> "Could not reach YouTube. Check your connection and retry."
    text.contains("403") -> "YouTube refused this download. Try again later or update Jukebox."
    else -> text.lineSequence().lastOrNull { it.isNotBlank() }?.take(240) ?: "Download failed. Please retry."
  }
}
