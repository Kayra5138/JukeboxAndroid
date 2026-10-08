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

  /**
   * Where in the queue playback had got to, in a file of its own.
   *
   * The queue is thousands of entries and changes rarely; the place in it is
   * two numbers and changes all the time. Kept together, either the place is
   * only as fresh as the last time the list changed -- which is how a press of
   * play after the app was reclaimed came to start on a track finished long
   * before -- or the whole list is written out again every few seconds to
   * record that some more of a song has gone by.
   */
  private const val PLACE_FILE = "queue-place.json"

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
   * Reads where the player is, which like [snapshot] has to happen on the
   * thread that owns it.
   *
   * The id goes with the index so that the two files cannot be read as one
   * when they are not: see [resumeFrom].
   *
   * A player that has run off the end of its queue is recorded at the start of
   * the last track rather than the end of it. Put back at the end it would be
   * finished the instant it was started, and a press of play would be a press
   * of nothing.
   */
  fun place(player: Player): String = runCatching {
    val item = player.currentMediaItem ?: return ""
    val ended = player.playbackState == Player.STATE_ENDED
    JSONObject()
      .put("id", item.mediaId)
      .put("index", player.currentMediaItemIndex)
      .put("positionMs", if (ended) 0L else player.currentPosition.coerceAtLeast(0))
      .toString()
  }.getOrDefault("")

  /**
   * Puts it on disk, through a temporary file.
   *
   * This is written while playing and read after a kill, so a write interrupted
   * in place would leave half a queue behind — which parses as a short one
   * rather than as nothing.
   */
  fun save(context: Context, body: String) = write(context, FILE, body)

  fun savePlace(context: Context, body: String) = write(context, PLACE_FILE, body)

  private fun write(context: Context, name: String, body: String) {
    if (body.isEmpty()) return
    runCatching {
      val target = File(context.filesDir, name)
      val temporary = File(target.parentFile, "$name.part")
      temporary.writeText(body)
      if (!temporary.renameTo(target)) temporary.delete()
    }
  }

  private fun loadPlace(context: Context): Place? = runCatching {
    val target = File(context.filesDir, PLACE_FILE)
    if (!target.isFile) return null
    val body = JSONObject(target.readText())
    Place(body.optString("id"), body.optInt("index", -1), body.optLong("positionMs", 0L))
  }.getOrNull()

  fun load(context: Context): Saved? = runCatching {
    val target = file(context)
    if (!target.isFile) return null

    val body = JSONObject(target.readText())
    val array = body.optJSONArray("items") ?: return null
    val items = (0 until array.length()).mapNotNull { fromJson(array.optJSONObject(it)) }
    if (items.isEmpty()) return null

    val (index, positionMs) = resumeFrom(
      ids = items.map { it.mediaId },
      index = body.optInt("index", 0),
      positionMs = body.optLong("positionMs", 0L),
      place = loadPlace(context)
    )
    Saved(items = items, index = index, positionMs = positionMs)
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
      // Plain already for anything saved lately. A queue a car chose before
      // ids were made plain on the way in was written with the car's own.
      .setMediaId(expo.modules.jukeboxaudio.auto.BrowseTree.trackId(json.optString("id")))
      .setUri(uri)
      .setMediaMetadata(metadata)
      .build()
  }
}

/** A track in the queue and how far into it playback was. */
data class Place(val id: String, val index: Int, val positionMs: Long)

/**
 * Which track to pick up on and where, out of the two things written down.
 *
 * The queue carries the place it was at when it was last written; [place] is
 * the later word, but it is a separate file and nothing writes the two as one.
 * So it is believed only where it still describes this queue -- its index
 * holds the track it names. A list that changed after the place was noted
 * fails that and falls back on what the queue says of itself, which was true
 * of that list at least when it was written.
 *
 * Pure, so the judgement can be stated without a player or a disk.
 */
fun resumeFrom(ids: List<String>, index: Int, positionMs: Long, place: Place?): Pair<Int, Long> {
  if (place != null && ids.getOrNull(place.index) == place.id) {
    return place.index to place.positionMs.coerceAtLeast(0L)
  }
  return index.coerceIn(0, maxOf(ids.size - 1, 0)) to positionMs.coerceAtLeast(0L)
}
