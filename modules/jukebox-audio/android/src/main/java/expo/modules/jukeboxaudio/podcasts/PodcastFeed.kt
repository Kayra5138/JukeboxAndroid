package expo.modules.jukeboxaudio.podcasts

import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Locale
import javax.xml.parsers.SAXParserFactory
import org.xml.sax.Attributes
import org.xml.sax.InputSource
import org.xml.sax.helpers.DefaultHandler

/**
 * A podcast's feed, read: the show, and its episodes with the file each one
 * is. An RSS feed is the whole of a podcast — every app reads the same one —
 * and needs nobody's key.
 *
 * Read as it streams, not built into a tree: a show with a thousand episodes
 * is a feed of several megabytes, and only a few lines of each are wanted.
 *
 * A YouTube channel is followed the same way, its videos its episodes, each
 * fetched by YouTube's address rather than as a file. It is read by the
 * extractor (`YouTubeEngine.channel`), not here: the Atom feeds YouTube kept
 * of each channel answer nothing now. Its page — its `@name` or `/channel/`
 * address — is taken here to the one address it keeps, by its id. An Atom
 * feed is still read, should one be given.
 */
data class Episode(
  val guid: String,
  val title: String,
  val url: String,
  val type: String?,
  val bytes: Long?,
  /** Milliseconds, or null where the feed gives no date that can be read. */
  val publishedAt: Long?,
  val durationSec: Double?,
  val episode: Int?,
  val season: Int?,
  val image: String?,
  val summary: String?,
  /** Its chapters as a file of their own, where the feed gives one: Podcasting 2.0's `podcast:chapters`. */
  val chaptersUrl: String? = null,
  /** What is said in it, where the feed gives a file of it in a form that can be followed: `podcast:transcript`. */
  val transcriptUrl: String? = null,
  val transcriptType: String? = null,
)

data class Show(
  val title: String,
  val author: String?,
  val image: String?,
  val summary: String?,
  val link: String?,
  val episodes: List<Episode>,
)

object PodcastFeed {
  private const val ITUNES = "http://www.itunes.com/dtds/podcast-1.0.dtd"
  private const val PODCAST = "https://podcastindex.org/namespace/1.0"

  /** The forms of a transcript that can be followed line by line, the best first; a page of HTML is not one. */
  private val TRANSCRIPTS = listOf("application/json", "application/x-subrip", "application/srt", "text/srt", "text/vtt")
  /** A feed larger than this is not one anybody meant: a page, a file. */
  private const val MOST_BYTES = 25L * 1024 * 1024
  private const val SUMMARY_CHARS = 600

  /** The feed at [address], fetched and read. Throws where it cannot be had or is not a feed. */
  fun fetch(address: String): Show {
    // Over https, an http feed's address and every address it is sent on to: see [Secure].
    val connection = Secure.open(address) {
      it.setRequestProperty("User-Agent", "Jukebox (Android podcast reader)")
      it.setRequestProperty("Accept", "application/rss+xml, application/xml, text/xml, */*")
    }
    try {
      check(connection.responseCode == 200) { "The feed answered ${connection.responseCode}" }
      return connection.inputStream.use { parse(Limited(it, MOST_BYTES)) }
    } finally {
      connection.disconnect()
    }
  }

  private val YOUTUBE_HOSTS = setOf("youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com")
  private val CHANNEL_ID = Regex("UC[A-Za-z0-9_-]{22}")

  /** Whether [address] is YouTube's: a channel, followed as a show. */
  fun isYouTube(address: String): Boolean =
    runCatching { URL(address.trim()).host.lowercase() in YOUTUBE_HOSTS }.getOrDefault(false)

  /** The id of the channel [address] names outright — its `/channel/` page, or a feed of it — or null. */
  fun channelIdOf(address: String): String? =
    if (isYouTube(address)) CHANNEL_ID.find(address)?.value else null

