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
