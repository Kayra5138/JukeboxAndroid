package expo.modules.jukeboxaudio.downloads

import android.content.Intent
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.json.JSONObject

class JukeboxDownloadsModule : Module() {
  private val context get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()
  private val io = CoroutineScope(Dispatchers.IO + SupervisorJob())
  /** Cleared when the module goes, so that a call standing in wait for a name to find lets go of its thread. */
  private val alive = java.util.concurrent.atomic.AtomicBoolean(true)
  /** Set when the module goes, which stops an update of the extractor that is still waiting or fetching. */
  private val gone = java.util.concurrent.atomic.AtomicBoolean(false)

  /**
   * Starts the service for jobs somebody has just asked for, where the queue
   * has anything for it to do: paused, it has not. If Android will not have
   * it started, those jobs fail saying so and the rest are left as they were.
   */
  private fun start(ids: List<String>, failure: Failure) {
    if (!DownloadStore.wants(context)) return
    try { context.startForegroundService(Intent(context, DownloadService::class.java)) }
    catch (error: Exception) {
      DownloadStore.failPending(failure, ids)
      throw error
    }
  }

  private fun stop(id: String, what: Stop) {
    when (what) {
      Stop.DOWNLOAD -> DownloadService.cancel(id)
      // By the job's id, which is what its search goes by: see findSearchAsync.
      Stop.SEARCH -> YouTubeEngine.cancelSearch(id, remember = false)
      Stop.NOTHING -> {}
    }
  }
  override fun definition() = ModuleDefinition {
    Name("JukeboxDownloads")

    /*
      Said whenever a job changes state: taken, found, finished, failed,
      cancelled, moved. JavaScript reads the jobs again when it hears it, and
      that is how it knows a song is in without having to keep asking — which
      behind the screen it cannot do, having no timers there, and in front of
      it should not have to do every second for jobs that are only waiting.
      Nothing travels with it. What changed is whatever the next reading says.
    */
    Events("onQueueChanged", "onDiscoverReady", "onPreview", "onExtractorUpdate")
    OnCreate {
      val self = java.lang.ref.WeakReference(this@JukeboxDownloadsModule)
      // Left in place when this module goes, as the player's is: it holds a
      // weak reference and nothing else, and the next module puts its own here.
      DownloadStore.told = {
        self.get()?.takeIf { it.alive.get() }?.let { module ->
          runCatching { module.sendEvent("onQueueChanged", emptyMap<String, Any?>()) }
        }
      }
      // What became of a preview: see PreviewPlayer.
      expo.modules.jukeboxaudio.preview.PreviewPlayer.told = { state ->
        self.get()?.takeIf { it.alive.get() }?.let { module ->
          runCatching { module.sendEvent("onPreview", state) }
        }
      }
      // A song of Discover's is stored, and here it is: see DownloadStore.heard.
      DownloadStore.heard = { song ->
        self.get()?.takeIf { it.alive.get() }?.let { module ->
          runCatching { module.sendEvent("onDiscoverReady", song) }
        }
      }
    }
    OnDestroy { alive.set(false); gone.set(true); io.cancel(); expo.modules.jukeboxaudio.preview.PreviewPlayer.stop() }

    /*
      Thirty seconds of a Discover song, to be heard while the song is
      fetched. Played apart from the app's player and its queue: see
      PreviewPlayer. Answers whether the address was one a preview may be
      played from; what becomes of it is said by `onPreview`.
    */
    AsyncFunction("previewStartAsync") { id: String, address: String ->
      expo.modules.jukeboxaudio.preview.PreviewPlayer.start(context, id, address)
    }
    AsyncFunction("previewStopAsync") {
      expo.modules.jukeboxaudio.preview.PreviewPlayer.stop()
    }

    AsyncFunction("discoverNetworkAsync") {
      DiscoverFiles.networkAllowed(context)
    }.runOnQueue(io)
    AsyncFunction("enqueueDiscoverAsync") { video: Map<String, Any?>, key: String ->
      DownloadStore.init(context)
      val id = DownloadStore.enqueue(context, JSONObject(video), "mp3", "Music", key)
      start(listOf(id), Failure.OPEN_DISCOVER)
      id
    }.runOnQueue(io)
    AsyncFunction("queueDiscoverBackgroundAsync") { video: Map<String, Any?>, key: String ->
      DownloadStore.init(context)
      DownloadStore.enqueue(context, JSONObject(video), "mp3", "Music", key)
    }.runOnQueue(io)
    AsyncFunction("downloadDiscoverBackgroundAsync") { id: String ->
      DownloadStore.init(context)
      DownloadStore.takeById(context, id)?.let { job -> DiscoverFiles.downloadInBackground(context, job) }
    }.runOnQueue(io)
    AsyncFunction("prioritizeDiscoverAsync") { id: String ->
      DownloadStore.init(context)
      DownloadStore.prioritizeDiscovery(id)
      start(listOf(id), Failure.RETRY_DISCOVER)
    }.runOnQueue(io)
    AsyncFunction("discoverTrackAsync") { id: String ->
      DiscoverFiles.track(context, id)?.let(YouTubeData::map)
    }.runOnQueue(io)
    AsyncFunction("keepDiscoverAsync") { id: String, folder: String ->
      val target = YouTubeData.folder(folder)
      val trackId = DiscoverFiles.promote(context, id, target)
      DownloadStore.recordPromotion(context, id, trackId, target, DiscoverFiles.track(context, id)?.optString("artworkUri"))
      trackId
    }.runOnQueue(io)
    AsyncFunction("cleanDiscoverAsync") { ids: List<String>, protectedIds: List<String> ->
      DiscoverFiles.clean(context, ids, protectedIds)
    }.runOnQueue(io)

    AsyncFunction("searchAsync") { query: String, searchId: String ->
      try { YouTubeEngine.search(context, query, searchId).map(YouTubeData::map) }
      catch (error: Exception) { throw trouble(error) }
    }.runOnQueue(io)

    AsyncFunction("playlistAsync") { query: String, searchId: String ->
      try { YouTubeEngine.search(context, query, searchId, true).map(YouTubeData::map) }
      catch (error: Exception) { throw trouble(error) }
    }.runOnQueue(io)

    AsyncFunction("enqueueBatchAsync") { videos: List<Map<String, Any?>>, format: String, folder: String ->
      DownloadStore.init(context)
      val ids = DownloadStore.enqueueBatch(context, videos.map { JSONObject(it) }, format, folder)
      start(ids, Failure.OPEN_SEARCH)
      ids
    }.runOnQueue(io)

    AsyncFunction("cancelSearchAsync") { searchId: String -> YouTubeEngine.cancelSearch(searchId) }

    AsyncFunction("getJobsAsync") { refreshFiles: Boolean ->
      DownloadStore.init(context)
      if (refreshFiles) DownloadStore.refreshFiles(context)
      DownloadStore.list()
    }.runOnQueue(io)

    AsyncFunction("enqueueAsync") { video: Map<String, Any?>, format: String, folder: String ->
      DownloadStore.init(context)
      val id = DownloadStore.enqueue(context, JSONObject(video), format, folder)
      start(listOf(id), Failure.OPEN_SEARCH)
      id
    }.runOnQueue(io)

    AsyncFunction("cancelAsync") { id: String ->
      DownloadStore.init(context)
      stop(id, DownloadStore.cancel(id))
    }.runOnQueue(io)

    /*
      The one queue. A song asked for by name is a job like any other, and
      which video it is to be is chosen in JavaScript, where the test for
      "the same recording" lives. So finding is three calls, made by whoever
      is there to make them: claim the job whose turn it is, search for it,
      say what the search came to. The order, the waiting and the record of
      all three are here — see WHO GOES FIRST in DownloadQueue.
    */
    AsyncFunction("enqueueFindAsync") { video: Map<String, Any?>, format: String, folder: String, discoverKey: String?, front: Boolean?, hold: Boolean? ->
      DownloadStore.init(context)
      val asked = JSONObject(video)
      // The sleeve's address is known already, and the song is seconds away at best: see DownloadArtwork.ahead.
      if (discoverKey != null) DownloadArtwork.ahead(context, asked.text("discoverCover"))
      // [front] is a song somebody tapped in Discover and is waiting to hear: rule 9 of WHO GOES FIRST.
      // [hold] is one to be looked for and kept until it is wanted: rule 10.
      val id = DownloadStore.enqueueFind(context, asked, format, folder, discoverKey, front == true, hold == true)
      // A tap does not wait for a search that was only being made on the chance of one.
      if (front == true) DownloadStore.giveWay().forEach { YouTubeEngine.cancelSearch(it, remember = false) }
      // Up from the press that asked, while the app is in front and may start it,
      // and kept up for as long as the names are being worked through.
      DownloadService.wake(context)
      id
    }.runOnQueue(io)

    /*
      A long wait and not a question: see DownloadStore.awaitFind. Whoever
      calls it calls it again for as long as it has names waiting, and needs
      no timer to.
    */
    AsyncFunction("claimFindAsync") {
      val app = context
      DownloadStore.init(app)
      val job = DownloadStore.awaitFind(app, alive::get)
      if (job != null) DownloadService.wake(app)
      job
    }.runOnQueue(io)

    /*
      [searchId] is the id of the job the search is for, and the search is
      made only while that job is the one claimed. That is what lets a job
      be cancelled while it is being looked for, and lets what went wrong be
      written on the job here, where it cannot be lost on the way back.
    */
    AsyncFunction("findSearchAsync") { query: String, searchId: String ->
      DownloadStore.init(context)
      if (!DownloadStore.isFinding(searchId)) throw NotItsTurn()
      try {
        val found = YouTubeEngine.search(context, query, searchId, forQueue = true).map(YouTubeData::map)
        DownloadStore.searched(searchId)
        found
      } catch (error: YouTubeGate.GaveWay) {
        DownloadStore.requeueFind(searchId)
        throw NotItsTurn(error)
      } catch (error: Exception) {
        val trouble = trouble(error)
        // Nothing, for a job cancelled meanwhile: it is no longer being looked for.
        DownloadStore.failFind(searchId, Failed(trouble.failure, trouble.detail))
        throw trouble
      }
    }.runOnQueue(io)

    AsyncFunction("resolveFindAsync") { id: String, video: Map<String, Any?>? ->
      DownloadStore.init(context)
      DownloadStore.resolveFind(context, id, video?.let { JSONObject(it) })
      DownloadService.wake(context)
      Unit
    }.runOnQueue(io)

    AsyncFunction("moveAsync") { id: String, beforeId: String? ->
      DownloadStore.init(context)
      // Put first, one of Discover's own stops being its own, and may be due at once.
      if (DownloadStore.move(id, beforeId)) DownloadService.wake(context)
      Unit
    }.runOnQueue(io)

    AsyncFunction("retryAsync") { id: String ->
      DownloadStore.init(context)
      if (DownloadStore.retry(id)) DownloadService.wake(context)
      Unit
    }.runOnQueue(io)

    AsyncFunction("setPausedAsync") { paused: Boolean ->
      DownloadStore.init(context)
      DownloadStore.setPaused(paused)
      if (!paused) DownloadService.wake(context)
      Unit
    }.runOnQueue(io)

    AsyncFunction("queueStateAsync") {
      DownloadStore.init(context)
      DownloadStore.queueState()
    }.runOnQueue(io)

    AsyncFunction("clearFinishedAsync") {
      DownloadStore.init(context)
      DownloadStore.clearFinished()
    }.runOnQueue(io)

    AsyncFunction("cancelAllAsync") {
      DownloadStore.init(context)
      DownloadStore.cancelAll().forEach { (id, what) -> stop(id, what) }
    }.runOnQueue(io)

    /** Starts the worker if there is anything for it. For jobs left waiting with no worker: the app opened on them, or Discover's own come due. */
    AsyncFunction("wakeQueueAsync") {
      DownloadService.wake(context)
    }.runOnQueue(io)

    AsyncFunction("markDescribedAsync") { id: String ->
      DownloadStore.init(context)
      DownloadStore.described(id)
    }.runOnQueue(io)

    /*
      The extractor's own version, and a newer one where there is one: see
      ExtractorUpdate. The first reads two small files. The second is the one
      request made of GitHub without being asked — when, and how often, is
      JavaScript's to decide. The third is made only for a press, and says
      how far along it is by `onExtractorUpdate`.
    */
    AsyncFunction("extractorVersionsAsync") {
      YouTubeEngine.versions(context)
    }.runOnQueue(io)

    AsyncFunction("extractorLatestAsync") {
      ExtractorUpdate.latest()
    }.runOnQueue(io)

    AsyncFunction("updateExtractorAsync") { version: String ->
      val self = java.lang.ref.WeakReference(this@JukeboxDownloadsModule)
      ExtractorUpdate.update(context, version, gone) { phase, percent ->
        self.get()?.takeIf { it.alive.get() }?.let { module ->
          runCatching { module.sendEvent("onExtractorUpdate", mapOf("phase" to phase, "percent" to percent)) }
        }
      }
    }.runOnQueue(io)

    AsyncFunction("restoreExtractorAsync") {
      ExtractorUpdate.restore(context, gone)
    }.runOnQueue(io)
  }
}
