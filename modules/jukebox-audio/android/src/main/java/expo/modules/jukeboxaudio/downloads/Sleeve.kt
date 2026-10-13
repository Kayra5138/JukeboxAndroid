package expo.modules.jukeboxaudio.downloads

import java.net.URL

/**
 * Where a Discover song's sleeve may be fetched from, and nowhere else.
 *
 * The address a song carries is the Cover Art Archive's, and the archive
 * does not hold the picture: it answers with where the picture is, at the
 * Internet Archive, which answers in turn with the machine it is on —
 * `coverartarchive.org`, then `archive.org/download/…`, then a host such as
 * `ia800100.us.archive.org`. So a fetch is a walk of two or three hops, and
 * each is held to this.
 *
 * A hop that names one of those hosts over plain `http` is followed over
 * `https` instead. The Internet Archive's machines answer both, some of its
 * redirects still say `http`, and this app makes no request in the clear;
 * turning such a hop away, as was done, lost the sleeve of every song whose
 * picture happened to sit on one of those machines. Any other host, any
 * other scheme, a port or a name and password in the address, is refused.
 *
 * A song Discover learnt of from Deezer carries a picture of Deezer's, which
 * is on one of its picture machines and is answered there without a hop:
 * `cdn-images.dzcdn.net`, or the older `e-cdns-images.dzcdn.net`.
 */
object Sleeve {
  private fun allowed(host: String): Boolean =
    host == "coverartarchive.org" || host == "archive.org" || host.endsWith(".archive.org") ||
      host == "cdn-images.dzcdn.net" || host == "e-cdns-images.dzcdn.net"

  /** [url] as it may be asked, or null where it may not be. */
  fun hop(url: URL): URL? {
    val host = url.host.lowercase()
    if (!allowed(host) || url.userInfo != null) return null
    return when (url.protocol.lowercase()) {
      "https" -> if (url.port == -1 || url.port == 443) url else null
      "http" -> if (url.port == -1 || url.port == 80) URL("https", host, url.file) else null
      else -> null
    }
  }

  /** Where the answer to [from] sends whoever asked, given its `Location`, or null. */
  fun next(from: URL, location: String?): URL? =
    if (location.isNullOrBlank()) null else runCatching { hop(URL(from, location)) }.getOrNull()
}
