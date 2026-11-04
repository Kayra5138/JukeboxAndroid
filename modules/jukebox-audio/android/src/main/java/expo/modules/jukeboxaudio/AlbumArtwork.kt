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
  /**
   * Keeps the picture found inside a song's file, as one of the app's own
   * covers, and answers where the kept copy is.
   *
   * What [MediaStoreLibrary.embeddedArtwork] hands back is a copy in the
   * cache, which the system may clear and which is retired whenever the file
   * changes; a cover given to the other tracks of the record has to outlive
   * both. So it is copied into the artwork folder the way a picked picture
   * is, named after its bytes: the twelve tracks of one record carrying the
   * same picture come to one file however many of them are kept.
   *
   * Only a copy out of that cache is taken. Anything else is refused, so that
   * this cannot be used to read whatever else the app can reach.
   */
  fun keep(context: Context, source: String): String {
    val file = File(Uri.parse(source).path ?: throw Told(R.string.jukebox_picture_not_opened))
    val cache = File(context.cacheDir, "artwork")
    if (!file.canonicalPath.startsWith(cache.canonicalPath + File.separator) || !file.isFile) {
      throw Told(R.string.jukebox_picture_not_opened)
    }
    return ImagePicker.adopt(context, Uri.fromFile(file).toString())
  }

  /** Where the picture at [source] is kept once [download] has fetched it. */
  private fun fileFor(context: Context, source: String): File {
    val directory = File(context.filesDir, "album-artwork").apply { mkdirs() }
    val digest = MessageDigest.getInstance("SHA-256").digest(source.toByteArray())
      .joinToString("") { "%02x".format(it) }
    return File(directory, "$digest.jpg")
  }

  /** The picture at [source], where [download] has already fetched it; null where it has not. Asks nothing but the disk. */
  fun kept(context: Context, source: String): String? =
    runCatching { fileFor(context, source).takeIf { it.isFile && it.length() > 0 }?.let { Uri.fromFile(it).toString() } }.getOrNull()

  /**
   * [anyHost] for a podcast's own picture, which is wherever its publisher
   * keeps it, put in the feed to be shown by whatever plays the podcast. Every
   * other picture comes from one of the places named below.
   */
  fun download(context: Context, source: String, anyHost: Boolean = false): String {
    val target = fileFor(context, source)
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
      val named = url.host.endsWith(".mzstatic.com") || url.host in setOf("i.ytimg.com", "i9.ytimg.com", "img.youtube.com", "upload.wikimedia.org", "thumb.wikimedia.org")
      if (!(url.protocol == "https" && (named || anyHost) && url.userInfo == null)) {
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
          val temporary = File.createTempFile("cover-", ".tmp", target.parentFile)
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
