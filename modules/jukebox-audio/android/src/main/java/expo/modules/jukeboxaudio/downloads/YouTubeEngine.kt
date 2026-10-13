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

  /**
   * Where the extractor is kept, and the three things done to it there.
   *
   * Two files matter: the extractor, and a note beside it of which version
   * it is. The build carries a copy and its version as assets; an update
   * fetched on the phone is written over the same file and the same note
   * (see [ExtractorUpdate]). A third file, `jukebox-previous`, is there only
   * for the moment a new one is being tried.
   */
  class Place(private val context: Context) {
    val directory = File(context.noBackupFilesDir, "${YoutubeDL.baseName}/${YoutubeDL.ytdlpDirName}")
    private val binary = File(directory, YoutubeDL.ytdlpBin)
    private val note = File(directory, "jukebox-version")
    private val previous = File(directory, "jukebox-previous")

    /** Written by the build next to the extractor it fetched; see build.gradle. */
    val carried: String by lazy {
      context.assets.open("jukebox-yt-dlp-version").use { it.readBytes().decodeToString().trim() }
    }

    /**
     * Whether what is here is to be left alone: a whole extractor that is
     * the build's own or newer. One that an update was in the middle of
     * trying when the app was closed is not: which of the two files is which
     * is no longer certain, and the build's own is.
     */
    private val sound: Boolean get() = binary.exists() && !previous.exists() &&
      ExtractorVersion.keeps(runCatching { note.readText().trim() }.getOrNull(), carried)

    /** The version that is installed, or will be the first time the extractor is wanted. */
    val installed: String get() = if (sound) note.readText().trim() else carried

    /** Puts the build's own copy in place, and answers with its version. */
    fun bundled(): String {
      directory.mkdirs()
      val target = File(directory, "jukebox-new")
      context.assets.open("jukebox-yt-dlp").use { input -> target.outputStream().use { input.copyTo(it) } }
      if (!target.renameTo(binary)) throw YouTubeTrouble(Failure.ENGINE)
      note.writeText(carried)
      previous.delete()
      return carried
    }

    fun settle() { if (!sound) bundled() }

    /**
     * Puts [fresh] in the extractor's place if it runs, and answers with the
     * version it says it is. If it does not, what was there is back and
     * nothing has changed. Only for whoever has the door to themselves.
     */
    fun replace(fresh: File): String {
      previous.delete()
      if (!binary.renameTo(previous)) throw ExtractorTrouble(ExtractorTrouble.Kind.FAILED)
      try {
        if (!fresh.renameTo(binary)) throw ExtractorTrouble(ExtractorTrouble.Kind.FAILED)
        val version = runCatching { answers() }.getOrNull()?.takeIf { ExtractorVersion.valid(it) }
          ?: throw ExtractorTrouble(ExtractorTrouble.Kind.BROKEN)
        note.writeText(version)
        previous.delete()
        return version
      } catch (error: Exception) {
        binary.delete()
        // Left as `jukebox-previous` where even this fails, which the next start reads as "put the build's own back".
        previous.renameTo(binary)
        throw error
      }
    }
  }

  @Synchronized
  private fun init(context: Context) {
    if (initialized) return
    YoutubeDL.init(context)
    FFmpeg.getInstance().init(context)
    Place(context).settle()
    initialized = true
  }

  /** The versions there are to speak of, without unpacking anything: the one installed and the one this build carries. */
  fun versions(context: Context): Map<String, String> =
    Place(context).let { mapOf("installed" to it.installed, "bundled" to it.carried) }

  /**
   * Does [work] on the extractor's own files with nothing else running it,
   * or about to: see [YouTubeGate.For.UPDATE].
   */
  fun <T> alone(context: Context, cancelled: AtomicBoolean, work: (Place) -> T): T {
    init(context)
    return gate.hold(YouTubeGate.For.UPDATE, cancelled) { work(Place(context)) }
  }

  /** What the extractor in place says its version is, which it can only say if it runs at all. */
  private fun answers(): String =
    execute(YoutubeDLRequest(emptyList<String>()).apply { addOption("--ignore-config"); addOption("--version") }, AtomicBoolean(false), 60).trim()

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

  /**
   * Fetches one video's audio. [discovery] is the job's video, for what it
   * says the file is to be tagged as.
   *
   * [discover] is one of Discover's own songs, which is fetched the short
   * way: see [fetchKnown].
   */
  fun download(context: Context, id: String, format: String, directory: File, cancelled: AtomicBoolean, discovery: JSONObject? = null,
    discover: Boolean = false, progress: (String, Int) -> Unit): Pair<File, JSONObject> {
    init(context)
    val url = YouTubeData.url(id)
    progress("preparing", 0)
    return gate.hold(YouTubeGate.For.DOWNLOAD, cancelled) {
      if (discover && discovery != null) fetchKnown(context, url, format, directory, cancelled, discovery, progress)
      else fetch(context, url, format, directory, cancelled, discovery, progress)
    }
  }

  /**
   * A song of Discover's: one run of the extractor and no catalogue.
   *
   * [fetch] asks YouTube about the video first and Apple about the song
   * after, and only then downloads. Both are there to find out what the file
   * is: what to call it, whose it is, which sleeve goes with it. Discover
   * knows all of that before it asks — the song was chosen by name out of a
   * catalogue, and the video was chosen for being that recording, of about
   * that length — so the two questions cost a second launch of the extractor
   * and up to two paced lookups, on a phone with somebody waiting to hear the
   * song, to learn what was already written on the job.
   *
   * What the first question also did was refuse a live stream and anything
   * over two hours. The finder has refused both already (it takes nothing
   * without a length, nor over twenty minutes), and the filter below says it
   * once more to the extractor itself, which then leaves no file.
   *
   * The sleeve is not this function's business at all. It used to be
   * fetched beside the download and then waited for, for up to four seconds
   * after the song was in — on an archive that often takes that long — which
   * was most of the pause between a download ending and the song starting.
   * It is fetched from the moment the song is asked for, kept apart, and
   * joined to the file by whoever stores it: see [DownloadArtwork].
   */
  private fun fetchKnown(context: Context, url: String, format: String, directory: File, cancelled: AtomicBoolean, known: JSONObject,
    progress: (String, Int) -> Unit): Pair<File, JSONObject> {
    directory.mkdirs()
    val title = known.optString("discoveryTitle").ifBlank { known.optString("title") }.ifBlank { "YouTube audio" }
    val artist = known.optString("discoveryArtist").ifBlank { known.optString("channel") }
    val album = if (known.isNull("discoveryAlbum")) "" else known.optString("discoveryAlbum")
    val video = JSONObject().put("id", known.getString("id")).put("url", url)
      .put("title", title).put("artist", artist).put("album", album)
      .put("channel", known.optString("channel"))
      .put("thumbnail", known.text("thumbnail") ?: JSONObject.NULL)
      .put("duration", known.optDouble("duration").takeIf { it.isFinite() && it > 0 } ?: JSONObject.NULL)
    val request = request(url).apply {
      addOption("-f", "bestaudio/best")
      addOption("-x")
      addOption("--audio-format", if (format == "mp3") "mp3" else "best")
      if (format == "mp3") addOption("--audio-quality", "0")
      addOption("--match-filter", "!is_live & duration<?7200")
      addOption("--max-filesize", "300M")
      addOption("--newline")
      addOption("--output", File(directory, "audio.%(ext)s").absolutePath)
      addOption("--embed-metadata")
      addOption("--parse-metadata", DownloadMetadata.option("title", title))
      addOption("--parse-metadata", DownloadMetadata.option("artist", artist))
      // Left to what the video says of itself where the catalogue named no record.
      if (album.isNotBlank()) addOption("--parse-metadata", DownloadMetadata.option("album", album))
    }
    var converting = false
    var refused = false
    val said = execute(request, cancelled, 1800) { percent, _, line ->
      refused = refused || YouTubeData.filteredOut(line)
      converting = converting || line.startsWith("[ExtractAudio]") || line.startsWith("[Metadata]")
      progress(if (converting) "converting" else "downloading", percent.toInt().coerceIn(0, 100))
    }
    val audio = directory.listFiles()?.singleOrNull { it.isFile && it.extension.lowercase() in AUDIO }
      // Left alone by the filter above, which is an answer about the video and not a download gone wrong.
      ?: throw YouTubeTrouble(if (refused || YouTubeData.filteredOut(said)) Failure.NOT_A_SONG else Failure.NO_AUDIO)
    return audio to video
  }

  /** What the extractor may leave behind as the audio, by its ending. */
  private val AUDIO = setOf("mp3", "m4a", "opus", "ogg", "aac", "flac", "wav", "mp4")

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
    val audio = directory.listFiles()?.singleOrNull { it.isFile && it.extension.lowercase() in AUDIO }
      ?: throw YouTubeTrouble(Failure.NO_AUDIO)
    return audio to video
  }
}
