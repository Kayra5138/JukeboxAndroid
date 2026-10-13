package expo.modules.jukeboxaudio.downloads

import android.content.Context
import android.content.ContentUris
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.provider.MediaStore
import android.media.MediaMetadataRetriever
import android.util.AtomicFile
import expo.modules.jukeboxaudio.LibraryImport
import expo.modules.jukeboxaudio.QueueStore
import org.json.JSONObject
import java.io.File

/** Private files are addressed by generated job ids, never paths supplied by JS. */
object DiscoverFiles {
  private fun directory(context: Context, id: String): File {
    require(id.matches(Regex("[a-fA-F0-9-]{36}")))
    return File(context.noBackupFilesDir, "discover/$id")
  }
  private fun read(context: Context, id: String): JSONObject? = runCatching {
    JSONObject(AtomicFile(File(directory(context, id), "track.json")).openRead().bufferedReader().use { it.readText() })
  }.getOrNull()
  private fun write(context: Context, id: String, data: JSONObject) {
    val store = AtomicFile(File(directory(context, id), "track.json"))
    val out = store.startWrite()
    try { out.write(data.toString().toByteArray()); store.finishWrite(out) }
    catch (e: Exception) { store.failWrite(out); throw e }
  }
  /**
   * Puts a fetched song where Discover keeps its own, and answers the track
   * it now is.
   *
   * As little as can be done, because somebody may be waiting to hear it and
   * everything here is between the download ending and the song starting.
   * The file is moved and not copied — it is on the same disk — and copied
   * only if it will not move. Its length is the one the video was chosen for
   * having, where that is known, and is only read out of the file where it
   * is not: opening the file to measure it costs more than moving it did.
   * The sleeve is whatever has arrived by now ([DownloadArtwork.kept]); one
   * that has not is added when it does, by [picture].
   */
  @Synchronized fun store(context: Context, id: String, audio: File, info: JSONObject, video: JSONObject): JSONObject {
    val dir = directory(context, id).apply { mkdirs() }
    val file = File(dir, "$id.${audio.extension}")
    file.delete()
    if (!audio.renameTo(file)) audio.copyTo(file, overwrite = true)
    val known = video.optDouble("duration").takeIf { it.isFinite() && it > 0 }
    val duration = known ?: runCatching {
      val reader = MediaMetadataRetriever()
      try { reader.setDataSource(file.path); (reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0) / 1000 }
      finally { reader.release() }
    }.getOrDefault(0.0)
    val sleeve = info.optString("artworkUri").takeIf { it.startsWith("file://") } ?: DownloadArtwork.kept(context, video.text("discoverCover"))
    val row = JSONObject().put("id", "discover:$id").put("uri", Uri.fromFile(file).toString())
      .put("title", video.optString("discoveryTitle", info.optString("title")))
      .put("artist", video.optString("discoveryArtist", info.optString("artist")))
      .put("album", info.optString("album").takeIf { it.isNotBlank() } ?: JSONObject.NULL)
      .put("artworkUri", sleeve ?: JSONObject.NULL)
      .put("durationSec", duration).put("filename", file.name).put("folder", JSONObject.NULL)
      .put("trackNumber", JSONObject.NULL).put("addedAt", System.currentTimeMillis())
    write(context, id, row)
    return row
  }

  /** Gives a stored song the sleeve that came after it. Answers whether there was still a song to give it to. */
  @Synchronized fun picture(context: Context, id: String, artworkUri: String): Boolean {
    val row = track(context, id) ?: return false
    write(context, id, row.put("artworkUri", artworkUri))
    return true
  }

