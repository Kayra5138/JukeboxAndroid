package expo.modules.jukeboxaudio.downloads

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/** A durable queue independent of the React screen and React context. */
object DownloadStore {
  val activeStates = setOf("queued", "preparing", "downloading", "converting", "saving", "cancelling")
  private var loaded = false
  private var batching = false
  private val jobs = mutableListOf<JSONObject>()
  private lateinit var storage: AtomicFile

  @Synchronized
  fun init(context: Context) {
    if (loaded) return
    storage = AtomicFile(File(context.noBackupFilesDir, "youtube-downloads.json"))
    if (storage.baseFile.exists()) {
      val array = JSONArray(storage.openRead().bufferedReader().use { it.readText() })
      for (index in 0 until array.length()) jobs.add(array.getJSONObject(index))
    }
    /*
      Jobs left behind by the FLAC source, which there is no longer an engine
      for. Dropped rather than kept, because their ids are not YouTube ids:
      retrying one throws before it starts, and a row whose only possible
      outcome is failure is worse than no row at all. This is the queue's record
      of the job — anything that actually downloaded is in the library already
      and stays there.
    */
    jobs.removeAll { it.optJSONObject("video")?.optString("source") == "flac" }
    // Android may have killed the worker. Never pretend an interrupted job is
    // still running, and never start network work until the user retries it.
    jobs.filter { it.optString("status") in activeStates }.forEach {
      if (it.optString("status") == "saving" && recoverPublication(context, it)) {
        it.put("status", "done").put("progress", 100)
        fail(it, null)
      } else {
        fail(it.put("status", "failed"), Failed(Failure.INTERRUPTED))
      }
    }
    persist()
    loaded = true
    // No worker can exist before this process-local store has been initialized.
    File(context.cacheDir, "youtube").deleteRecursively()
  }

  private fun persist() {
    if (batching) return
    val stream = storage.startWrite()
    try {
      stream.write(JSONArray(jobs).toString().toByteArray(Charsets.UTF_8))
      storage.finishWrite(stream)
    } catch (error: Exception) { storage.failWrite(stream); throw error }
  }

  /**
   * The jobs, newest first, each with `errorText` beside its `error`.
   *
   * `error` is what was written down when the job failed, in English, and
   * `errorCode` says which failure it was. `errorText` is that failure in the
   * app's language as it is now, worked out here each time rather than
   * stored, so a job that failed yesterday in English is read in Turkish
   * today. Where the failure has no sentence of its own — the extractor's
   * last line — it is the same as `error`, since there is nothing else to say.
   */
  @Synchronized
  fun list(): List<Map<String, Any?>> = jobs.asReversed().map { job ->
    YouTubeData.map(job) + ("errorText" to errorText(job))
  }

  private fun errorText(job: JSONObject): String? {
    if (job.isNull("error")) return null
    val error = job.optString("error")
    // A job from before there were codes is known by its sentence instead.
    val failure = Failure.of(job.optString("errorCode")) ?: Failure.saying(error) ?: return error
    return if (error == failure.english) failure.said else error
  }

  private fun fail(job: JSONObject, failed: Failed?) {
    job.put("error", failed?.english ?: JSONObject.NULL)
      .put("errorCode", failed?.failure?.code ?: JSONObject.NULL)
  }

  @Synchronized
  fun enqueue(context: Context, video: JSONObject, format: String, folder: String, discoverKey: String? = null): String {
    val id = video.getString("id")
    YouTubeData.url(id)
    require(format in setOf("mp3", "original"))
    val destination = YouTubeData.folder(folder)
    if (discoverKey != null) require(discoverKey.matches(Regex("[a-fA-F0-9-]{36}")))
    val existing = jobs.lastOrNull { it.getJSONObject("video").getString("id") == id &&
      it.optString("discoverKey", "") == (discoverKey ?: "") &&
      (it.optString("status") in activeStates || it.optString("status") == "done") &&
      (discoverKey == null || it.optString("status") != "cancelling") }
    if (existing != null) {
      if (existing.optString("status") != "done" || exists(context, existing)) return existing.getString("id")
      existing.put("status", "missing").put("trackId", JSONObject.NULL)
    }
    if (jobs.count { it.optString("status") in activeStates } >= 500) throw YouTubeTrouble(Failure.QUEUE_FULL)
    val jobId = UUID.randomUUID().toString()
    jobs.add(JSONObject().put("id", jobId).put("video", video).put("format", format)
      .put("discoverKey", discoverKey ?: JSONObject.NULL).put("folder", destination).put("status", "queued").put("progress", 0)
      .put("trackId", JSONObject.NULL).put("error", JSONObject.NULL).put("described", false))
    persist()
    return jobId
  }

  @Synchronized
  fun enqueueBatch(context: Context, videos: List<JSONObject>, format: String, folder: String): List<String> {
    if (videos.size !in 1..500) throw YouTubeTrouble(Failure.BATCH)
    val snapshot = jobs.map { JSONObject(it.toString()) }
    batching = true
    try {
      val ids = videos.distinctBy { it.getString("id") }.map { enqueue(context, it, format, folder) }
      batching = false
      persist()
      return ids
    } catch (error: Exception) {
      jobs.clear(); jobs.addAll(snapshot)
      throw error
    } finally { batching = false }
  }

