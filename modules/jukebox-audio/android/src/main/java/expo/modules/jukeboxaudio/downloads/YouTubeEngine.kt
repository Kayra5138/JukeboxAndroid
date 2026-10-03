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
  private const val VERSION = "2026.08.19"
  private var initialized = false
  private val timer = Executors.newSingleThreadScheduledExecutor()
  private val searches = ConcurrentHashMap<String, AtomicBoolean>()
  private val searchLock = Any()
  private val earlyCancellations = linkedSetOf<String>()

  @Synchronized
  private fun init(context: Context) {
    if (initialized) return
    YoutubeDL.init(context)
    FFmpeg.getInstance().init(context)
    val directory = File(context.noBackupFilesDir, "${YoutubeDL.baseName}/${YoutubeDL.ytdlpDirName}")
    val versionFile = File(directory, "jukebox-version")
    if (!File(directory, YoutubeDL.ytdlpBin).exists() || !versionFile.exists() || versionFile.readText() != VERSION) {
      val target = File(directory, "jukebox-new")
      context.assets.open("jukebox-yt-dlp").use { input -> target.outputStream().use { input.copyTo(it) } }
      check(target.renameTo(File(directory, YoutubeDL.ytdlpBin))) { "Could not prepare the YouTube engine." }
      versionFile.writeText(VERSION)
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
      check(!cancelled.get() && !timedOut.get()) { if (timedOut.get()) "YouTube took too long to respond. Try again." else "Cancelled" }
      return response.out
    } catch (error: Exception) {
      if (timedOut.get()) throw IllegalStateException("YouTube took too long to respond. Try again.", error)
      throw error
    } finally { watch.cancel(false) }
  }

  fun search(context: Context, query: String, searchId: String, playlist: Boolean = false): List<JSONObject> {
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
      val response = JSONObject(execute(request, cancelled, if (playlist) 120 else 60))
      if (playlistSearch) return YouTubeData.playlists(response)
      val videos = YouTubeData.results(response, if (playlist) 500 else 20)
      if (playlist) {
        val source = JSONObject().put("id", input.substringAfter("list="))
          .put("name", response.optString("title").takeUnless { it.isBlank() || it == "null" } ?: "YouTube playlist")
        videos.forEach { it.put("sourcePlaylist", source) }
      }
      return videos
    } finally { searches.remove(searchId) }
  }

  fun cancelSearch(id: String) {
    synchronized(searchLock) {
      val token = searches[id]
      if (token != null) token.set(true)
      else {
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
    val info = JSONObject(execute(request(url).apply {
      addOption("--skip-download"); addOption("--dump-single-json")
    }, cancelled, 60))
    val video = YouTubeData.video(info) ?: error("Live streams and upcoming videos cannot be downloaded.")
    require(info.optDouble("duration", 0.0) <= 7200) { "Choose a recording shorter than two hours." }
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
    } ?: error("YouTube did not produce an audio file.")
    return audio to video
  }
}
