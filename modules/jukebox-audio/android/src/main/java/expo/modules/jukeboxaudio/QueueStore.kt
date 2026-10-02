package expo.modules.jukeboxaudio

import android.content.Context
import android.net.Uri
import android.os.Bundle
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * The queue, written down so it outlives the process holding it.
 *
 * Playback used to exist only for as long as something was running. Once the
 * service went, so did the list it was playing, and the home screen widget had
 * nothing to send a command to — pressing play could only reopen the app,
 * because there was nothing left to press play *on*. Keeping the queue on disk
 * is what lets it be picked up from cold.
 *
 * Saved as JSON in the app's own files rather than in the database: the service
 * can be started without any of the JavaScript that owns that database ever
 * running, so it needs something it can read on its own.
 */
object QueueStore {
  private const val FILE = "queue.json"

  /** Beyond this the file costs more to write than the tail of it is worth. */
  private const val MAX_ITEMS = 2_000

  data class Saved(val items: List<MediaItem>, val index: Int, val positionMs: Long)

  private fun file(context: Context) = File(context.filesDir, FILE)

  /**
   * Reads the player, which has to happen on the thread that owns it.
   *
   * Separate from the writing so the expensive half — building the document and
   * putting it on disk — can be done somewhere else. A player cannot be touched
   * off the main thread, and a file should not be written on it.
   */
  fun snapshot(player: Player): String = runCatching {
    val count = minOf(player.mediaItemCount, MAX_ITEMS)
    val items = JSONArray()
    for (index in 0 until count) items.put(toJson(player.getMediaItemAt(index)))

    JSONObject()
      .put("items", items)
      .put("index", player.currentMediaItemIndex.coerceIn(0, maxOf(count - 1, 0)))
      .put("positionMs", player.currentPosition.coerceAtLeast(0))
      .toString()
  }.getOrDefault("")

  /**
   * Puts it on disk, through a temporary file.
   *
   * This is written while playing and read after a kill, so a write interrupted
   * in place would leave half a queue behind — which parses as a short one
   * rather than as nothing.
   */
  fun save(context: Context, body: String) {
    if (body.isEmpty()) return
    runCatching {
      val target = file(context)
      val temporary = File(target.parentFile, "$FILE.part")
      temporary.writeText(body)
      if (!temporary.renameTo(target)) temporary.delete()
    }
  }

  fun load(context: Context): Saved? = runCatching {
    val target = file(context)
    if (!target.isFile) return null

    val body = JSONObject(target.readText())
    val array = body.optJSONArray("items") ?: return null
    val items = (0 until array.length()).mapNotNull { fromJson(array.optJSONObject(it)) }
    if (items.isEmpty()) return null

    Saved(
      items = items,
      index = body.optInt("index", 0).coerceIn(0, items.size - 1),
      positionMs = body.optLong("positionMs", 0L).coerceAtLeast(0L)
    )
  }.getOrNull()

  private fun toJson(item: MediaItem): JSONObject {
    val metadata = item.mediaMetadata
    val extras = metadata.extras
    return JSONObject()
      .put("id", item.mediaId)
      // The playable address lives in the extras as well as on the item: a
      // media item's local configuration is stripped when it crosses to a
      // controller, so the extras are the copy that always survives.
      .put("uri", extras?.getString("jukebox.uri") ?: item.localConfiguration?.uri?.toString())
      .put("title", metadata.title?.toString())
      .put("artist", metadata.artist?.toString())
      .put("album", metadata.albumTitle?.toString())
      .put("artworkUri", metadata.artworkUri?.toString())
      .put("filename", extras?.getString("jukebox.filename"))
      .put("folder", extras?.getString("jukebox.folder"))
      .put("durationSec", extras?.getDouble("jukebox.durationSec") ?: -1.0)
      .put("trackNumber", extras?.getInt("jukebox.trackNumber") ?: -1)
  }

  private fun fromJson(json: JSONObject?): MediaItem? {
    val uri = json?.optString("uri")?.takeIf { it.isNotBlank() && it != "null" } ?: return null

    val extras = Bundle().apply {
      putString("jukebox.uri", uri)
      putString("jukebox.filename", json.optString("filename").takeIf { it != "null" })
      putString("jukebox.folder", json.optString("folder").takeIf { it != "null" })
      putDouble("jukebox.durationSec", json.optDouble("durationSec", -1.0))
      putInt("jukebox.trackNumber", json.optInt("trackNumber", -1))
    }

    val metadata = MediaMetadata.Builder()
      .setTitle(json.optString("title").takeIf { it.isNotBlank() && it != "null" })
      .setArtist(json.optString("artist").takeIf { it.isNotBlank() && it != "null" })
      .setAlbumTitle(json.optString("album").takeIf { it.isNotBlank() && it != "null" })
      .apply {
        json.optString("artworkUri")
          .takeIf { it.isNotBlank() && it != "null" }
          ?.let { setArtworkUri(Uri.parse(it)) }
      }
      .setExtras(extras)
      .build()

    return MediaItem.Builder()
      .setMediaId(json.optString("id"))
      .setUri(uri)
      .setMediaMetadata(metadata)
      .build()
  }
}
