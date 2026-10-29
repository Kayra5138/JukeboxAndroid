package expo.modules.jukeboxaudio.downloads

import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/**
 * A file fetched as it is from its own address — a podcast's episode, a
 * book's part from the Internet Archive — before the extractor names and
 * tags it. Done here rather than by the extractor because these are where
 * the way to them gives out part way: a host that sends each fetch to one
 * of its servers, some of which cannot be reached from where the phone is,
 * or a connection that drops a few minutes into an hour of somebody
 * talking. So it is tried again, a few times and a little later each time,
 * from where it got to; and from the address it was given, so that a host
 * which sends it elsewhere may send it somewhere that answers.
 */
internal object DirectFetch {
  private const val TRIES = 8
  private const val MOST_REDIRECTS = 8
  /** Past this it is not an episode or a book's part: four gigabytes, more than any day of talking. */
  private const val MOST_BYTES = 4L * 1024 * 1024 * 1024

  /**
   * [address] into [target], as far as it goes. [progress] is told the share
   * of it here, out of a hundred — nought where its length is not known — now
   * and then as it comes and before each try: which is where a fetch that is
   * to wait for Wi‑Fi is stopped (`DownloadService`), and so it must be told
   * whether the length is known or not, and before going again on whatever
   * connection there is now.
   */
  fun fetch(address: String, target: File, cancelled: AtomicBoolean, progress: (Int) -> Unit): File {
    target.parentFile?.mkdirs()
    target.delete()
    var lastError: Exception? = null
    var said = 0
    for (attempt in 0 until TRIES) {
      progress(said)
      check(!cancelled.get()) { "Cancelled" }
      try {
        if (once(address, target, cancelled) { share -> said = share; progress(share) }) return target
      } catch (error: Exception) {
        if (cancelled.get()) throw error
        lastError = error
      }
      // A little longer each time: two seconds, four, eight, up to half a minute.
      val wait = minOf(30_000L, 2_000L shl attempt)
      val until = System.currentTimeMillis() + wait
      while (System.currentTimeMillis() < until) {
        check(!cancelled.get()) { "Cancelled" }
        Thread.sleep(250)
      }
    }
    throw lastError ?: IllegalStateException("The file could not be fetched")
  }

  /** One try, from where the file has got to. True when it is all here. */
  private fun once(address: String, target: File, cancelled: AtomicBoolean, progress: (Int) -> Unit): Boolean {
    val have = if (target.exists()) target.length() else 0L
    // Over https, an http episode's address and every address it is sent on to: see [expo.modules.jukeboxaudio.podcasts.Secure].
    var url = expo.modules.jukeboxaudio.podcasts.Secure.of(address)
    repeat(MOST_REDIRECTS) {
      require(url.protocol == "https") { "Not a web address" }
      val connection = url.openConnection() as HttpURLConnection
      try {
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 15_000
        connection.readTimeout = 45_000
        connection.setRequestProperty("User-Agent", "Jukebox (Android)")
        if (have > 0) connection.setRequestProperty("Range", "bytes=$have-")
        val code = connection.responseCode
        if (code in 300..399) {
          url = expo.modules.jukeboxaudio.podcasts.Secure.of(URL(url, connection.getHeaderField("Location") ?: error("Redirect without a place")))
          return@repeat
        }
        // Asked for the rest and given the whole: started again from the top.
        val resumed = code == 206 && have > 0
        check(code == 200 || code == 206) { "The file answered $code" }
        val length = connection.getHeaderField("Content-Length")?.toLongOrNull()
        val whole = if (resumed) length?.let { it + have } else length
        var got = if (resumed) have else 0L
        var said = -1
        var toldAt = 0L
        connection.inputStream.use { input ->
          FileOutputStream(target, resumed).use { output ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
              check(!cancelled.get()) { "Cancelled" }
              val read = input.read(buffer)
              if (read < 0) break
              output.write(buffer, 0, read)
              got += read
              // An address that never ends — a live stream given as an episode — is not fetched for hours on end.
              check(got <= MOST_BYTES) { "Too large to fetch" }
              if (whole != null && whole > 0) {
                val share = (got * 100 / whole).toInt().coerceIn(0, 100)
                if (share != said) {
                  said = share
                  progress(share)
                }
              } else if (got - toldAt >= 2L * 1024 * 1024) {
                // No length to make a share of: told every couple of megabytes all the same.
                toldAt = got
                progress(0)
              }
            }
          }
        }
        // Ended short of what it said it was: the rest on the next try.
        return whole == null || got >= whole
      } finally {
        connection.disconnect()
      }
    }
    error("Too many redirects")
  }
}
