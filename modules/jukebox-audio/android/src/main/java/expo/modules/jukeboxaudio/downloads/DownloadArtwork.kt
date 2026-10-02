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
}
