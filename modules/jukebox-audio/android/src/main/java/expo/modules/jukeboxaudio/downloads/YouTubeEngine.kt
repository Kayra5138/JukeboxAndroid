package expo.modules.jukeboxaudio.downloads

import android.content.Context
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

object YouTubeEngine {
  private var initialized = false
  private val timer = Executors.newSingleThreadScheduledExecutor()
  private val searches = ConcurrentHashMap<String, AtomicBoolean>()
  private val searchLock = Any()
  private val earlyCancellations = linkedSetOf<String>()

  /** Every request made of YouTube from here waits its turn at this. */
  val gate = YouTubeGate()

  /** Whether the search known as [id] has been asked for and has not ended. */
  fun searching(id: String): Boolean = searches.containsKey(id)

  @Synchronized
  private fun init(context: Context) {
    if (initialized) return
    YoutubeDL.init(context)
    FFmpeg.getInstance().init(context)
    val directory = File(context.noBackupFilesDir, "${YoutubeDL.baseName}/${YoutubeDL.ytdlpDirName}")
    val versionFile = File(directory, "jukebox-version")
    // Written by the build next to the extractor it fetched; see build.gradle.
    val version = context.assets.open("jukebox-yt-dlp-version").use { it.readBytes().decodeToString().trim() }
    if (!File(directory, YoutubeDL.ytdlpBin).exists() || !versionFile.exists() || versionFile.readText() != version) {
      val target = File(directory, "jukebox-new")
      context.assets.open("jukebox-yt-dlp").use { input -> target.outputStream().use { input.copyTo(it) } }
      if (!target.renameTo(File(directory, YoutubeDL.ytdlpBin))) throw YouTubeTrouble(Failure.ENGINE)
      versionFile.writeText(version)
    }
    initialized = true
  }

  private fun request(input: String, playlist: Boolean = false) = YoutubeDLRequest(input).apply {
    addOption("--ignore-config")
    addOption(if (playlist) "--yes-playlist" else "--no-playlist")
    addOption("--no-colors")
    addOption("--socket-timeout", "15")
    addOption("--retries", "2")
    addOption("--fragment-retries", "2")
  }

