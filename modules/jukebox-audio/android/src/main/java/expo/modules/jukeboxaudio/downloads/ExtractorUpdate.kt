package expo.modules.jukeboxaudio.downloads

import expo.modules.kotlin.exception.CodedException
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The extractor's versions, as words to be compared. Nothing here touches the
 * phone or the network, so that all of it can be held to on a desk.
 *
 * yt-dlp names a release by its date, `2026.08.19`, with a fourth number on
 * the rare day there are two. Compared number by number and not as text, and
 * anything that is not of that shape is no version at all: it is neither
 * newer nor older than anything, and nothing is done on the strength of it.
 */
object ExtractorVersion {
  private val SHAPE = Regex("\\d{4}\\.\\d{1,2}\\.\\d{1,2}(?:\\.\\d{1,8})?")
  private val TAG = Regex("https://github\\.com/yt-dlp/yt-dlp/releases/tag/([^/?#]+)")
  private val SUM = Regex("([0-9a-fA-F]{64})\\s+\\*?(\\S+)")

  fun valid(version: String?): Boolean = version != null && SHAPE.matches(version)

  private fun numbers(version: String?): List<Int>? =
    version?.takeIf { valid(it) }?.split('.')?.map { it.toInt() }

  /** Whether [version] is a later release than [than]. False where either is not a version. */
  fun newer(version: String?, than: String?): Boolean {
    val a = numbers(version) ?: return false
    val b = numbers(than) ?: return false
    for (place in 0 until maxOf(a.size, b.size)) {
      val difference = a.getOrElse(place) { 0 } - b.getOrElse(place) { 0 }
      if (difference != 0) return difference > 0
    }
    return false
  }

  /**
   * Whether a copy that says it is [installed] is left where it is by a build
   * that carries [bundled]: it is that one, or one fetched since that is
   * newer. Anything else — older, or nothing readable — is written over.
   */
  fun keeps(installed: String?, bundled: String): Boolean =
    installed == bundled || newer(installed, bundled)

  /**
   * The release GitHub's "latest" address sends a browser on to, read off
   * where it sends it. Null for anywhere else, or for a tag that is not a
   * version: only the project's own page, naming a release, is believed.
   */
  fun tagOf(location: String?): String? =
    TAG.matchEntire(location.orEmpty().trim())?.groupValues?.get(1)?.takeIf { valid(it) }

  /** The SHA-256 the release's own list gives for the file called [name], in lower case. */
  fun checksum(sums: String, name: String = "yt-dlp"): String? =
    sums.lineSequence().mapNotNull { SUM.matchEntire(it.trim()) }
      .firstOrNull { it.groupValues[2] == name }?.groupValues?.get(1)?.lowercase()
}

/**
 * Why the extractor could not be looked up or changed. The code is what
 * JavaScript recognises, and the sentence is for a log: what is shown is said
 * there, in the app's language.
 */
class ExtractorTrouble(val kind: Kind, cause: Throwable? = null) : CodedException(kind.code, kind.said, cause) {
  enum class Kind(val code: String, val said: String) {
    /** GitHub could not be reached, or did not answer in time. */
    NETWORK("ERR_EXTRACTOR_NETWORK", "GitHub could not be reached."),
    /** It answered, and not with what was asked for. */
    ANSWER("ERR_EXTRACTOR_ANSWER", "GitHub did not answer with a release."),
    /** What arrived is not the file the release says it publishes. */
    CHECKSUM("ERR_EXTRACTOR_CHECKSUM", "The file fetched is not the one the release lists."),
    /** It is the right file and it does not run here. The one before it is back in place. */
    BROKEN("ERR_EXTRACTOR_BROKEN", "The new extractor does not run on this phone."),
    FAILED("ERR_EXTRACTOR_FAILED", "The extractor could not be changed.")
  }
}

