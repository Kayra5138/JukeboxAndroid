package expo.modules.jukeboxaudio.downloads

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.util.UUID

/**
 * A durable queue independent of the React screen and React context.
 *
 * The rules of it — whose turn it is, what may be moved where — are
 * [DownloadQueue]'s, which knows nothing of the phone. This is the phone's
 * half: the files the queue is kept in, the library a finished job is looked
 * for in, and one lock around all of it.
 */
object DownloadStore {
  val activeStates = DownloadQueue.activeStates
  private var loaded = false
  private val queue = DownloadQueue()
  private val jobs get() = queue.jobs
  private lateinit var storage: AtomicFile
  /** Whether the queue is paused and when it last worked. Beside the jobs and not among them, so the jobs' file stays a list. */
  private lateinit var state: AtomicFile

  @Synchronized
  fun init(context: Context) {
    if (loaded) return
    storage = AtomicFile(File(context.noBackupFilesDir, "youtube-downloads.json"))
    state = AtomicFile(File(context.noBackupFilesDir, "youtube-queue.json"))
    if (storage.baseFile.exists()) queue.read(storage.openRead().bufferedReader().use { it.readText() })
    runCatching { queue.readState(state.openRead().bufferedReader().use { it.readText() }) }
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
    // still running. What was only waiting still is, and nothing is started
    // from here: that is for whoever opens the app, or asks for something.
    queue.recover { recoverPublication(context, it) }
    queue.changed = false
    persist()
    loaded = true
    // No worker can exist before this process-local store has been initialized.
    File(context.cacheDir, "youtube").deleteRecursively()
  }

  private fun persist() {
    val stream = storage.startWrite()
    try {
      stream.write(queue.written().toByteArray(Charsets.UTF_8))
      storage.finishWrite(stream)
    } catch (error: Exception) { storage.failWrite(stream); throw error }
  }

  private fun persistState() {
    val stream = state.startWrite()
    try {
      stream.write(queue.stateWritten().toByteArray(Charsets.UTF_8))
      state.finishWrite(stream)
    } catch (error: Exception) { state.failWrite(stream); throw error }
  }

  /**
   * Writes down whatever [change] changed, and only if it changed anything:
   * a download's percentage is asked about many times a second and is not
   * worth a write.
   */
  private inline fun <T> kept(change: () -> T): T {
    try { return change() }
    finally {
      val jobsChanged = queue.changed
      val stateChanged = queue.stateChanged
      queue.changed = false
      queue.stateChanged = false
      // Whoever stands in [awaitFind] is waiting for exactly this.
      if (jobsChanged || stateChanged) monitor.notifyAll()
      if (jobsChanged) persist()
      // When the queue last worked only spaces out Discover's own. Losing it costs one early start.
      if (stateChanged) runCatching { persistState() }
    }
  }

  /** This, as the thing its own lock is: what [awaitFind] waits on, letting go of the lock while it does. */
  private val monitor get() = this as Object
  /** How many callers stand in [awaitFind] now. */
  private var finders = 0

  private fun outside(context: Context) = Outside(
    handBusy = YouTubeEngine.gate.handBusy,
    finderWaiting = finders > 0,
    searching = YouTubeEngine::searching,
    wifi = { DiscoverFiles.networkAllowed(context)["wifi"] == true }
  )

  /**
   * The jobs, newest first, each with `errorText` beside its `error`.
   *
   * `error` is what was written down when the job failed, in English, and
   * `errorCode` says which failure it was. `errorText` is that failure in the
   * app's language as it is now, worked out here each time rather than
   * stored, so a job that failed yesterday in English is read in Turkish
   * today. Where the failure has no sentence of its own — the extractor's
   * last line — it is the same as `error`, since there is nothing else to say.
   *
   * Newest first is last first: the list is kept in the order it is worked
   * through, so among the jobs still waiting the next to be fetched is the
   * last of them here.
   */
  @Synchronized
  fun list(): List<Map<String, Any?>> = jobs.asReversed().map(::said)

  private fun said(job: JSONObject): Map<String, Any?> = YouTubeData.map(job) + ("errorText" to errorText(job))

  private fun errorText(job: JSONObject): String? {
    if (job.isNull("error")) return null
    val error = job.optString("error")
    // A job from before there were codes is known by its sentence instead.
    val failure = Failure.of(job.text("errorCode")) ?: Failure.saying(error) ?: return error
    return if (error == failure.english) failure.said else error
  }

  @Synchronized
  fun enqueue(context: Context, video: JSONObject, format: String, folder: String, discoverKey: String? = null): String =
    kept { queue.enqueue(video, format, folder, discoverKey) { exists(context, it) } }

  @Synchronized
  fun enqueueBatch(context: Context, videos: List<JSONObject>, format: String, folder: String): List<String> =
    kept { queue.enqueueBatch(videos, format, folder) { exists(context, it) } }

  @Synchronized
  fun enqueueFind(context: Context, video: JSONObject, format: String, folder: String, discoverKey: String?): String =
    kept { queue.enqueueFind(video, format, folder, discoverKey) { exists(context, it) } }

  /** How long [awaitFind] stands before answering that there is nothing yet. */
  const val FIND_WAIT_MS = 25_000L