  /**
   * The one address of the YouTube channel at [address], by its id: itself,
   * for one that names its id; the channel its page is, for an `@name`;
   * null where it is not a channel's address at all.
   */
  fun youtubeFeedOf(address: String): String? {
    val url = runCatching { URL(address.trim().let { if (it.contains("://")) it else "https://$it" }) }.getOrNull() ?: return null
    if (url.host.lowercase() !in YOUTUBE_HOSTS) return null
    val path = url.path.orEmpty()
    CHANNEL_ID.find(if (path.startsWith("/feeds/")) url.query.orEmpty() else path)?.value?.let { return "https://www.youtube.com/channel/$it" }
    val named = path.startsWith("/@") || path.startsWith("/c/") || path.startsWith("/user/")
    if (!named) return null
    val name = path.trimEnd('/').split('/').take(if (path.startsWith("/@")) 2 else 3).joinToString("/")
    val id = channelIdOnPage("https://www.youtube.com$name")
    return "https://www.youtube.com/channel/$id"
  }

  /** The channel's own id as its page says it: the page's own address, else what it says of itself. */
  private fun channelIdOnPage(address: String): String {
    val page = page(address)
    return Regex("rel=\"canonical\" href=\"https://www\\.youtube\\.com/channel/(UC[A-Za-z0-9_-]{22})\"").find(page)?.groupValues?.get(1)
      ?: Regex("\"externalId\":\"(UC[A-Za-z0-9_-]{22})\"").find(page)?.groupValues?.get(1)
      ?: error("No channel on the page")
  }

  /** The first megabyte of a page of YouTube's, as text, past the question about cookies. */
  private fun page(address: String): String {
    val connection = URL(address).openConnection() as HttpURLConnection
    try {
      connection.connectTimeout = 15_000
      connection.readTimeout = 30_000
      // A desktop browser's: asked as a phone, YouTube sends its mobile page, which says nothing of the channel.
      connection.setRequestProperty("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")
      connection.setRequestProperty("Accept-Language", "en")
      connection.setRequestProperty("Cookie", "SOCS=CAI; CONSENT=YES+1")
      check(connection.responseCode == 200) { "The page answered ${connection.responseCode}" }
      return connection.inputStream.use { stream ->
        val bytes = ByteArray(1024 * 1024)
        var filled = 0
        while (filled < bytes.size) {
          val read = stream.read(bytes, filled, bytes.size - filled)
          if (read < 0) break
          filled += read
        }
        String(bytes, 0, filled, Charsets.UTF_8)
      }
    } finally {
      connection.disconnect()
    }
  }

