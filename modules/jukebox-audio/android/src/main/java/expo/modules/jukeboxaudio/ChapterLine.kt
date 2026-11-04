package expo.modules.jukeboxaudio

import android.content.Context
import android.os.Handler
import android.os.SystemClock
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import expo.modules.jukeboxaudio.downloads.TapeChapters

/**
 * The chapter a tape is in, for the line under its title wherever the
 * session is drawn: the notification, the lock screen, the car, the widget.
 *
 * A tape's artist is its show or its author, which is the same for hours
 * and says nothing a glance at the cover does not; the chapter says where in
 * it the listener is. So while a tape with chapters plays, the session is
 * given the chapter in the artist's place (see `FadingPlayer.getMediaMetadata`)
 * and told each time it moves on to another. A song, and a tape without
 * chapters, keep their artist.
 *
 * Looked at once a second while such a tape plays, and at once after a seek
 * or a change of track: a chapter is minutes long, and a second late is not
 * late.
 */
internal class ChapterLine(
  private val context: Context,
  private val player: ExoPlayer,
  /** Called on the player's thread when [title] has changed, for the session to be told. */
  private val changed: () -> Unit
) : Player.Listener {
  private val handler = Handler(player.applicationLooper)

  /** The chapters of the tape playing: where each begins, in milliseconds, and what it is called. */
  private var chapters: List<Pair<Long, String>> = emptyList()

  /** The tape they are the chapters of, or null where what is playing is not a tape. */
  private var tapeId: String? = null

  /** When the tape came on, for reading its chapters once more if it had none then. */
  private var cameAt = 0L
  private var readAgain = false

  /** The chapter playing now, or null where there is none to say. */
  private var title: String? = null

  /**
   * The chapter to say for [item]: none for any track but the tape the
   * chapters are of, so that a song coming on after a tape is not given the
   * tape's chapter for the moment before it is looked at.
   */
  fun titleFor(item: MediaItem?): String? =
    title?.takeIf { item != null && Tapes.idOf(item) == tapeId }

  private val tick = object : Runnable {
    override fun run() {
      look(force = false)
      if (ticking()) handler.postDelayed(this, EVERY_MS)
    }
  }

  init {
    handler.post {
      read(player.currentMediaItem)
      look(force = true)
      restart()
    }
  }

  override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
    read(mediaItem)
    look(force = true)
    restart()
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) = restart()

  override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
    if (oldPosition.mediaItemIndex == newPosition.mediaItemIndex) look(force = false)
  }

  /** Playing a tape that has chapters, or may yet be found to. */
  private fun ticking(): Boolean = player.isPlaying && tapeId != null && (chapters.isNotEmpty() || !readAgain)

  private fun restart() {
    handler.removeCallbacks(tick)
    if (ticking()) handler.postDelayed(tick, EVERY_MS)
  }

  private fun read(item: MediaItem?) {
    chapters = emptyList()
    tapeId = null
    readAgain = false
    if (item == null || !Tapes.isTape(context, item)) return
    val id = Tapes.idOf(item)
    tapeId = id
    cameAt = SystemClock.elapsedRealtime()
    chapters = load(id)
  }

  private fun load(id: String): List<Pair<Long, String>> =
    runCatching {
      TapeChapters.get(context, id).mapNotNull { chapter ->
        val start = chapter["startSec"] as? Double ?: return@mapNotNull null
        (start * 1000).toLong() to (chapter["title"] as? String).orEmpty().trim()
      }.sortedBy { it.first }
    }.getOrDefault(emptyList())

  /**
   * Works out the chapter playing and tells the session where it changed —
   * and, as a track comes on ([force]), whenever there is one to say, since
   * the session has just been handed the track's own artist in its place.
   */
  private fun look(force: Boolean) {
    val id = tapeId
    // Chapters are often found by the app as a tape comes on, after it has begun: read once more a little later.
    if (id != null && chapters.isEmpty() && !readAgain && SystemClock.elapsedRealtime() - cameAt > READ_AGAIN_MS) {
      readAgain = true
      chapters = load(id)
    }
    val now = chapters.getOrNull(chapterAt(chapters.map { it.first }, player.currentPosition))?.second?.ifEmpty { null }
    if (now == title && !(force && now != null)) return
    title = now
    changed()
  }

  fun release() {
    handler.removeCallbacksAndMessages(null)
  }

  companion object {
    private const val EVERY_MS = 1_000L
    private const val READ_AGAIN_MS = 15_000L

    /** Which of the chapters beginning at [starts], in order, [positionMs] is in: -1 before the first. */
    fun chapterAt(starts: List<Long>, positionMs: Long): Int {
      var found = -1
      for ((index, start) in starts.withIndex()) {
        if (start > positionMs) break
        found = index
      }
      return found
    }
  }
}
