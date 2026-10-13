package expo.modules.jukeboxaudio.downloads

import android.content.Context
import expo.modules.jukeboxaudio.AlbumArtwork
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.atomic.AtomicBoolean

/** Runs in the download service, including when the React screen is closed. */
object DownloadArtwork {
  private var nextLookup = 0L

  fun resolve(context: Context, info: JSONObject, video: JSONObject, cancelled: AtomicBoolean): String? {
    val identity = ArtworkMatch.identity(info)
    if (identity != null) {
      for (country in listOf("TR", "US")) {
        if (cancelled.get()) return null
        try {
          while (System.nanoTime() < nextLookup) {
            if (cancelled.get()) return null
            Thread.sleep(100)
          }
          nextLookup = System.nanoTime() + 6_000_000_000L
          val query = URLEncoder.encode("${identity.first} ${identity.second}", "UTF-8")
          val connection = URL("https://itunes.apple.com/search?term=$query&entity=song&limit=8&country=$country")
            .openConnection() as HttpURLConnection
          val response = try {
            connection.connectTimeout = 8_000
            connection.readTimeout = 8_000
            check(connection.responseCode == 200)
            connection.inputStream.use { input ->
              val output = java.io.ByteArrayOutputStream()
              val buffer = ByteArray(8192)
              while (true) {
                if (cancelled.get()) return null
                val count = input.read(buffer)
                if (count < 0) break
                check(output.size() + count <= 512 * 1024)
                output.write(buffer, 0, count)
              }
              JSONObject(output.toString("UTF-8"))
            }
          } finally { connection.disconnect() }
          val entries = response.optJSONArray("results") ?: continue
          for (index in 0 until entries.length()) {
            if (cancelled.get()) return null
            val entry = entries.optJSONObject(index) ?: continue
            if (!DownloadMetadata.applyCatalogue(info, entry)) continue
            val url = entry.optString("artworkUrl100").replace(Regex("/\\d+x\\d+bb\\."), "/600x600bb.")
            if (url.isBlank()) continue
            runCatching { AlbumArtwork.download(context, url) }.getOrNull()?.let { return it }
          }
        } catch (_: Exception) { break } // Offline / throttled: use the video image.
      }
    }
    if (cancelled.get()) return null
    val fallback = "https://i.ytimg.com/vi/${video.getString("id")}/hqdefault.jpg"
    val thumbnails = listOfNotNull(video.optString("thumbnail").takeIf { it.startsWith("https://") }, fallback).distinct()
    for (thumbnail in thumbnails) {
      if (cancelled.get()) return null
      runCatching { AlbumArtwork.download(context, thumbnail) }.getOrNull()?.let { return it }
    }
    return null
  }

  private fun sleeveFile(context: Context, cover: String): java.io.File {
    val digest = java.security.MessageDigest.getInstance("SHA-256").digest(cover.toByteArray())
      .joinToString("") { "%02x".format(it) }
    return java.io.File(java.io.File(context.filesDir, "album-artwork"), "$digest.jpg")
  }

  /** The sleeve at [cover] if it has been fetched already. Looks, and asks nobody: this is what a song being stored may wait for. */
  fun kept(context: Context, cover: String?): String? {
    if (cover == null || !cover.startsWith("https://")) return null
    return runCatching { sleeveFile(context, cover).takeIf { it.isFile && it.length() > 0 }?.let { android.net.Uri.fromFile(it).toString() } }.getOrNull()
  }

  private val aheadOf = java.util.concurrent.Executors.newSingleThreadExecutor { work -> Thread(work, "Jukebox:Sleeves").apply { isDaemon = true } }
  private val wanted = java.util.Collections.synchronizedSet(HashSet<String>())