  /**
   * The job whose video may be looked for, waited for.
   *
   * JavaScript finds the videos, and JavaScript behind the screen has no
   * timers to ask again by; what it does have is a call that has not come
   * back. So this one stands here, off its thread, until a name's turn comes
   * and is answered with that job. It is answered with null instead when
   * there is no more to stand for — no name is waiting, or the queue is
   * paused, or [alive] says whoever asked has gone — and after [FIND_WAIT_MS]
   * whatever is the case, so that a caller that has gone without saying so
   * holds a thread no longer than that. A caller that is still there asks
   * again.
   *
   * It looks again four times a second as well as when it is woken: whose
   * turn it is also turns on the clock and on a search made by hand, and
   * neither of those wakes anybody.
   *
   * Standing here is what tells the worker there is somebody to do the
   * finding: rule 6 of WHO GOES FIRST.
   */
  @Synchronized
  fun awaitFind(context: Context, alive: () -> Boolean = { true }, patience: Long = FIND_WAIT_MS): Map<String, Any?>? {
    val deadline = android.os.SystemClock.elapsedRealtime() + patience
    finders++
    try {
      while (true) {
        kept { queue.claimFind(outside(context)) }?.let { return said(it) }
        val left = deadline - android.os.SystemClock.elapsedRealtime()
        if (left <= 0 || queue.paused || !queue.namesWaiting() || !alive()) return null
        monitor.wait(left.coerceAtMost(DownloadQueue.POLL_MS))
      }
    } finally { finders-- }
  }

  @Synchronized fun isFinding(id: String): Boolean = queue.isFinding(id)
  @Synchronized fun findingTitle(): String? = queue.findingTitle()
  @Synchronized fun searched(id: String) = queue.searched(id)
  @Synchronized fun requeueFind(id: String) = kept { queue.requeueFind(id) }
  @Synchronized fun failFind(id: String, failed: Failed) = kept { queue.failFind(id, failed) }

  @Synchronized
  fun resolveFind(context: Context, id: String, video: JSONObject?) =
    kept { queue.resolveFind(id, video) { exists(context, it) } }

  /** A search somebody typed has ended. See [DownloadQueue.touch]. */
  @Synchronized fun touched() { if (loaded) queue.touch() }

  @Synchronized
  fun recordPromotion(context: Context, id: String, trackId: String, folder: String, artworkUri: String?) {
    init(context)
    if (jobs.any { it.text("trackId") == trackId && it.isNull("discoverKey") }) return
    val source = jobs.firstOrNull { it.getString("id") == id } ?: return
    val now = System.currentTimeMillis()
    val receipt = JSONObject(source.toString())
    receipt.put("id", UUID.randomUUID().toString()).put("discoverKey", JSONObject.NULL)
      .put("trackId", trackId).put("folder", folder).put("status", "done").put("progress", 100)
      .put("described", false).put("artworkUri", artworkUri ?: JSONObject.NULL)
      .put("createdAt", now).put("finishedAt", now).put("automatic", false).put("cleared", false)
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
    // Publication already succeeded. The saved reservation recovers this if
    // the disk fills while recording the final receipt.
    runCatching { kept { queue.complete(id, trackId) } }
  }

  @Synchronized
  fun refreshFiles(context: Context) {
    var changed = false
    jobs.filter { it.optString("status") == "done" }.forEach {
      if (!exists(context, it)) { it.put("status", "missing").put("trackId", JSONObject.NULL); changed = true }
    }
    if (changed) persist()
  }

  /**
   * What the worker is to do now: see WHO GOES FIRST in [DownloadQueue].
   *
   * A job that is handed over is fetched whether or not marking it could be
   * written down. It is marked here, in this process, and a process that
   * dies before the write finds it waiting, which is no worse.
   */
  @Synchronized
  fun next(context: Context): Next {
    val next = queue.next(outside(context))
    runCatching { kept {} }
    return next
  }

  /** Whether there is anything a worker could do or wait for now. */
  @Synchronized
  fun wants(context: Context): Boolean = kept { queue.wants(outside(context)) }

  @Synchronized
  fun prioritizeDiscovery(id: String) = kept { queue.prioritizeDiscovery(id) }

  @Synchronized
  fun takeById(context: Context, id: String): JSONObject? = kept { queue.takeById(id, outside(context)) }

  @Synchronized
  fun move(id: String, beforeId: String?): Boolean = kept { queue.move(id, beforeId) }

  @Synchronized
  fun retry(id: String): Boolean = kept { queue.retry(id) }

  @Synchronized
  fun setPaused(paused: Boolean) = kept { queue.setPaused(paused) }

  @Synchronized
  fun queueState(): Map<String, Any?> = mapOf("paused" to queue.paused)

  @Synchronized
  fun clearFinished() = kept { queue.clearFinished() }

  @Synchronized
  fun change(id: String, status: String, progress: Int = 0, error: Failed? = null, trackId: String? = null) =
    kept { queue.change(id, status, progress, error, trackId) }

  @Synchronized
  fun cancel(id: String): Stop = kept { queue.cancel(id) }

  @Synchronized
  fun cancelAll(): List<Pair<String, Stop>> = kept { queue.cancelAll() }

  @Synchronized
  fun isCancelling(id: String): Boolean = queue.isCancelling(id)

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

  /** Fails those of [ids] still waiting or under way: jobs just asked for, that the service could not be started for. */
  @Synchronized
  fun failPending(failure: Failure, ids: Collection<String>) = kept { queue.failActive(ids, failure) }

  /** The service was stopped under its work: see [DownloadQueue.interrupt]. Everything that was only waiting still is. */
  @Synchronized
  fun interrupted(failure: Failure) = kept { queue.interrupt(failure) }
}
