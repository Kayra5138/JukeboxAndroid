package expo.modules.jukeboxaudio

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** Permanent application artwork, independent of the image view's evictable cache. */
object AlbumArtwork {
  fun download(context: Context, source: String): String {
    val directory = File(context.filesDir, "album-artwork").apply { mkdirs() }
    val digest = MessageDigest.getInstance("SHA-256").digest(source.toByteArray())
      .joinToString("") { "%02x".format(it) }
    val target = File(directory, "$digest.jpg")
    if (target.isFile && target.length() > 0) return Uri.fromFile(target).toString()
    var url = URL(source)
    repeat(6) {
      // Wikimedia serves the rendered copies of the artist photographs the recap
      // credits from two hosts — the API answers with thumb.wikimedia.org and
      // upload.wikimedia.org serves the originals — and both are needed: allowing
      // only the one the older documentation names refused every photograph and
      // left every artist quietly wearing an album cover instead. It is the only
      // host here that is
      // not a music catalogue. It is named rather than matched by suffix, the
      // same as the rest: a picture this app redistributes has to come from a
      // place whose licence terms are known.
      if (!(url.protocol == "https" && (url.host.endsWith(".mzstatic.com") || url.host in setOf("i.ytimg.com", "i9.ytimg.com", "img.youtube.com", "upload.wikimedia.org", "thumb.wikimedia.org")) && url.userInfo == null)) {
        throw Told(R.string.jukebox_cover_source)
      }
      val connection = (url.openConnection() as HttpURLConnection).apply {
        connectTimeout = 10_000
        readTimeout = 15_000
        instanceFollowRedirects = false
      }
      try {
        if (connection.responseCode in 300..399) {
          val location = connection.getHeaderField("Location") ?: throw Told(R.string.jukebox_cover_redirect)
          url = URL(url, location)
        } else {
          if (connection.responseCode !in 200..299) throw Told(R.string.jukebox_cover_unavailable)
          val temporary = File.createTempFile("cover-", ".tmp", directory)
          try {
            connection.inputStream.use { input -> temporary.outputStream().use { output ->
              val bytes = ByteArray(16 * 1024)
              var total = 0
              while (true) {
                val count = input.read(bytes)
                if (count < 0) break
                total += count
                if (total > 5 * 1024 * 1024) throw Told(R.string.jukebox_cover_too_large)
                output.write(bytes, 0, count)
              }
            } }
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(temporary.absolutePath, bounds)
            if (bounds.outWidth !in 1..8192 || bounds.outHeight !in 1..8192) throw Told(R.string.jukebox_cover_invalid)
            if (!temporary.renameTo(target)) throw Told(R.string.jukebox_cover_not_saved)
            return Uri.fromFile(target).toString()
          } finally { temporary.delete() }
        }
      } finally { connection.disconnect() }
    }
    throw Told(R.string.jukebox_cover_redirects)
  }
}
