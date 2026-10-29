package expo.modules.jukeboxaudio.podcasts

import java.net.HttpURLConnection
import java.net.URL

/**
 * Addresses a podcast gives, asked for over https whatever they say.
 *
 * The app does not send anything in the clear, and a podcast's addresses are
 * often plain http: a feed listed years ago, an episode's address handed on
 * through a counter that says http. Nearly every host answers the same
 * address over https, so that is what is asked for, the first address and
 * every one it is sent on to alike. A host that does not answer over https
 * fails as any other host that cannot be reached does.
 */
internal object Secure {
  /** [url] as https: the same host, path and question, a port given for plain http left out. */
  fun of(url: URL): URL =
    if (url.protocol != "http") url
    else URL("https", url.host, if (url.port == 80) -1 else url.port, url.file)

  fun of(address: String): URL = of(URL(address.trim()))

  /**
   * [address] opened over https, its redirects followed by hand — the phone
   * follows none from https to http by itself — each one over https as well.
   * [prepare] is told of each connection before it is asked anything.
   * Answers with the connection that did not send it on; the caller
   * disconnects it.
   */
  fun open(address: String, prepare: (HttpURLConnection) -> Unit = {}): HttpURLConnection {
    var url = of(address)
    repeat(8) {
      require(url.protocol == "https") { "Not a web address" }
      val connection = url.openConnection() as HttpURLConnection
      val code = try {
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        prepare(connection)
        connection.responseCode
      } catch (error: Exception) {
        connection.disconnect()
        throw error
      }
      if (code !in 300..399) return connection
      val next = connection.getHeaderField("Location")
      connection.disconnect()
      url = of(URL(url, next ?: error("Redirect without a place")))
    }
    error("Too many redirects")
  }
}