/**
 * A newer yt-dlp, looked for and fetched on the phone.
 *
 * WHY IT IS NOT THE LIBRARY'S OWN. youtubedl-android has
 * `updateYoutubeDL(context, channel)`, and as it is in 0.19.0 it will not do
 * here. Read from its classes:
 *
 *  - it asks `api.github.com/repos/yt-dlp/yt-dlp/releases/latest` for the
 *    whole description of the release, which is sixty kilobytes of changelog
 *    to learn one word, from an address that answers sixty times an hour for
 *    everybody behind the same router;
 *  - it decides whether that is news by a note of its own in the shared
 *    preferences, which this app has never written, so the first press would
 *    fetch the very version already here;
 *  - it checks the three megabytes it fetches against nothing;
 *  - it deletes the extractor's whole folder before copying the new file in
 *    — the note beside it that says which version is installed goes with it,
 *    so the next start of the app would write the bundled copy back over the
 *    update — and where the copy fails, it unpacks the old yt-dlp the library
 *    itself carries, which is older than the one this app is built with.
 *
 * So the same three steps are made here, by hand.
 *
 * WHAT LEAVES THE PHONE, AND TO WHOM. See `src/lib/youtube/extractor.ts`,
 * where it is written out for whoever reads the app's own side first. In
 * short: GitHub, and nobody else, is asked which release is the latest (one
 * request with no body either way), and when somebody presses Update, for
 * that release's list of checksums and its `yt-dlp` file. Nothing about the
 * phone, the library or what has been downloaded goes with any of them.
 *
 * WHAT IS TRUSTED. The file is checked against the SHA-256 the same release
 * publishes. That catches a download cut short or mangled on the way; it
 * does not catch a release that was itself tampered with, since the list and
 * the file come from the same place. The copy the build carries is checked
 * against a hash written in `build.gradle`, which somebody chose; an update
 * fetched here is taken on yt-dlp's word and GitHub's, as it would be by
 * anyone running `yt-dlp -U`.
 *
 * WHERE IT IS KEPT. Where the bundled one is: the app's no-backup files,
 * which stay through an update of the app and go with its data. A build that
 * carries something newer writes it over; a build that carries the same or
 * older leaves an update alone ([ExtractorVersion.keeps]).
 */
object ExtractorUpdate {
  private const val LATEST = "https://github.com/yt-dlp/yt-dlp/releases/latest"
  private fun asset(version: String, name: String) = "https://github.com/yt-dlp/yt-dlp/releases/download/$version/$name"
  /** The same words the catalogues are told: which app is asking, and where it lives. */
  private const val AGENT = "Jukebox/0.1 ( https://github.com/Kayra5138/JukeboxAndroid )"
  private const val TIMEOUT_MS = 15_000
  /** A list of twenty lines and a file of three megabytes. Anything much larger is not them. */
  private const val SUMS_LIMIT = 64 * 1024L
  private const val FILE_LIMIT = 32 * 1024 * 1024L

  private fun open(address: String, method: String = "GET", follow: Boolean = true): HttpURLConnection =
    (URL(address).openConnection() as HttpURLConnection).apply {
      requestMethod = method
      instanceFollowRedirects = follow
      connectTimeout = TIMEOUT_MS
      readTimeout = TIMEOUT_MS
      useCaches = false
      setRequestProperty("User-Agent", AGENT)
    }

  /** Network trouble named as that, and everything else left as it was thrown. */
  private fun <T> asking(work: () -> T): T =
    try { work() }
    catch (error: ExtractorTrouble) { throw error }
    catch (error: IOException) { throw ExtractorTrouble(ExtractorTrouble.Kind.NETWORK, error) }

  /**
   * The latest release there is, by name.
   *
   * One HEAD request to the address a browser is sent on from, and the
   * sending-on is not followed: where it points is the answer. Nothing comes
   * back but headers.
   */
  fun latest(): String = asking {
    val connection = open(LATEST, method = "HEAD", follow = false)
    try {
      val status = connection.responseCode
      ExtractorVersion.tagOf(connection.getHeaderField("Location")).takeIf { status in 300..399 }
        ?: throw ExtractorTrouble(ExtractorTrouble.Kind.ANSWER)
    } finally { connection.disconnect() }
  }

