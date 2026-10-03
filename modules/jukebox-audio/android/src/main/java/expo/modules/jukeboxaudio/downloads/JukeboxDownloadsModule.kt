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
  override fun definition() = ModuleDefinition {
    Name("JukeboxDownloads")
    OnDestroy { io.cancel() }

    AsyncFunction("discoverNetworkAsync") {
      DiscoverFiles.networkAllowed(context)
    }.runOnQueue(io)
    AsyncFunction("enqueueDiscoverAsync") { video: Map<String, Any?>, key: String ->
      DownloadStore.init(context)
      val id = DownloadStore.enqueue(context, JSONObject(video), "mp3", "Music", key)
      try { context.startForegroundService(Intent(context, DownloadService::class.java)) }
      catch (error: Exception) {
        DownloadStore.failPending("Open Discover to resume downloads.")
        throw error
      }
      id
    }.runOnQueue(io)
    AsyncFunction("queueDiscoverBackgroundAsync") { video: Map<String, Any?>, key: String ->
      DownloadStore.init(context)
      DownloadStore.enqueue(context, JSONObject(video), "mp3", "Music", key)
    }.runOnQueue(io)
    AsyncFunction("downloadDiscoverBackgroundAsync") { id: String ->
      DownloadStore.init(context)
      DownloadStore.takeById(id)?.let { job -> DiscoverFiles.downloadInBackground(context, job) }
    }.runOnQueue(io)
    AsyncFunction("prioritizeDiscoverAsync") { id: String ->
      DownloadStore.init(context)
      DownloadStore.prioritizeDiscovery(id)
      try { context.startForegroundService(Intent(context, DownloadService::class.java)) }
      catch (error: Exception) {
        DownloadStore.change(id, "failed", error = "Open Discover to retry this download.")
        throw error
      }
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
      catch (error: Exception) { throw IllegalStateException(friendlyError(error), error) }
    }.runOnQueue(io)

    AsyncFunction("playlistAsync") { query: String, searchId: String ->
      try { YouTubeEngine.search(context, query, searchId, true).map(YouTubeData::map) }
      catch (error: Exception) { throw IllegalStateException(friendlyError(error), error) }
    }.runOnQueue(io)

    AsyncFunction("enqueueBatchAsync") { videos: List<Map<String, Any?>>, format: String, folder: String ->
      DownloadStore.init(context)
      val ids = DownloadStore.enqueueBatch(context, videos.map { JSONObject(it) }, format, folder)
      try { context.startForegroundService(Intent(context, DownloadService::class.java)) }
      catch (error: Exception) {
        DownloadStore.failPending("Open Search and retry the download.")
        throw error
      }
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
      try { context.startForegroundService(Intent(context, DownloadService::class.java)) }
      catch (error: Exception) {
        DownloadStore.failPending("Open Search and retry the download.")
        throw error
      }
      id
    }.runOnQueue(io)

    AsyncFunction("cancelAsync") { id: String ->
      DownloadStore.init(context)
      if (DownloadStore.cancel(id)) DownloadService.cancel(id)
    }.runOnQueue(io)

    AsyncFunction("markDescribedAsync") { id: String ->
      DownloadStore.init(context)
      DownloadStore.described(id)
    }.runOnQueue(io)
  }
}