  /**
   * Fetches the sleeve at [cover] now, for a song that has only just been
   * asked for.
   *
   * The picture's address is known from the moment a song is on the list;
   * the song itself is seconds away at best, a search and a download. So the
   * picture is fetched in that time, one at a time and by nobody's leave,
   * and is there as a file when the song is stored. Before, it was started
   * with the download and waited for after it, and the archive it comes from
   * was often the slower of the two.
   */
  fun ahead(context: Context, cover: String?) {
    if (cover == null || !cover.startsWith("https://") || kept(context, cover) != null || !wanted.add(cover)) return
    val app = context.applicationContext
    aheadOf.execute {
      runCatching { archived(app, cover, AtomicBoolean(false)) }
      wanted.remove(cover)
    }
  }

  /**
   * The sleeve a Discover song was shown with, kept as a file.
   *
   * Discover's songs come out of a catalogue that says which release each is
   * on, and the list shows that release's cover. So there is nothing to look
   * up: [cover] is that picture's address, carried on the job, and this is
   * one small download of it. It is what the player and the notification
   * show, and what the song keeps if it is kept.
   *
   * For a song that was stored without one, the picture not having come
   * in time: see [ahead] for when it is first asked for, and
   * [DiscoverFiles.picture] for where it goes when this answers. Nothing
   * waits on this. The video's own picture is the fallback, which for a
   * recording put up by its label is the same sleeve anyway.
   */
  fun carried(context: Context, cover: String?, video: JSONObject, cancelled: AtomicBoolean): String? {
    if (cover != null && cover.startsWith("https://")) {
      runCatching { archived(context, cover, cancelled) }.getOrNull()?.let { return it }
    }
    if (cancelled.get()) return null
    val fallback = "https://i.ytimg.com/vi/${video.getString("id")}/hqdefault.jpg"
    val thumbnails = listOfNotNull(video.optString("thumbnail").takeIf { it.startsWith("https://") }, fallback).distinct()
    for (thumbnail in thumbnails) {
      if (cancelled.get()) return null
      runCatching { AlbumArtwork.download(context, thumbnail) }.getOrNull()?.let { return it }
    }
    return null
  }

  private fun archived(context: Context, source: String, cancelled: AtomicBoolean): String? {
    val directory = java.io.File(context.filesDir, "album-artwork").apply { mkdirs() }
    val digest = java.security.MessageDigest.getInstance("SHA-256").digest(source.toByteArray())
      .joinToString("") { "%02x".format(it) }
    val target = java.io.File(directory, "$digest.jpg")
    if (target.isFile && target.length() > 0) return android.net.Uri.fromFile(target).toString()
    var url = Sleeve.hop(URL(source)) ?: return null
    // The archive answers with where the file is now, and that with where it really is: see [Sleeve].
    repeat(4) {
      if (cancelled.get()) return null
      val connection = (url.openConnection() as HttpURLConnection).apply {
        connectTimeout = 5_000
        readTimeout = 6_000
        instanceFollowRedirects = false
      }
      try {
        val status = connection.responseCode
        if (status in 300..399) {
          url = Sleeve.next(url, connection.getHeaderField("Location")) ?: return null
        } else {
          if (status !in 200..299) return null
          val temporary = java.io.File.createTempFile("cover-", ".tmp", directory)
          try {
            connection.inputStream.use { input -> temporary.outputStream().use { output ->
              val bytes = ByteArray(16 * 1024)
              var total = 0
              while (true) {
                if (cancelled.get()) return null
                val count = input.read(bytes)
                if (count < 0) break
                total += count
                // A list thumbnail. Anything of this size is not one.
                if (total > 2 * 1024 * 1024) return null
                output.write(bytes, 0, count)
              }
            } }
            val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
            android.graphics.BitmapFactory.decodeFile(temporary.absolutePath, bounds)
            if (bounds.outWidth !in 1..4096 || bounds.outHeight !in 1..4096) return null
            return if (temporary.renameTo(target)) android.net.Uri.fromFile(target).toString() else null
          } finally { temporary.delete() }
        }
      } finally { connection.disconnect() }
    }
    return null
  }
}
