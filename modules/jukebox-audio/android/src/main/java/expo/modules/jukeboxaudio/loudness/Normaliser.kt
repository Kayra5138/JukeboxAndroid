package expo.modules.jukeboxaudio.loudness

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Keeps the table of gains in step with the queue, from inside the service.
 *
 * Everything about evening tracks out that is a decision lives here or is
 * called from here: which tracks need a gain right now, whether the one
 * playing is part of a record, and when a file nobody has met gets measured.
 * None of it needs the app. A queue started from the widget, the notification
 * or a car is levelled exactly as one started from the library screen,
 * because this watches the player and reads the service's own files.
 *
 * It lives on the main thread, the player's. Finding a file's gain is slow --
 * a query, a file opened, perhaps the whole of it decoded -- and happens on
 * one background thread, which reports back here.
 *
 * What it publishes is small: the track playing and the one either side of
 * it. Those are the only ones a processor can be asked about -- the next is
 * there so the gain is waiting when a track runs into it, the previous so
 * the tail of a crossfade keeps the level it was playing at.
 */
@OptIn(UnstableApi::class)
class Normaliser(private val context: Context, private val player: Player) : Player.Listener {
  /**
   * How far either side of the playing track the queue is looked at.
   *
   * It bounds two things: how long a record can be and still be treated as
   * one, and how many files ahead may be measured on the strength of it. A
   * run longer than this is levelled from the part of it within reach.
   */
  private val REACH = 60

  private val handler = Handler(Looper.getMainLooper())

  /*
    One thread, so one measurement at a time, and at the priority Android
    gives to work nobody is waiting on: decoding a song flat out would
    otherwise take a core at the same standing as the one playing the music.
  */
  private val worker = Executors.newSingleThreadExecutor { work ->
    Thread({
      Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
      work.run()
    }, "JukeboxLoudness")
  }

  /** A file to find the gain of: the queue entry's id and where its bytes are. */
  private class Wanted(val id: String, val uri: String)

  /**
   * What the worker should be finding out, most urgent first.
   *
   * Replaced whole whenever the queue moves, and that replacement is the
   * cancellation: a measurement under way looks here between buffers and
   * stops if its file is no longer on the list.
   */
  @Volatile private var wanted: List<Wanted> = emptyList()
  private val working = AtomicBoolean(false)

  /** Ids the worker has an answer for, so it is not asked the same thing twice. */
  private val settled = ConcurrentHashMap.newKeySet<String>()

  /**
   * What is known, by queue entry. Main thread only.
   *
   * An entry with nothing in it is an answer too: a stream, or a file that
   * would not decode. It plays at its own level and is not tried again for
   * as long as this service lives.
   */
  private val known = HashMap<String, FileGain?>()

  /** The track whose measurement arrived while it was playing; see [Loudness.Applied.late]. */
  private var lateFor: String? = null

  /** The track that was playing before this one, and what it was playing at. */
  private var left: Pair<String, Loudness.Applied>? = null
  private var current: Pair<String, Loudness.Applied>? = null

  private var said = ""

  /** Set on the way out, for an answer from the worker that arrives after it. */
  private var released = false

  /**
   * Works out the gains again and says what is still needed.
   *
   * Called on anything that can change the answer: a new track, a changed
   * queue, shuffle or repeat switched, the setting itself, and a gain coming
   * back from the worker.
   */
  fun refresh() {
    if (released) return
    val timeline = player.currentTimeline
    if (!Loudness.read(context).enabled || timeline.isEmpty) {
      // Nothing is measured while this is off. The battery is only spent on
      // behalf of somebody who asked for what it buys.
      wanted = emptyList()
      Loudness.publish(null)
      return
    }

    val at = player.currentMediaItemIndex
    val (order, centre) = hearingOrder(timeline, at)
    val items = order.map { player.getMediaItemAt(it) }
    val queue = items.map(::queued)
    val lookup = { id: String -> known[id] }

    val byId = HashMap<String, Loudness.Applied>()
    for (place in listOf(centre, centre + 1, centre - 1)) {
      val entry = queue.getOrNull(place) ?: continue
      if (entry.id.isEmpty() || entry.id in byId) continue
      byId[entry.id] = Loudness.Applied(
        gain = factor(decidedDb(queue, place, lookup)),
        late = entry.id == lateFor
      )
    }

    /*
      Whatever was playing a moment ago keeps the gain it had. Usually that is
      the previous entry and is in the table already; after a jump across the
      queue with a crossfade on, it is not, and the tail still sounding in the
      second player would otherwise drop to unity for its last two seconds.
    */
    val id = queue[centre].id
    if (current?.first != id) {
      left = current
      // A level that came late to one track is not late for the next.
      lateFor = null
    }
    byId[id]?.let { current = id to it }
    left?.let { (was, level) -> if (was !in byId) byId[was] = level }

    Loudness.publish(Loudness.Levels(current = id.takeIf { it.isNotEmpty() }, byId = byId))
    say(queue, centre, lookup)

    // The playing track, then the one it will run into, then the rest of the
    // record either of them is part of -- an album's gain needs all of it --
    // and last the one before, for somebody about to press previous.
    val run = albumRun(queue, centre)
    val places = listOf(centre, centre + 1) + run.toList() + listOf(centre - 1)
    val next = ArrayList<Wanted>()
    for (place in places) {
      val item = items.getOrNull(place) ?: continue
      val entry = item.mediaId
      if (entry.isEmpty() || entry in known || next.any { it.id == entry }) continue
      next += Wanted(entry, address(item) ?: continue)
    }
    want(next)
  }