  /** A feed already in hand. */
  fun parse(input: InputStream): Show {
    val handler = Reader()
    val factory = SAXParserFactory.newInstance().apply { isNamespaceAware = true }
    runCatching { factory.setFeature("http://xml.org/sax/features/external-general-entities", false) }
    runCatching { factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false) }
    factory.newSAXParser().parse(InputSource(input), handler)
    val title = handler.show["title"]?.trim().orEmpty()
    require(title.isNotEmpty() || handler.episodes.isNotEmpty()) { "Not a podcast feed" }
    return Show(
      title = title,
      author = handler.show["author"]?.trim()?.ifEmpty { null },
      image = handler.show["image"]?.trim()?.ifEmpty { null },
      summary = handler.show["summary"]?.let(::plain)?.take(SUMMARY_CHARS)?.ifEmpty { null },
      link = handler.show["link"]?.trim()?.ifEmpty { null },
      episodes = handler.episodes,
    )
  }

  private class Reader : DefaultHandler() {
    val show = HashMap<String, String>()
    val episodes = ArrayList<Episode>()
    private var item: HashMap<String, String>? = null
    private val text = StringBuilder()
    private var depth = 0
    private var inImage = false
    /** Inside the feed's own `<author>`, an Atom feed's: its `<name>` is who the show is by. */
    private var inAuthor = false

    override fun startElement(uri: String, local: String, qName: String, attributes: Attributes) {
      depth += 1
      text.setLength(0)
      val name = local.ifEmpty { qName.substringAfter(':') }
      when {
        name == "item" || name == "entry" -> item = HashMap()
        name == "image" && uri == ITUNES -> attributes.getValue("href")?.let { (item ?: show).putIfAbsent("image", it) }
        name == "image" -> inImage = true
        name == "author" && item == null -> inAuthor = true
        // An Atom entry's page, which for a video of YouTube's says whether it is a short.
        name == "link" && item != null && (attributes.getValue("rel") ?: "alternate") == "alternate" ->
          attributes.getValue("href")?.let { item!!.putIfAbsent("link", it) }
        name == "thumbnail" && item != null -> attributes.getValue("url")?.let { item!!.putIfAbsent("image", it) }
        name == "chapters" && uri == PODCAST && item != null -> attributes.getValue("url")?.let { item!!.putIfAbsent("chapters", it) }
        name == "transcript" && uri == PODCAST && item != null -> {
          val target = item!!
          val type = attributes.getValue("type")?.lowercase()?.substringBefore(';')?.trim()
          val url = attributes.getValue("url")
          val rank = TRANSCRIPTS.indexOf(type)
          val held = TRANSCRIPTS.indexOf(target["transcriptType"])
          if (url != null && rank >= 0 && (held < 0 || rank < held)) {
            target["transcript"] = url
            target["transcriptType"] = type!!
          }
        }
        name == "enclosure" && item != null -> {
          val target = item!!
          if (!target.containsKey("url")) {
            attributes.getValue("url")?.let { target["url"] = it }
            attributes.getValue("type")?.let { target["type"] = it }
            attributes.getValue("length")?.let { target["length"] = it }
          }
        }
      }
    }

    override fun characters(ch: CharArray, start: Int, length: Int) {
      if (text.length < 20_000) text.append(ch, start, length)
    }

    override fun endElement(uri: String, local: String, qName: String) {
      depth -= 1
      val name = local.ifEmpty { qName.substringAfter(':') }
      val value = text.toString()
      val target = item
      if (target != null) {
        when {
          name == "item" || name == "entry" -> {
            episodeOf(target)?.let(episodes::add)
            item = null
          }
          name == "title" && uri != ITUNES -> target.putIfAbsent("title", value)
          name == "guid" || name == "id" -> target.putIfAbsent("guid", value)
          name == "videoId" -> target["videoId"] = value
          name == "pubDate" || name == "published" -> target.putIfAbsent("date", value)
          name == "duration" && uri == ITUNES -> target["duration"] = value
          name == "episode" && uri == ITUNES -> target["episode"] = value
          name == "season" && uri == ITUNES -> target["season"] = value
          name == "summary" && uri == ITUNES -> target.putIfAbsent("summary", value)
          name == "description" -> target.putIfAbsent("summary", value)
        }
      } else {
        when {
          name == "image" && uri != ITUNES -> inImage = false
          name == "author" && uri != ITUNES -> inAuthor = false
          name == "name" && inAuthor -> show.putIfAbsent("author", value)
          name == "url" && inImage -> show.putIfAbsent("image", value)
          inImage -> Unit
          name == "title" && uri != ITUNES -> show.putIfAbsent("title", value)
          name == "author" && uri == ITUNES -> show.putIfAbsent("author", value)
          name == "summary" && uri == ITUNES -> show.putIfAbsent("summary", value)
          name == "description" -> show.putIfAbsent("summary", value)
          name == "link" && uri != ITUNES -> show.putIfAbsent("link", value)
        }
      }
      text.setLength(0)
    }
  }

  private fun episodeOf(fields: Map<String, String>): Episode? {
    // A video of a channel's is fetched by YouTube's address, and known by its own id; a short is not an episode of anything.
    val video = fields["videoId"]?.trim()?.takeIf { Regex("[A-Za-z0-9_-]{11}").matches(it) }
    if (video != null && fields["link"]?.contains("/shorts/") == true) return null
    val url = video?.let { "https://www.youtube.com/watch?v=$it" } ?: fields["url"]?.trim()?.takeIf { it.startsWith("http") } ?: return null
    // An episode a feed sends without saying which it is, is known by its file.
    val guid = video ?: fields["guid"]?.trim()?.ifEmpty { null } ?: url
    return Episode(
      guid = guid,
      title = fields["title"]?.trim()?.ifEmpty { null } ?: url.substringAfterLast('/').substringBefore('?'),
      url = url,
      type = fields["type"],
      bytes = fields["length"]?.trim()?.toLongOrNull()?.takeIf { it > 0 },
      publishedAt = fields["date"]?.let(::dateOf),
      durationSec = fields["duration"]?.let(::durationOf),
      episode = fields["episode"]?.trim()?.toIntOrNull(),
      season = fields["season"]?.trim()?.toIntOrNull(),
      image = fields["image"],
      summary = fields["summary"]?.let(::plain)?.take(SUMMARY_CHARS)?.ifEmpty { null },
      chaptersUrl = fields["chapters"]?.trim()?.takeIf { it.startsWith("http") },
      transcriptUrl = fields["transcript"]?.trim()?.takeIf { it.startsWith("http") },
      transcriptType = fields["transcriptType"],
    )
  }

  /** `1:02:03`, `62:03`, `3723` or `3723.5`, as seconds. */
  fun durationOf(value: String): Double? {
    val parts = value.trim().split(':')
    if (parts.isEmpty() || parts.size > 3) return null
    var seconds = 0.0
    for (part in parts) seconds = seconds * 60 + (part.trim().toDoubleOrNull() ?: return null)
    return seconds.takeIf { it > 0 }
  }

  private val DATES = listOf(
    "d MMM yyyy HH:mm:ss Z", "d MMM yyyy HH:mm Z", "d MMM yyyy HH:mm:ss zzz", "d MMM yy HH:mm:ss Z",
    "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd",
  )

  /**
   * A feed's date, in any of the ways feeds are known to write one, as
   * milliseconds. The day of the week is left out before it is read: many a
   * feed names the wrong one, and a date read strictly would not be read at
   * all for it. A fraction of a second is read to the millisecond.
   */
  fun dateOf(value: String): Long? {
    val text = value.trim().replace(Regex("\\s+"), " ")
      .replace(Regex("^[A-Za-z]{3,9}\\.?,? "), "")
      .replace(Regex("(T\\d{2}:\\d{2}:\\d{2})\\.(\\d{1,3})\\d*")) { "${it.groupValues[1]}.${it.groupValues[2].padEnd(3, '0')}" }
    for (pattern in DATES) {
      val parsed = runCatching {
        SimpleDateFormat(pattern, Locale.US).apply { isLenient = false; if (pattern.endsWith("'Z'")) timeZone = java.util.TimeZone.getTimeZone("UTC") }.parse(text)
      }.getOrNull()
      if (parsed != null) return parsed.time
    }
    return null
  }

  /** A summary's HTML as plain words. */
  private fun plain(value: String): String = value
    .replace(Regex("(?i)<br\\s*/?>|</p>"), "\n")
    .replace(Regex("<[^>]+>"), "")
    .replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
    .replace(Regex("[ \\t]+"), " ")
    .replace(Regex("\\n\\s*\\n+"), "\n")
    .trim()

  /** An input that stops at [most] bytes, so a mistaken address cannot fill memory. */
  private class Limited(private val inner: InputStream, private val most: Long) : InputStream() {
    private var read = 0L
    override fun read(): Int {
      if (read >= most) error("Feed too large")
      val byte = inner.read()
      if (byte >= 0) read += 1
      return byte
    }
    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
      if (read >= most) error("Feed too large")
      val count = inner.read(buffer, offset, minOf(length.toLong(), most - read).toInt())
      if (count > 0) read += count
      return count
    }
  }
}
