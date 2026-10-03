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
  @Synchronized fun store(context: Context, id: String, audio: File, info: JSONObject, video: JSONObject) {
    val dir = directory(context, id).apply { mkdirs() }
    val file = File(dir, "$id.${audio.extension}")
    audio.copyTo(file, overwrite = true)
    val duration = runCatching {
      val reader = MediaMetadataRetriever()
      try { reader.setDataSource(file.path); (reader.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0) / 1000 }
      finally { reader.release() }
    }.getOrDefault(0.0)
    write(context, id, JSONObject().put("id", "discover:$id").put("uri", Uri.fromFile(file).toString())
      .put("title", video.optString("discoveryTitle", info.optString("title")))
      .put("artist", video.optString("discoveryArtist", info.optString("artist")))
      .put("album", info.optString("album").takeIf { it.isNotBlank() } ?: JSONObject.NULL)
      .put("artworkUri", info.optString("artworkUri").takeIf { it.startsWith("file://") } ?: JSONObject.NULL)
      .put("durationSec", duration).put("filename", file.name).put("folder", JSONObject.NULL)
      .put("trackNumber", JSONObject.NULL).put("addedAt", System.currentTimeMillis()))
  }
  @Synchronized fun track(context: Context, id: String): JSONObject? {
    val row = read(context, id) ?: return null
    val file = File(directory(context, id), row.getString("filename"))
    return row.takeIf { file.isFile && file.length() > 0 }
  }
  @Synchronized fun promote(context: Context, id: String, folder: String): String {
    val data = track(context, id) ?: error("Download this song before saving it.")
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
  fun clean(context: Context, ids: List<String>, protectedIds: List<String>): List<String> {
    // Both live JS and the durable native queue protect files. Never remove a queued URI.
    val keep = protectedIds.toSet() + (QueueStore.load(context)?.items?.map { it.mediaId } ?: emptyList())
    return ids.filter { id ->
      if ("discover:$id" in keep || DownloadStore.list().any { it["id"] == id && it["status"] in DownloadStore.activeStates }) false
      else directory(context, id).let {
        val removed = !it.exists() || it.deleteRecursively()
        if (removed) DownloadStore.forgetDiscovery(id)
        removed
      }
    }
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
      check(!video.optBoolean("discoverWifiOnly") || networkAllowed(context)["wifi"] == true) { "Waiting for Wi-Fi. Automatic download will resume later." }
      val (audio, info) = YouTubeEngine.download(context, job.getJSONObject("video").getString("id"), "mp3", directory, cancelled, video) { state, progress ->
        if (DownloadStore.isCancelling(id)) cancelled.set(true)
        if (video.optBoolean("discoverWifiOnly") && networkAllowed(context)["wifi"] != true) cancelled.set(true)
        DownloadStore.change(id, state, progress)
      }
      check(!cancelled.get() && DownloadStore.beginSaving(id)) { "Download paused. Open Discover to retry." }
      store(context, id, audio, info, job.getJSONObject("video"))
      DownloadStore.complete(id, "discover:$id")
    } catch (error: Exception) {
      val waiting = job.getJSONObject("video").optBoolean("discoverWifiOnly") && networkAllowed(context)["wifi"] != true
      DownloadStore.change(id, "failed", error = if (waiting) "Waiting for Wi-Fi. Automatic download will resume later." else friendlyError(error))
    } finally { timer.cancel(); directory.deleteRecursively() }
  }
  fun networkAllowed(context: Context): Map<String, Boolean> {
    val manager = context.getSystemService(ConnectivityManager::class.java)
    val caps = manager.getNetworkCapabilities(manager.activeNetwork)
    val connected = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    return mapOf("connected" to connected, "wifi" to (connected && caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true && !manager.isActiveNetworkMetered))
  }
}