  /**
   * The queue around [at] in the order it will be heard, and where [at] is in it.
   *
   * Asked of the timeline, which knows about shuffle, rather than read off
   * the queue by counting. Repeat-all wraps, as playback does; repeat-one
   * does not come into it, since what a track's neighbours are for is
   * deciding whether it is part of a record.
   */
  private fun hearingOrder(timeline: Timeline, at: Int): Pair<List<Int>, Int> {
    val shuffled = player.shuffleModeEnabled
    val repeat = if (player.repeatMode == Player.REPEAT_MODE_ALL) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
    val seen = HashSet<Int>().apply { add(at) }

    val before = ArrayList<Int>()
    var index = at
    while (before.size < REACH) {
      index = timeline.getPreviousWindowIndex(index, repeat, shuffled)
      if (index == C.INDEX_UNSET || !seen.add(index)) break
      before += index
    }
    val after = ArrayList<Int>()
    index = at
    while (after.size < REACH) {
      index = timeline.getNextWindowIndex(index, repeat, shuffled)
      if (index == C.INDEX_UNSET || !seen.add(index)) break
      after += index
    }
    return (before.reversed() + at + after) to before.size
  }

  private fun queued(item: MediaItem): Queued {
    val extras = item.mediaMetadata.extras
    return Queued(
      id = item.mediaId,
      album = item.mediaMetadata.albumTitle?.toString(),
      folder = extras?.getString("jukebox.folder"),
      trackNumber = extras?.getInt("jukebox.trackNumber", -1) ?: -1,
      durationSec = extras?.getDouble("jukebox.durationSec", -1.0) ?: -1.0
    )
  }

  /** Where the entry's bytes are; in the extras first, as everywhere else. */
  private fun address(item: MediaItem): String? =
    item.mediaMetadata.extras?.getString("jukebox.uri") ?: item.localConfiguration?.uri?.toString()

  /** One line in the log each time what is being done to the playing track changes. */
  private fun say(queue: List<Queued>, centre: Int, lookup: (String) -> FileGain?) {
    val entry = queue[centre]
    val own = lookup(entry.id)
    val run = albumRun(queue, centre)
    val line = "playing ${entry.id}: " + when {
      entry.id !in known -> "not known yet, left alone"
      own == null -> "cannot be measured, left alone"
      else -> "${"%+.1f".format(decidedDb(queue, centre, lookup))} dB" +
        (if (own.measured) ", measured" else ", from its tags") +
        (if (run.first != run.last) ", one of ${run.last - run.first + 1} played as a record" else "")
    }
    if (line == said) return
    said = line
    Log.i(Measure.TAG, line)
  }

  // ---- finding out ----

  private fun want(list: List<Wanted>) {
    wanted = list
    if (list.isNotEmpty() && working.compareAndSet(false, true)) {
      runCatching { worker.execute(::drain) }.onFailure { working.set(false) }
    }
  }

  /** On the worker: answers whatever is wanted, one file at a time, until nothing is. */
  private fun drain() {
    try {
      while (true) {
        val next = wanted.firstOrNull { it.id !in settled } ?: break
        val stillWanted = { wanted.any { it.id == next.id } }

        val found = find(next, cancelled = { !stillWanted() })
        // Dropped from the list while it was being worked on. Not settled,
        // so that it is done properly if it is ever wanted again.
        if (found == null && !stillWanted()) continue

        settled += next.id
        handler.post { arrived(next.id, found?.first, late = found?.second == true) }
      }
    } finally {
      working.set(false)
      // Something asked for in the moment between the last look and here.
      if (wanted.any { it.id !in settled } && working.compareAndSet(false, true)) {
        runCatching { worker.execute(::drain) }.onFailure { working.set(false) }
      }
    }
  }

  /**
   * One file's gain, and whether it had to be measured just now.
   *
   * In the order of what it costs: what was written down last time, then the
   * file's own tags, then listening to it. Whatever is found is written down,
   * tags included, so that the next meeting is a lookup.
   */
  private fun find(file: Wanted, cancelled: () -> Boolean): Pair<FileGain, Boolean>? {
    val uri = Uri.parse(file.uri)
    val fingerprint = Measure.fingerprint(context, uri) ?: return null
    LoudnessStore.get(context, fingerprint)?.let { return it to false }

    if (cancelled()) return null
    Measure.tags(context, uri)?.let {
      Log.i(Measure.TAG, "tags of ${file.uri}: track ${it.trackDb} dB, album ${it.albumDb} dB")
      LoudnessStore.put(context, fingerprint, it)
      return it to false
    }

    if (cancelled()) return null
    val measured = Measure.file(context, uri, cancelled) ?: return null
    LoudnessStore.put(context, fingerprint, measured)
    return measured to true
  }

  private fun arrived(id: String, gain: FileGain?, late: Boolean) {
    known[id] = gain
    /*
      Measured while it was playing: the answer is some seconds into the song.
      It is applied all the same, slowly -- the alternative is a first play at
      the wrong level from start to finish, and with a whole library unmeasured
      on the day this is switched on, that would be every first song of every
      sitting. The track after it has been measured by the time it starts.
    */
    if (late && gain != null && id == player.currentMediaItem?.mediaId) lateFor = id
    refresh()
  }

  // ---- keeping up ----

  /** The switch was thrown. Whatever follows is the user's doing and is not eased in. */
  fun settingsChanged() {
    lateFor = null
    refresh()
  }

  override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = refresh()

  override fun onTimelineChanged(timeline: Timeline, reason: Int) = refresh()

  override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) = refresh()

  override fun onRepeatModeChanged(repeatMode: Int) = refresh()

  fun release() {
    released = true
    handler.removeCallbacksAndMessages(null)
    // Emptying the list is what stops a measurement half way.
    wanted = emptyList()
    worker.shutdown()
    Loudness.publish(null)
  }
}