  /**
   * Fetches the sleeve of a song that was stored without one, and joins it
   * to the song when it comes. On a thread of its own: nothing waits for it.
   */
  fun pictureLater(context: Context, id: String, video: JSONObject) {
    val app = context.applicationContext
    Thread({
      runCatching {
        val known = JSONObject(video.toString())
        val uri = DownloadArtwork.carried(app, known.text("discoverCover"), known, java.util.concurrent.atomic.AtomicBoolean(false))
        if (uri != null && picture(app, id, uri)) DownloadStore.pictured(id, uri)
      }
    }, "Jukebox:Sleeve").apply { isDaemon = true }.start()
  }
  @Synchronized fun track(context: Context, id: String): JSONObject? {
    val row = read(context, id) ?: return null
    val file = File(directory(context, id), row.getString("filename"))
    return row.takeIf { file.isFile && file.length() > 0 }
  }
  @Synchronized fun promote(context: Context, id: String, folder: String): String {
    val data = track(context, id) ?: throw YouTubeTrouble(Failure.NOT_HERE)
    val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
    val reserved = data.optString("savedId").toLongOrNull()
    if (reserved != null) {
      val uri = ContentUris.withAppendedId(collection, reserved)
      val pending = context.contentResolver.query(uri, arrayOf(MediaStore.Audio.Media.IS_PENDING), null, null, null)
        ?.use { if (it.moveToFirst()) it.getInt(0) else null }
      if (pending == 0) return reserved.toString()
      if (pending == 1) context.contentResolver.delete(uri, null, null)
    }
    val file = File(directory(context, id), data.getString("filename"))
    return LibraryImport.fromDownload(context, file, folder, "${data.getString("title")}.${file.extension}") { reservedId ->
      data.put("savedId", reservedId); write(context, id, data)
    }
  }
  /*
    The folders are taken away under the same lock as keeping, storing and
    reading: without it a tidy that came while a song was being copied into
    the library could take the song's folder from under the copy.

    Only the folders. What the queue of downloads has to say is asked before
    the lock is taken, and what it is told is told after the lock is let go.
    The queue has a lock of its own, and from inside it asks this object
    whether a song's file is still there; a tidy that held this lock and then
    waited for the queue's, while the queue held its own and waited for this
    one, was two threads each waiting for the other for good. Everything that
    wanted the queue after that waited with them, the screen's own thread
    among them, and the app stood still.
  */
  fun clean(context: Context, ids: List<String>, protectedIds: List<String>): List<String> {
    // Both live JS and the durable native queue protect files. Never remove a queued URI.
    val keep = protectedIds.toSet() + (QueueStore.load(context)?.items?.map { it.mediaId } ?: emptyList())
    val active = DownloadStore.list()
      .filter { it["status"] in DownloadStore.activeStates }
      .mapNotNull { it["id"] as? String }
      .toSet()
    val removed = synchronized(this) {
      ids.filter { id ->
        if ("discover:$id" in keep || id in active) false
        else directory(context, id).let { !it.exists() || it.deleteRecursively() }
      }
    }
    removed.forEach { DownloadStore.forgetDiscovery(it) }
    return removed
  }
  fun downloadInBackground(context: Context, job: JSONObject) {
    require(!job.isNull("discoverKey"))
    val id = job.getString("id")
    val directory = File(context.cacheDir, "youtube/$id")
    val cancelled = java.util.concurrent.atomic.AtomicBoolean(false)
    // WorkManager's execution window is bounded; never leave a half-hour native download running.
    val timer = java.util.Timer(true)
    timer.schedule(object : java.util.TimerTask() { override fun run() { cancelled.set(true) } }, 120_000)
    try {
      val video = job.getJSONObject("video")
      if (video.optBoolean("discoverWifiOnly") && networkAllowed(context)["wifi"] != true) throw YouTubeTrouble(Failure.WAITING_WIFI)
      // As it was asked for: the audio as YouTube has it, for every job made since Discover stopped converting.
      val (audio, info) = YouTubeEngine.download(context, video.getString("id"), job.optString("format", "mp3"), directory, cancelled, video, discover = true) { state, progress ->
        if (DownloadStore.isCancelling(id)) cancelled.set(true)
        if (video.optBoolean("discoverWifiOnly") && networkAllowed(context)["wifi"] != true) cancelled.set(true)
        DownloadStore.change(id, state, progress)
      }
      if (cancelled.get() || !DownloadStore.beginSaving(id)) throw YouTubeTrouble(Failure.PAUSED)
      val stored = store(context, id, audio, info, job.getJSONObject("video"))
      DownloadStore.complete(id, "discover:$id")
      // The task has the time, and no screen to show a song without its sleeve to.
      if (stored.isNull("artworkUri")) {
        runCatching { DownloadArtwork.carried(context, video.text("discoverCover"), video, cancelled) }.getOrNull()
          ?.let { if (picture(context, id, it)) DownloadStore.pictured(id, it) }
      }
    } catch (error: Exception) {
      val waiting = job.getJSONObject("video").optBoolean("discoverWifiOnly") && networkAllowed(context)["wifi"] != true
      DownloadStore.change(id, "failed", error = if (waiting) Failed(Failure.WAITING_WIFI) else failed(error))
    } finally { timer.cancel(); directory.deleteRecursively() }
  }
  fun networkAllowed(context: Context): Map<String, Boolean> {
    val manager = context.getSystemService(ConnectivityManager::class.java)
    val caps = manager.getNetworkCapabilities(manager.activeNetwork)
    val connected = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    return mapOf("connected" to connected, "wifi" to (connected && caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true && !manager.isActiveNetworkMetered))
  }
}