  /** What [address] holds, into [target] where there is one, and its SHA-256. */
  private fun fetch(address: String, limit: Long, cancelled: AtomicBoolean, target: File? = null,
    progress: ((Int) -> Unit)? = null): Pair<ByteArray, String> = asking {
    val connection = open(address)
    try {
      if (connection.responseCode != 200) throw ExtractorTrouble(ExtractorTrouble.Kind.ANSWER)
      val expected = connection.contentLengthLong
      if (expected > limit) throw ExtractorTrouble(ExtractorTrouble.Kind.ANSWER)
      val digest = MessageDigest.getInstance("SHA-256")
      val kept = java.io.ByteArrayOutputStream()
      val out = target?.outputStream() ?: kept
      var total = 0L
      var last = -1
      out.use {
        connection.inputStream.use { input ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            check(!cancelled.get()) { "Cancelled" }
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            if (total > limit) throw ExtractorTrouble(ExtractorTrouble.Kind.ANSWER)
            digest.update(buffer, 0, read)
            out.write(buffer, 0, read)
            if (expected > 0 && progress != null) {
              val percent = (total * 100 / expected).toInt().coerceIn(0, 100)
              if (percent != last) { last = percent; progress(percent) }
            }
          }
        }
      }
      // Short of what was promised is a connection that dropped, whatever the stream said.
      if (expected > 0 && total != expected) throw IOException("Cut short")
      kept.toByteArray() to digest.digest().joinToString("") { "%02x".format(it) }
    } finally { connection.disconnect() }
  }

  /**
   * Fetches release [version] and puts it in the extractor's place, with the
   * door to itself: see [YouTubeGate]. Answers with the version the new file
   * says it is.
   *
   * [said] is told how far along it is: `waiting` for whatever is being
   * fetched to finish, `downloading` with a percentage, `checking` while the
   * new file is run once.
   *
   * It is run once before it is believed. A yt-dlp that asks for a newer
   * Python than the one in this build is the right file, whole, and of no
   * use; so the old one is only moved aside, the new one asked its version,
   * and the old one moved back if it does not answer. However this ends, an
   * extractor that runs is in place.
   */
  fun update(context: android.content.Context, version: String, cancelled: AtomicBoolean, said: (String, Int) -> Unit): String {
    if (!ExtractorVersion.valid(version)) throw ExtractorTrouble(ExtractorTrouble.Kind.ANSWER)
    said("waiting", 0)
    return try {
      YouTubeEngine.alone(context, cancelled) { place ->
        said("downloading", 0)
        val fresh = File(place.directory, "jukebox-download")
        try {
          val sums = fetch(asset(version, "SHA2-256SUMS"), SUMS_LIMIT, cancelled).first.decodeToString()
          val expected = ExtractorVersion.checksum(sums) ?: throw ExtractorTrouble(ExtractorTrouble.Kind.ANSWER)
          val (_, hash) = fetch(asset(version, "yt-dlp"), FILE_LIMIT, cancelled, fresh) { said("downloading", it) }
          if (hash != expected) throw ExtractorTrouble(ExtractorTrouble.Kind.CHECKSUM)
          said("checking", 100)
          place.replace(fresh)
        } finally { fresh.delete() }
      }
    } catch (error: ExtractorTrouble) { throw error }
    catch (error: Exception) { throw ExtractorTrouble(ExtractorTrouble.Kind.FAILED, error) }
  }

  /** Puts the copy this build carries back, for an update that turned out worse than what it replaced. */
  fun restore(context: android.content.Context, cancelled: AtomicBoolean): String =
    try { YouTubeEngine.alone(context, cancelled) { it.bundled() } }
    catch (error: Exception) { throw ExtractorTrouble(ExtractorTrouble.Kind.FAILED, error) }
}