  /** Repeated cancellation closes the race between cancel and ProcessBuilder.start. */
  private fun execute(request: YoutubeDLRequest, cancelled: AtomicBoolean, timeoutSeconds: Long,
    progress: ((Float, Long, String) -> Unit)? = null): String {
    check(!cancelled.get()) { "Cancelled" }
    val processId = UUID.randomUUID().toString()
    val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds)
    val timedOut = AtomicBoolean(false)
    val watch = timer.scheduleAtFixedRate({
      if (System.nanoTime() >= deadline) timedOut.set(true)
      if (cancelled.get() || timedOut.get()) YoutubeDL.destroyProcessById(processId)
    }, 0, 250, TimeUnit.MILLISECONDS)
    try {
      val response = YoutubeDL.execute(request, processId, progress)
      if (timedOut.get()) throw YouTubeTrouble(Failure.TIMED_OUT)
      check(!cancelled.get()) { "Cancelled" }
      return response.out
    } catch (error: Exception) {
      if (timedOut.get() && error !is YouTubeTrouble) throw YouTubeTrouble(Failure.TIMED_OUT, cause = error)
      throw error
    } finally { watch.cancel(false) }
  }

  /**
   * A search, or the reading of a playlist.
   *
   * [forQueue] is a search for a job that was asked for by name, which waits
   * for whatever is being fetched and gives way to a search made by hand:
   * see [YouTubeGate]. It is known by its job's id, and is over with
   * [YouTubeGate.GaveWay] when it gave way.
   */
  fun search(context: Context, query: String, searchId: String, playlist: Boolean = false, forQueue: Boolean = false): List<JSONObject> {
    require(Regex("[A-Za-z0-9-]{1,80}").matches(searchId))
    val cancelled = AtomicBoolean(false)
    synchronized(searchLock) {
      cancelled.set(earlyCancellations.remove(searchId))
      check(searches.putIfAbsent(searchId, cancelled) == null)
    }
    try {
      check(!cancelled.get()) { "Cancelled" }
      init(context)
      val input = if (playlist) YouTubeData.playlistQuery(query) else YouTubeData.input(query)
      val playlistSearch = playlist && input.startsWith("https://www.youtube.com/results?")
      val request = request(input, playlist).apply {
        addOption("--skip-download")
        addOption("--dump-single-json")
        if (playlist) { addOption("--playlist-end", if (playlistSearch) "20" else "500"); addOption("--ignore-errors") }
        if (playlist || input.startsWith("ytsearch")) addOption("--flat-playlist")
      }
      val response = gate.hold(if (forQueue) YouTubeGate.For.FIND else YouTubeGate.For.HAND, cancelled) {
        JSONObject(execute(request, cancelled, if (playlist) 120 else 60))
      }
      if (playlistSearch) return YouTubeData.playlists(response)
      val videos = YouTubeData.results(response, if (playlist) 500 else 20)
      if (playlist) {
        val source = JSONObject().put("id", input.substringAfter("list="))
          .put("name", response.optString("title").takeUnless { it.isBlank() || it == "null" } ?: "YouTube playlist")
        videos.forEach { it.put("sourcePlaylist", source) }
      }
      return videos
    } finally {
      searches.remove(searchId)
      // Whoever typed it is done with YouTube for now, which Discover's own wait to hear.
      if (!forQueue) DownloadStore.touched()
    }
  }

  /**
   * Stops a search. One that has not begun is remembered, to be stopped as
   * it does — unless [remember] is false, which is for the queue's: its
   * search goes by its job's id, and a job that is tried again must not be
   * stopped by a cancellation meant for the last try.
   */
  fun cancelSearch(id: String, remember: Boolean = true) {
    synchronized(searchLock) {
      val token = searches[id]
      if (token != null) token.set(true)
      else if (remember) {
        // Expo's cancel call may run before the search reaches the IO queue.
        if (earlyCancellations.size >= 32) earlyCancellations.remove(earlyCancellations.first())
        earlyCancellations.add(id)
      }
    }
  }

  fun download(context: Context, id: String, format: String, directory: File, cancelled: AtomicBoolean, discovery: JSONObject? = null,
    progress: (String, Int) -> Unit): Pair<File, JSONObject> {
    init(context)
    val url = YouTubeData.url(id)
    progress("preparing", 0)
    return gate.hold(YouTubeGate.For.DOWNLOAD, cancelled) { fetch(context, url, format, directory, cancelled, discovery, progress) }
  }

  private fun fetch(context: Context, url: String, format: String, directory: File, cancelled: AtomicBoolean, discovery: JSONObject?,
    progress: (String, Int) -> Unit): Pair<File, JSONObject> {
    val info = JSONObject(execute(request(url).apply {
      addOption("--skip-download"); addOption("--dump-single-json")
    }, cancelled, 60))
    val video = YouTubeData.video(info) ?: throw YouTubeTrouble(Failure.LIVE)
    if (info.optDouble("duration", 0.0) > 7200) throw YouTubeTrouble(Failure.TOO_LONG)
    directory.mkdirs()
    DownloadMetadata.prepare(info)
    // The catalogue lookup supplies both credits and artwork, before the file is tagged.
    runCatching { DownloadArtwork.resolve(context, info, video, cancelled) }
      .getOrNull()?.let { video.put("artworkUri", it) }
    check(!cancelled.get()) { "Cancelled" }
    discovery?.optString("discoveryTitle")?.takeIf { it.isNotBlank() }?.let { info.put("meta_title", it) }
    discovery?.optString("discoveryArtist")?.takeIf { it.isNotBlank() }?.let { info.put("meta_artist", it) }
    video.put("title", info.getString("meta_title")).put("artist", info.getString("meta_artist"))
    val request = request(url).apply {
      addOption("-f", "bestaudio/best")
      addOption("-x")
      addOption("--audio-format", if (format == "mp3") "mp3" else "best")
      if (format == "mp3") addOption("--audio-quality", "0")
      addOption("--max-filesize", "300M")
      addOption("--newline")
      addOption("--output", File(directory, "audio.%(ext)s").absolutePath)
      addOption("--embed-metadata")
      for (field in listOf("title", "artist", "album")) {
        addOption("--parse-metadata", DownloadMetadata.option(field, info.getString("meta_$field")))
      }
    }
    var converting = false
    execute(request, cancelled, 1800) { percent, _, line ->
      converting = converting || line.startsWith("[ExtractAudio]") || line.startsWith("[Metadata]")
      progress(if (converting) "converting" else "downloading", percent.toInt().coerceIn(0, 100))
    }
    val audio = directory.listFiles()?.singleOrNull {
      it.isFile && it.extension.lowercase() in setOf("mp3", "m4a", "opus", "ogg", "aac", "flac", "wav", "mp4")
    } ?: throw YouTubeTrouble(Failure.NO_AUDIO)
    return audio to video
  }
}
