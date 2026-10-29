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
    cacheDirectory = File(context.cacheDir, "yt-dlp").absolutePath
    initialized = true
  }

  /**
   * Where yt-dlp may keep what it worked out, between one song and the next.
   *
   * Without one the library runs it with `--no-cache-dir`, and every song
   * fetched YouTube's player script again (some 2.7 MB) and had QuickJS take
   * it apart again before the video's address could be read: half a minute
   * of a whole core for each song, which is what a long list of downloads
   * spent its heat on. With it, that is done once for each new player, which
   * YouTube puts out every few days. In the cache, since it is only ever
   * time saved, and the system may clear it whenever it likes.
   */
  @Volatile private var cacheDirectory: String? = null

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
    cacheDirectory?.let { addOption("--cache-dir", it) }
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
   * The chapters of the video [id], read afresh: for a tape fetched before
   * chapters were kept. Answers with them as [TapeChapters] keeps them, or
   * an empty list for a video that has none.
   */
  fun chapters(context: Context, id: String): org.json.JSONArray {
    init(context)
    val cancelled = AtomicBoolean(false)
    val directory = File(context.cacheDir, "chapters-${UUID.randomUUID()}").apply { mkdirs() }
    try {
      val request = request(YouTubeData.url(id)).apply {
        addOption("--skip-download")
        addCommands(listOf("--print-to-file", "%(chapters)j", File(directory, "chapters.json").absolutePath))
      }
      gate.hold(YouTubeGate.For.FIND, cancelled) { execute(request, cancelled, 60) }
      return TapeChapters.read(File(directory, "chapters.json")) ?: org.json.JSONArray()
    } finally {
      directory.deleteRecursively()
    }
  }

  /**
   * What is said in the video [id], as its captions have it (see
   * [TapeTranscripts.addressIn] for which): its lines, or an empty list for a
   * video with none.
   */
  fun transcript(context: Context, id: String): org.json.JSONArray {
    init(context)
    val cancelled = AtomicBoolean(false)
    val request = request(YouTubeData.url(id)).apply {
      addOption("--skip-download")
      addOption("--dump-single-json")
    }
    val info = gate.hold(YouTubeGate.For.FIND, cancelled) { JSONObject(execute(request, cancelled, 90)) }
    val address = TapeTranscripts.addressIn(info) ?: return org.json.JSONArray()
    return TapeTranscripts.linesOf(TapeTranscripts.fetch(address))
  }

  /**
   * A YouTube channel read as a show: its latest videos, from its Videos tab,
   * newest first, each with how long it is and about when it came out — the
   * day being YouTube's "two weeks ago" turned back into a date, which is near
   * enough to put them in order and name their files by. Shorts and streams
   * are tabs of their own, and so are not among them.
   */
  fun channel(context: Context, address: String): expo.modules.jukeboxaudio.podcasts.Show {
    val id = expo.modules.jukeboxaudio.podcasts.PodcastFeed.channelIdOf(address) ?: throw YouTubeTrouble(Failure.INVALID_VIDEO)
    init(context)
    val cancelled = AtomicBoolean(false)
    val request = request("https://www.youtube.com/channel/$id/videos", true).apply {
      addOption("--skip-download")
      addOption("--dump-single-json")
      addOption("--flat-playlist")
      addOption("--playlist-end", "30")
      addOption("--ignore-errors")
      addOption("--extractor-args", "youtubetab:approximate_date")
    }
    val json = gate.hold(YouTubeGate.For.HAND, cancelled) { JSONObject(execute(request, cancelled, 120)) }
    val name = json.optString("channel").ifBlank { json.optString("uploader") }.takeUnless { it.isBlank() || it == "null" }
      ?: json.optString("title").removeSuffix(" - Videos").ifBlank { "YouTube" }
    val thumbs = json.optJSONArray("thumbnails")
    val pictures = (0 until (thumbs?.length() ?: 0)).mapNotNull { thumbs?.optJSONObject(it) }
    // The channel's own picture, square, not one of the banners across its page.
    val avatar = pictures.firstOrNull { it.optString("id") == "avatar_uncropped" }
      ?: pictures.lastOrNull { it.optInt("width") > 0 && it.optInt("width") == it.optInt("height") }
    val entries = json.optJSONArray("entries")
    val episodes = (0 until (entries?.length() ?: 0)).mapNotNull { index ->
      val entry = entries?.optJSONObject(index) ?: return@mapNotNull null
      val video = YouTubeData.video(entry) ?: return@mapNotNull null
      val stamp = entry.optLong("timestamp", 0L).takeIf { it > 0 }
        ?: entry.optLong("release_timestamp", 0L).takeIf { it > 0 }
      expo.modules.jukeboxaudio.podcasts.Episode(
        guid = video.getString("id"),
        title = video.optString("title"),
        url = video.getString("url"),
        type = null,
        bytes = null,
        publishedAt = stamp?.times(1000),
        durationSec = video.optDouble("duration").takeIf { it.isFinite() && it > 0 },
        episode = null,
        season = null,
        image = video.optString("thumbnail").takeIf { it.startsWith("https://") },
        summary = entry.optString("description").takeUnless { it.isBlank() || it == "null" }?.take(600),
      )
    }
    return expo.modules.jukeboxaudio.podcasts.Show(
      title = name,
      author = name,
      image = avatar?.optString("url")?.takeIf { it.startsWith("https://") },
      summary = json.optString("description").takeUnless { it.isBlank() || it == "null" }?.take(600),
      link = "https://www.youtube.com/channel/$id",
      episodes = episodes,
    )
  }

  /**
   * YouTube channels by [words], as YouTube's own search finds them with its
   * filter for channels, the nearest first: each by its id, its name, its
   * handle and its picture, to be followed as a show by its channel's page.
   */
  fun channels(context: Context, words: String): List<Map<String, Any?>> {
    init(context)
    val cancelled = AtomicBoolean(false)
    val address = "https://www.youtube.com/results?search_query=${java.net.URLEncoder.encode(words.trim(), "UTF-8")}&sp=EgIQAg%3D%3D"
    val request = request(address, true).apply {
      addOption("--skip-download")
      addOption("--dump-single-json")
      addOption("--flat-playlist")
      addOption("--playlist-end", "6")
      addOption("--ignore-errors")
    }
    val json = gate.hold(YouTubeGate.For.HAND, cancelled) { JSONObject(execute(request, cancelled, 90)) }
    val entries = json.optJSONArray("entries") ?: return emptyList()
    return (0 until entries.length()).mapNotNull { index ->
      val entry = entries.optJSONObject(index) ?: return@mapNotNull null
      val id = entry.optString("channel_id").ifBlank { entry.optString("id") }
      if (!Regex("UC[A-Za-z0-9_-]{22}").matches(id)) return@mapNotNull null
      val thumbs = entry.optJSONArray("thumbnails")
      val picture = (0 until (thumbs?.length() ?: 0)).mapNotNull { thumbs?.optJSONObject(it) }
        .maxByOrNull { it.optInt("width") }?.optString("url")
        ?.let { if (it.startsWith("//")) "https:$it" else it }?.takeIf { it.startsWith("https://") }
      mapOf(
        "id" to id,
        "title" to entry.optString("channel").ifBlank { entry.optString("title") }.ifBlank { id },
        "handle" to entry.optString("uploader_id").takeIf { it.startsWith("@") },
        "image" to picture,
        "followers" to entry.optLong("channel_follower_count", -1L).takeIf { it >= 0 },
      )
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
    // A file fetched as it is, a podcast's episode, from its own address; anything else is a video of YouTube's.
    val url = if (discovery?.optBoolean("direct") == true) YouTubeData.direct(discovery.optString("url")) else YouTubeData.url(id)
    progress("preparing", 0)
    return gate.hold(YouTubeGate.For.DOWNLOAD, cancelled) {
      if (discovery?.optJSONObject("tape") != null) fetchTape(context, url, directory, cancelled, discovery, progress)
      else if (discover && discovery != null) fetchKnown(context, url, format, directory, cancelled, discovery, progress)
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

  /**
   * A tape: a book, an episode, a talk, a recording of an evening, fetched
   * to be listened to a stretch at a time from the Tapes folder.
   *
   * Nothing like a song, and nothing of a song's asked. No catalogue: what
   * it is called is what the video is called, whose it is is the channel's,
   * and the record it is on is the list or the show it was fetched as part
   * of. No length it may not be, since a book runs for hours, and room for
   * one. The sound is kept as it came, an m4a where there is one, since a
   * voice loses nothing to the encoding and turning hours of it into an mp3
   * is a long wait for a larger file. The chapters the video has are kept in
   * the file.
   *
   * Not SponsorBlock's marks, which the extractor can write in as chapters:
   * when it cannot reach SponsorBlock it fails the whole download, and says
   * it could not reach YouTube. The stretches to pass over are the player's
   * to ask about as it plays, where not reaching anybody costs nothing.
   */
  private fun fetchTape(context: Context, url: String, directory: File, cancelled: AtomicBoolean, video: JSONObject,
    progress: (String, Int) -> Unit): Pair<File, JSONObject> {
    directory.mkdirs()
    val tape = video.getJSONObject("tape")
    // A part of a book is called what it is within the book, without the book's name the video gives it first.
    val title = tape.optString("title").ifBlank { video.optString("title") }.ifBlank { "YouTube audio" }
    val artist = video.optString("channel")
    // The list it is a part of, or, fetched on its own, itself: two books from one channel are two books.
    val album = tape.optString("album").ifBlank { tape.optString("name") }.ifBlank { artist }
    // A podcast's episode wears its show's picture, from wherever the feed keeps it; a video, its own.
    val artwork = if (video.optBoolean("direct")) {
      video.text("thumbnail")?.let { cover -> runCatching { expo.modules.jukeboxaudio.AlbumArtwork.download(context, cover, anyHost = true) }.getOrNull() }
    } else {
      runCatching { DownloadArtwork.carried(context, null, video, cancelled) }.getOrNull()
    }
    check(!cancelled.get()) { "Cancelled" }
    /*
      A file of its own — a podcast's episode, a book's part — fetched here
      first, tried again as the way to it gives out (see [DirectFetch]); the
      extractor then only names and tags the copy on the phone.
    */
    val direct = video.optBoolean("direct")
    val source = if (direct) {
      val ending = url.substringBefore('?').substringAfterLast('/').substringAfterLast('.', "").lowercase().takeIf { it in AUDIO } ?: "mp3"
      val whole = DirectFetch.fetch(url, File(directory, "source/whole.$ending"), cancelled) { share -> progress("downloading", share) }
      "file://${whole.absolutePath}"
    } else url
    val request = request(source).apply {
      if (direct) addOption("--enable-file-urls")
      addOption("-f", "bestaudio[ext=m4a]/bestaudio/best")
      addOption("-x")
      addOption("--audio-format", "best")
      addOption("--match-filter", "!is_live")
      addOption("--max-filesize", "1500M")
      addOption("--newline")
      addOption("--output", File(directory, "audio.%(ext)s").absolutePath)
      addOption("--embed-metadata")
      addOption("--embed-chapters")
      addOption("--parse-metadata", DownloadMetadata.option("title", title))
      addOption("--parse-metadata", DownloadMetadata.option("artist", artist))
      addOption("--parse-metadata", DownloadMetadata.option("album", album))
      tape.optInt("part", 0).takeIf { it > 0 }?.let { addOption("--parse-metadata", DownloadMetadata.option("track", it.toString())) }
      // A video's chapters, written down beside it as well as into it, for the player to list (see [TapeChapters]).
      if (!direct) addCommands(listOf("--print-to-file", "%(chapters)j", File(directory, "chapters.json").absolutePath))
    }
    var converting = false
    var refused = false
    val said = StringBuilder()
    try {
      execute(request, cancelled, TAPE_TIMEOUT_SECONDS) { percent, _, line ->
        if (said.length < 8_000) said.appendLine(line)
        refused = refused || line.contains("does not pass filter")
        converting = converting || line.startsWith("[ExtractAudio]") || line.startsWith("[Metadata]") || line.startsWith("[EmbedChapters]")
        // The copy on the phone is only read over, which is no download: its own fetch said how that went.
        progress(if (converting || direct) "converting" else "downloading", if (direct) 100 else percent.toInt().coerceIn(0, 100))
      }
    } finally {
      File(directory, "source").deleteRecursively()
    }
    val audio = directory.listFiles()?.singleOrNull { it.isFile && it.extension.lowercase() in AUDIO }
      ?: throw YouTubeTrouble(if (refused) Failure.LIVE else Failure.NO_AUDIO)
    val info = JSONObject().put("id", video.getString("id")).put("url", url)
      .put("title", title).put("artist", artist).put("album", album)
      .put("channel", artist)
      .put("thumbnail", video.text("thumbnail") ?: JSONObject.NULL)
      .put("duration", video.optDouble("duration").takeIf { it.isFinite() && it > 0 } ?: JSONObject.NULL)
    artwork?.let { info.put("artworkUri", it) }
    TapeChapters.read(File(directory, "chapters.json"))?.let { info.put("chapters", it) }
    return audio to info
  }

  /** Long enough for hours of a book over a slow connection. */
  private const val TAPE_TIMEOUT_SECONDS = 4L * 60 * 60

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