  @Synchronized
  fun recordPromotion(context: Context, id: String, trackId: String, folder: String, artworkUri: String?) {
    init(context)
    if (jobs.any { it.optString("trackId") == trackId && it.isNull("discoverKey") }) return
    val source = jobs.firstOrNull { it.getString("id") == id } ?: return
    val receipt = JSONObject(source.toString())
    receipt.put("id", UUID.randomUUID().toString()).put("discoverKey", JSONObject.NULL)
      .put("trackId", trackId).put("folder", folder).put("status", "done").put("progress", 100)
      .put("described", false).put("artworkUri", artworkUri ?: JSONObject.NULL)
    jobs.add(receipt); persist()
  }

  @Synchronized
  fun forgetDiscovery(id: String) {
    val removed = jobs.removeAll { it.optString("id") == id && !it.isNull("discoverKey") && it.optString("status") !in activeStates }
    if (removed) persist()
  }

  @Synchronized
  fun artwork(context: Context, trackId: String): String? {
    init(context)
    return jobs.lastOrNull { it.optString("trackId") == trackId && it.optString("status") == "done" }
      ?.optString("artworkUri")?.takeIf { it.startsWith("file://") && File(java.net.URI(it)).isFile }
  }

  private fun exists(context: Context, job: JSONObject): Boolean { return try {
    if (!job.isNull("discoverKey")) return DiscoverFiles.track(context, job.getString("id")) != null
    val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), job.getString("trackId").toLong())
    context.contentResolver.query(uri, arrayOf(MediaStore.Audio.Media._ID), null, null, null)?.use { it.moveToFirst() } ?: false
  } catch (_: Exception) { false } }

  /** The row id is journaled before bytes are copied. A process death between
   * publishing and saving the receipt cannot create a duplicate on retry. */
  private fun recoverPublication(context: Context, job: JSONObject): Boolean {
    if (!job.isNull("discoverKey")) return DiscoverFiles.track(context, job.getString("id")) != null
    if (job.isNull("trackId")) return false
    val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), job.getString("trackId").toLong())
    return try {
      val pending = context.contentResolver.query(uri, arrayOf(MediaStore.Audio.Media.IS_PENDING), null, null, null)
        ?.use { if (it.moveToFirst()) it.getInt(0) else null }
      if (pending == 0) true
      else {
        if (pending == 1) context.contentResolver.delete(uri, null, null)
        job.put("trackId", JSONObject.NULL)
        false
      }
    } catch (_: Exception) { false }
  }

  @Synchronized
  fun reserve(id: String, trackId: String, artworkUri: String? = null) {
    jobs.first { it.getString("id") == id }.put("trackId", trackId).put("artworkUri", artworkUri ?: JSONObject.NULL)
    persist()
  }

  @Synchronized
  fun complete(id: String, trackId: String) {
    jobs.first { it.getString("id") == id }.put("trackId", trackId)
      .put("status", "done").put("progress", 100).also { fail(it, null) }
    // Publication already succeeded. The saved reservation recovers this if
    // the disk fills while recording the final receipt.
    runCatching { persist() }
  }

  @Synchronized
  fun refreshFiles(context: Context) {
    var changed = false
    jobs.filter { it.optString("status") == "done" }.forEach {
      if (!exists(context, it)) { it.put("status", "missing").put("trackId", JSONObject.NULL); changed = true }
    }
    if (changed) persist()
  }

  @Synchronized
  fun takeNext(): JSONObject? {
    val job = jobs.firstOrNull { it.optString("status") == "queued" } ?: return null
    job.put("status", "preparing")
    persist()
    return JSONObject(job.toString())
  }

  @Synchronized
  fun prioritizeDiscovery(id: String) {
    val job = jobs.firstOrNull { it.optString("id") == id && !it.isNull("discoverKey") } ?: return
    // An explicit play request is allowed to use the current connection.
    job.getJSONObject("video").put("discoverWifiOnly", false).put("discoverAutomatic", false)
    if (job.optString("status") == "queued") { jobs.remove(job); jobs.add(0, job) }
    persist()
  }

  @Synchronized
  fun takeById(id: String): JSONObject? {
    val job = jobs.firstOrNull { it.optString("id") == id && it.optString("status") == "queued" } ?: return null
    job.put("status", "preparing"); persist()
    return JSONObject(job.toString())
  }

  @Synchronized
  fun change(id: String, status: String, progress: Int = 0, error: Failed? = null, trackId: String? = null) {
    val job = jobs.firstOrNull { it.optString("id") == id } ?: return
    if (job.optString("status") == "cancelling" && status in setOf("downloading", "converting", "preparing")) return
    val old = job.optString("status")
    job.put("status", status).put("progress", progress)
    fail(job, error)
    if (trackId != null) job.put("trackId", trackId)
    // Progress is transient. State transitions and receipts are durable.
    if (old != status || trackId != null) persist()
  }

  @Synchronized
  fun cancel(id: String): Boolean {
    val job = jobs.firstOrNull { it.optString("id") == id } ?: return false
    return when (job.optString("status")) {
      "queued" -> { change(id, "cancelled"); false }
      "preparing", "downloading", "converting" -> { change(id, "cancelling"); true }
      else -> false // Publication is a short, non-cancellable commit.
    }
  }

  @Synchronized
  fun isCancelling(id: String): Boolean = jobs.any { it.optString("id") == id && it.optString("status") == "cancelling" }

  @Synchronized
  fun beginSaving(id: String): Boolean {
    if (isCancelling(id)) return false
    change(id, "saving", 100)
    return true
  }

  @Synchronized
  fun described(id: String) {
    jobs.firstOrNull { it.optString("id") == id }?.put("described", true)
    persist()
  }

  @Synchronized
  fun failPending(failure: Failure) {
    jobs.filter { it.optString("status") in activeStates }.forEach {
      fail(it.put("status", "failed"), Failed(failure))
    }
    persist()
  }
}
