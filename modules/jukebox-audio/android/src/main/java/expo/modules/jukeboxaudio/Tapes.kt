package expo.modules.jukeboxaudio

import android.content.Context
import android.os.Handler
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import org.json.JSONObject

/**
 * Tapes: the long things that are listened to a stretch at a time — a book,
 * an episode of something, a recording of a whole evening — and that play on
 * from where they were left, the way a cassette does.
 *
 * Kept here, in the service, and not in the app: a tape is as often carried
 * on with from the notification, a headset, the car or the widget, with the
 * app nowhere, and the place has to be kept and found again all the same.
 */

/** In a queue item's extras: whether the app took it for a tape. */
internal const val EXTRA_TAPE = "jukebox.tape"
internal const val EXTRA_DURATION_SEC = "jukebox.durationSec"
internal const val EXTRA_FOLDER_PATH = "jukebox.folder"

internal object Tapes {
  /**
   * The names a tapes folder goes by, without case: Tapes, or the word in any
   * language the app speaks. The app's list (`lib/tapes/rule.ts`) is the same.
   */
  private val FOLDERS = setOf("tapes", "kasetler", "kassetten", "casetes", "cassettes", "cassette", "fitas", "カセット", "кассеты", "磁带")

  /** The library folder, read again after a while: asked of every track as it plays, and changed a few times in an install's life. */
  private var root: String? = null
  private var rootAt = 0L

  private fun rootOf(context: Context): String {
    val now = System.currentTimeMillis()
    val known = root
    if (known != null && now - rootAt < ROOT_FRESH_MS) return known
    return expo.modules.jukeboxaudio.auto.LibraryDatabase.libraryRoot(context).also {
      root = it
      rootAt = now
    }
  }

  /**
   * Whether [item] is a tape: in the Tapes folder of the library folder, as
   * the app said when it queued it or as its folder says to whoever queued
   * it — the car, the widget, a queue put back. Nothing else is, however long
   * it runs: a song is never kept as a tape.
   */
  fun isTape(context: Context, item: MediaItem?): Boolean {
    if (item == null) return false
    val extras = item.mediaMetadata.extras
    if (extras?.getBoolean(EXTRA_TAPE, false) == true) return true
    val folder = extras?.getString(EXTRA_FOLDER_PATH) ?: return false
    return isTapeFolder(folder, rootOf(context))
  }

  /** As the app's `isTapeFolder`: the first folder below [root] is a tapes folder. */
  fun isTapeFolder(folder: String, root: String): Boolean {
    val base = root.trim('/').lowercase()
    val path = folder.trimStart('/').lowercase()
    val under = if (base.isEmpty()) path else if (path.startsWith("$base/")) path.substring(base.length + 1) else return false
    return under.substringBefore('/') in FOLDERS
  }

  /** Whether a folder called [name] is a tapes folder itself, and not one of the folders in it. */
  fun isTapesFolderName(name: String): Boolean = name.lowercase() in FOLDERS

  /**
   * The track a queue item is, by the id the app knows it by. The car's rows
   * carry where they were found ahead of it, `…|id`, and a tape's place has
   * to be the same place however it was put on.
   */
  fun idOf(item: MediaItem): String = item.mediaId.substringAfterLast('|')

  /**
   * How far back a tape is put on coming back to it after [awayMs]: the
   * longer away, the more of what was being said has gone from the mind. A
   * few seconds after a short break, the sentence before it; after a day, the
   * thought before that.
   */
  fun rewindMsFor(context: Context, awayMs: Long): Long = if (smartRewind(context)) rewindMsFor(awayMs) else 0L

  fun rewindMsFor(awayMs: Long): Long = when {
    awayMs < 5 * 60_000L -> 3_000L
    awayMs < 60 * 60_000L -> 10_000L
    awayMs < 24 * 60 * 60_000L -> 20_000L
    else -> 30_000L
  }

  /**
   * Whether a tape goes back a little on being played again, as above: on
   * unless turned off in the app's tape settings. Off, it plays on from
   * exactly where it was left.
   */
  fun smartRewind(context: Context): Boolean =
    context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).getBoolean(SMART_REWIND, true)

  fun setSmartRewind(context: Context, on: Boolean) {
    context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).edit().putBoolean(SMART_REWIND, on).apply()
  }

  /**
   * How far a tape is moved by a press of previous or next from outside the
   * app — a headset, the notification, the car — in milliseconds: back and on,
   * as the app's own jump buttons are set. Those presses would otherwise
   * restart a part or leave it, and a book put back to its start by one stray
   * press loses its place.
   */
  fun jumpsMs(context: Context): Pair<Long, Long> {
    val prefs = context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE)
    return prefs.getInt(JUMP_BACK, 15) * 1000L to prefs.getInt(JUMP_FORWARD, 30) * 1000L
  }

  fun setJumps(context: Context, backSec: Int, forwardSec: Int) {
    context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).edit()
      .putInt(JUMP_BACK, backSec.coerceIn(1, 600)).putInt(JUMP_FORWARD, forwardSec.coerceIn(1, 600)).apply()
    jumpsChanged?.invoke()
  }

  /** Told when the jumps change, by the service, whose buttons for a tape show them: see [TapeButtons]. */
  @Volatile var jumpsChanged: (() -> Unit)? = null

  /**
   * The jumps of the books and shows given their own, by their keys, as the
   * app keeps them (`tapes/jumps.ts`): `{key: {back, forward}}` in seconds,
   * either left out where it is the general one. Handed over as the speeds
   * are, so a headset's press on a book is that book's jump.
   */
  fun setJumpsByKey(context: Context, json: String) {
    context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).edit().putString(JUMPS_BY_KEY, json).apply()
  }

  /** [jumpsMs], or what the book or show under [key] was given of its own in their place. */
  fun jumpsMsFor(context: Context, key: String): Pair<Long, Long> =
    jumpsFor(context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).getString(JUMPS_BY_KEY, null), key, jumpsMs(context))

  /**
   * The jumps back and on for [key] in [json], in milliseconds, each falling
   * back to [general]'s where it has none of its own or one that makes no
   * sense: unreadable, nought, or past ten minutes.
   */
  fun jumpsFor(json: String?, key: String, general: Pair<Long, Long>): Pair<Long, Long> {
    val own = json?.let { runCatching { JSONObject(it).optJSONObject(key) }.getOrNull() } ?: return general
    fun of(name: String, otherwise: Long): Long {
      val seconds = own.optInt(name, 0)
      return if (seconds in 1..600) seconds * 1000L else otherwise
    }
    return of("back", general.first) to of("forward", general.second)
  }

  /**
   * A press of previous or next on a tape, from wherever it came: a jump back
   * or on within it, kept inside it at both ends. False where what is playing
   * is not a tape, and the press is the player's to do as it always did.
   */
  fun jump(context: Context, player: Player, forward: Boolean): Boolean {
    val item = player.currentMediaItem
    if (item == null || !isTape(context, item)) return false
    val (back, on) = jumpsMsFor(context, keyOf(item))
    val duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 }
    val to = player.currentPosition + if (forward) on else -back
    player.seekTo(to.coerceAtLeast(0).let { if (duration != null) it.coerceAtMost(duration - 1_000) else it }.coerceAtLeast(0))
    return true
  }

  /** What a tape's speed is kept under: its folder, which is its book or its show — the app's `tapeKeyOf`. */
  fun keyOf(item: MediaItem): String =
    item.mediaMetadata.extras?.getString(EXTRA_FOLDER_PATH)?.trimEnd('/')?.ifEmpty { null } ?: idOf(item)

  /**
   * The speeds of the tapes, by their keys, as the app keeps them (`tapes/speed.ts`),
   * handed over so that a tape played with no app about — from the car, a
   * headset, the widget — is played at its own speed too.
   */
  fun setSpeeds(context: Context, json: String) {
    context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).edit().putString(SPEEDS, json).apply()
  }

  private fun speedOf(context: Context, key: String): Float {
    val json = context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).getString(SPEEDS, null) ?: return 1f
    val speed = runCatching { JSONObject(json).optDouble(key, 1.0) }.getOrDefault(1.0)
    return if (speed in 0.5..3.0) speed.toFloat() else 1f
  }

  /**
   * A tape at its own speed, and the music at its own: the music's put aside
   * as the first tape comes on, and put back as the first song comes on after.
   * Kept on the disk, the music's, so that a tape left playing when the
   * service stopped does not leave every song after it too fast.
   */
  fun applySpeed(context: Context, player: Player, item: MediaItem) {
    val prefs = context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE)
    val now = player.playbackParameters
    if (isTape(context, item)) {
      if (!prefs.contains(MUSIC_SPEED)) prefs.edit().putFloat(MUSIC_SPEED, now.speed).apply()
      val speed = speedOf(context, keyOf(item))
      if (speed != now.speed) player.playbackParameters = androidx.media3.common.PlaybackParameters(speed, now.pitch)
      return
    }
    if (!prefs.contains(MUSIC_SPEED)) return
    val music = prefs.getFloat(MUSIC_SPEED, 1f)
    prefs.edit().remove(MUSIC_SPEED).apply()
    if (music != now.speed) player.playbackParameters = androidx.media3.common.PlaybackParameters(music, now.pitch)
  }

  /**
   * A tape's own ways of being heard, as its settings have them: silences
   * passed over, and the voice made clearer (see [expo.modules.jukeboxaudio.equalizer.Parametric.voice]).
   * Neither ever touches the music.
   */
  fun applyListening(context: Context, player: androidx.media3.exoplayer.ExoPlayer, item: MediaItem?) {
    val tape = item != null && isTape(context, item)
    val skip = tape && flag(context, SKIP_SILENCE, false)
    if (player.skipSilenceEnabled != skip) player.skipSilenceEnabled = skip
    expo.modules.jukeboxaudio.equalizer.Parametric.voice = tape && flag(context, VOICE_CLARITY, false)
  }

  /** One of a tape's switches: see [applyListening], and [SPONSORS] for the parts of a video passed over. */
  fun flag(context: Context, name: String, otherwise: Boolean): Boolean =
    context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).getBoolean(name, otherwise)

  fun setFlag(context: Context, name: String, on: Boolean) {
    context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).edit().putBoolean(name, on).apply()
  }

  /**
   * The parts of a tape from YouTube passed over as it plays — a sponsor's
   * message, the channel's own advertising, a request to subscribe — as
   * SponsorBlock's listeners marked them, kept by the tape: `[[from, to], …]`
   * in milliseconds. Found by the app; passed over here, so that it happens
   * in the car and from a headset as well.
   */
  fun setSkips(context: Context, trackId: String, json: String) {
    val prefs = context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE)
    val all = runCatching { JSONObject(prefs.getString(SKIPS, null) ?: "{}") }.getOrDefault(JSONObject())
    all.remove(trackId)
    all.put(trackId, runCatching { org.json.JSONArray(json) }.getOrDefault(org.json.JSONArray()))
    while (all.length() > 400) all.remove(all.keys().next())
    prefs.edit().putString(SKIPS, all.toString()).apply()
  }

  /** Whether [trackId]'s parts to pass over have been looked for, found or not. */
  fun skipsKnown(context: Context, trackId: String): Boolean =
    runCatching { JSONObject(context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).getString(SKIPS, null) ?: "{}").has(trackId) }
      .getOrDefault(false)

  fun skipsOf(context: Context, trackId: String): List<LongRange> {
    val list = runCatching {
      JSONObject(context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE).getString(SKIPS, null) ?: "{}").optJSONArray(trackId)
    }.getOrNull() ?: return emptyList()
    return (0 until list.length()).mapNotNull { at ->
      val pair = list.optJSONArray(at) ?: return@mapNotNull null
      val from = pair.optLong(0, -1)
      val to = pair.optLong(1, -1)
      if (from < 0 || to <= from) null else from..to
    }
  }

  /**
   * [videoId]'s parts SponsorBlock's listeners marked — a sponsor's message,
   * the channel's own advertising, a request to subscribe — asked of its
   * public list and kept for [trackId]: none marked is kept as none, and not
   * asked again. Throws where it could not be asked, to be asked another time.
   *
   * Asked without saying which video: by the first characters of its id's
   * SHA-256, which SponsorBlock answers with the parts of every video whose
   * id begins the same, some dozens, among which this one is found here.
   */
  fun lookUpSkips(context: Context, trackId: String, videoId: String): List<LongRange> {
    val read = sponsorParts(videoId)
    val kept = org.json.JSONArray()
    for (at in 0 until read.length()) {
      val part = read.optJSONObject(at) ?: continue
      if (part.optString("actionType", "skip") != "skip") continue
      if (part.optString("category") !in SPONSOR_CATEGORIES) continue
      val segment = part.optJSONArray("segment") ?: continue
      val from = segment.optDouble(0, -1.0)
      val to = segment.optDouble(1, -1.0)
      if (from < 0 || to <= from) continue
      kept.put(org.json.JSONArray().put((from * 1000).toLong()).put((to * 1000).toLong()))
    }
    setSkips(context, trackId, kept.toString())
    return skipsOf(context, trackId)
  }

  /** [videoId]'s marked parts as SponsorBlock lists them, none where it has none; throws where neither address answered with a list. */
  internal fun sponsorParts(videoId: String): org.json.JSONArray {
    val query = "/api/skipSegments/${hashPrefix(videoId)}?categories=" +
      java.net.URLEncoder.encode(SPONSOR_CATEGORIES.joinToString(",", "[", "]") { "\"$it\"" }, "UTF-8")
    // Its own address, and the same list at an address of its own that is not behind Cloudflare: what one network or
    // DNS cannot reach, the other usually can. An answer that is not a list — a page put up by a Wi-Fi network that
    // wants signing into — is no answer, and the next is asked.
    var trouble: Exception? = null
    for (host in SPONSOR_HOSTS) {
      try {
        return partsOf(askSkips("https://$host$query"), videoId)
      } catch (error: Exception) {
        trouble = error
      }
    }
    throw trouble ?: IllegalStateException("SponsorBlock could not be reached")
  }

  /** Of an answer for the videos sharing a prefix, [videoId]'s parts. */
  internal fun partsOf(answer: String, videoId: String): org.json.JSONArray {
    val videos = org.json.JSONArray(answer)
    for (at in 0 until videos.length()) {
      val video = videos.optJSONObject(at) ?: continue
      if (video.optString("videoID") == videoId) return video.optJSONArray("segments") ?: org.json.JSONArray()
    }
    return org.json.JSONArray()
  }

  /** The first four characters of the SHA-256 of [videoId], in hex, as SponsorBlock is asked by. */
  internal fun hashPrefix(videoId: String): String =
    java.security.MessageDigest.getInstance("SHA-256").digest(videoId.toByteArray()).take(2).joinToString("") { "%02x".format(it) }

  private val SPONSOR_CATEGORIES = listOf("sponsor", "selfpromo", "interaction")
  private val SPONSOR_HOSTS = listOf("sponsor.ajay.app", "api.sponsor.ajay.app")

  /** One address's answer: the list, `[]` where it has none, or a throw where it gave none. */
  private fun askSkips(address: String): String {
    val connection = java.net.URL(address).openConnection() as java.net.HttpURLConnection
    try {
      connection.connectTimeout = 10_000
      connection.readTimeout = 15_000
      connection.setRequestProperty("User-Agent", "Jukebox (Android)")
      return when (val code = connection.responseCode) {
        404 -> "[]"
        200 -> connection.inputStream.use { it.readBytes().decodeToString() }
        else -> error("SponsorBlock answered $code")
      }
    } finally {
      connection.disconnect()
    }
  }

  private const val SKIPS = "skips"
  const val SKIP_SILENCE = "skipSilence"
  const val VOICE_CLARITY = "voiceClarity"
  const val SPONSORS = "skipSponsors"

  /** The music's speed, put aside by an app from before the service did it, taken over. */
  fun keepMusicSpeed(context: Context, speed: Float) {
    val prefs = context.getSharedPreferences(SETTINGS_FILE, Context.MODE_PRIVATE)
    if (!prefs.contains(MUSIC_SPEED)) prefs.edit().putFloat(MUSIC_SPEED, speed).apply()
  }

  private const val SETTINGS_FILE = "jukebox.tapes"
  private const val SPEEDS = "speeds"
  private const val MUSIC_SPEED = "musicSpeed"
  private const val JUMP_BACK = "jumpBack"
  private const val JUMP_FORWARD = "jumpForward"
  private const val JUMPS_BY_KEY = "jumpsByKey"
  private const val SMART_REWIND = "smartRewind"
  private const val ROOT_FRESH_MS = 30_000L
}

/** Where a tape was left: how far in, out of how long, when, and whether it was heard to the end. */
internal data class TapePlace(val positionMs: Long, val durationMs: Long, val at: Long, val finished: Boolean)

/**
 * The places, on the disk, by the track's id. A few hundred at most for
 * anybody, so one small map in the preferences is enough, read whole.
 */
internal object TapeStore {
  /**
   * A file of their own, written every few seconds while a tape plays: in
   * the tapes' file, beside each tape's chapters and parts to pass over, the
   * whole of that was written out again each time.
   */
  private const val FILE = "jukebox.tapes.places"
  /** Where they were kept before, taken over from as the first reading finds none here. */
  private const val OLD_FILE = "jukebox.tapes"
  private const val KEY = "places"
  /** The oldest let go past this many, so the map cannot grow without end. */
  private const val MOST = 600

  /** The places' own file, with any kept in the old one moved into it the first time. */
  private fun prefs(context: Context): android.content.SharedPreferences {
    val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    if (!prefs.contains(KEY)) {
      val old = context.getSharedPreferences(OLD_FILE, Context.MODE_PRIVATE)
      old.getString(KEY, null)?.let { words ->
        prefs.edit().putString(KEY, words).commit()
        old.edit().remove(KEY).apply()
      }
    }
    return prefs
  }

  @Synchronized
  fun all(context: Context): Map<String, TapePlace> {
    val words = prefs(context).getString(KEY, null) ?: return emptyMap()
    return try {
      val json = JSONObject(words)
      json.keys().asSequence().mapNotNull { id ->
        val entry = json.optJSONObject(id) ?: return@mapNotNull null
        id to TapePlace(entry.optLong("p"), entry.optLong("d"), entry.optLong("u"), entry.optBoolean("f"))
      }.toMap()
    } catch (_: Exception) {
      emptyMap()
    }
  }

  fun get(context: Context, id: String): TapePlace? = all(context)[id]

  /**
   * [places] brought in from a backup: in place of every place there was
   * where [replace], or else beside them, the later of two for one tape.
   */
  @Synchronized
  fun bring(context: Context, places: Map<String, TapePlace>, replace: Boolean) {
    val kept = if (replace) HashMap() else all(context).toMutableMap()
    for ((id, place) in places) {
      val mine = kept[id]
      if (mine == null || place.at > mine.at) kept[id] = place
    }
    val json = JSONObject()
    for ((key, value) in kept.entries.sortedByDescending { it.value.at }.take(MOST)) {
      json.put(key, JSONObject().put("p", value.positionMs).put("d", value.durationMs).put("u", value.at).put("f", value.finished))
    }
    prefs(context).edit().putString(KEY, json.toString()).apply()
  }

  @Synchronized
  fun put(context: Context, id: String, place: TapePlace?) {
    val places = all(context).toMutableMap()
    if (place == null) places.remove(id) else places[id] = place
    val kept = places.entries.sortedByDescending { it.value.at }.take(MOST)
    val json = JSONObject()
    for ((key, value) in kept) {
      json.put(key, JSONObject().put("p", value.positionMs).put("d", value.durationMs).put("u", value.at).put("f", value.finished))
    }
    prefs(context).edit().putString(KEY, json.toString()).apply()
  }
}

/**
 * Keeps each tape's place as it plays, and takes a tape back to it when it
 * comes on again.
 *
 * Written down every few seconds while one plays, when it is paused, and as
 * it is left for another track, from where it was at that moment. Heard
 * nearly to the end, it is finished, and starts from the top next time. Put
 * back a few seconds early, so that the sentence it stopped in is heard
 * again from somewhere near its start.
 */
internal class TapeKeeper(private val context: Context, private val player: ExoPlayer) : Player.Listener {
  private val handler = Handler(player.applicationLooper)

  private val keep = object : Runnable {
    override fun run() {
      saveCurrent()
      if (player.isPlaying) handler.postDelayed(this, EVERY_MS)
    }
  }

  /** When the tape playing was last paused by somebody, for going back a little as it is played again. */
  private var pausedAt = 0L

  /**
   * The tape playing, marked heard by hand: its place is the one the mark
   * put, and is not written over from where it is until another track comes.
   */
  private var held: String? = null

  /** The tape playing, marked not begun by hand and being sent to its start: the seek there keeps no place. */
  private var resetting: String? = null

  init {
    live = this
    handler.post { Tapes.applyListening(context, player, player.currentMediaItem) }
  }

  /** The playing tape's parts to pass over, read as it comes on and when they are found. */
  private var skips: List<LongRange> = emptyList()

  /**
   * Passes over a part of the playing tape to be skipped as the tape comes
   * to it: looked at twice a second while a tape that has any plays.
   */
  private val skipper = object : Runnable {
    override fun run() {
      if (!player.isPlaying || skips.isEmpty()) return
      val at = player.currentPosition
      // Only one entered from its start, not one sought into on purpose part way.
      skips.firstOrNull { at in it.first until (it.last - 500) && at - it.first < 1_500 }?.let { skip -> expo.modules.jukeboxaudio.sleep.SleepTimers.passOver { player.seekTo(skip.last) } }
      handler.postDelayed(this, 500)
    }
  }

  private fun readSkips() {
    val item = player.currentMediaItem
    skips = if (item != null && Tapes.isTape(context, item) && Tapes.flag(context, Tapes.SPONSORS, true)) {
      Tapes.skipsOf(context, Tapes.idOf(item))
    } else emptyList()
    handler.removeCallbacks(skipper)
    if (player.isPlaying && skips.isNotEmpty()) handler.post(skipper)
  }

  /** A tape's parts to pass over found by the app, or the switch for them turned: read again at once. */
  fun reskip() = handler.post { readSkips() }

  /** A tape's switch changed in the app: in force on the one playing at once. */
  fun relisten() = handler.post {
    Tapes.applyListening(context, player, player.currentMediaItem)
    readSkips()
  }

  /**
   * A tape marked heard or not begun by hand (`markTapeAsync`). Where it is
   * the one playing, the mark holds: heard, it stops being written over;
   * not begun, it goes back to its start.
   */
  fun marked(id: String, finished: Boolean) = handler.post {
    val item = player.currentMediaItem ?: return@post
    if (Tapes.idOf(item) != id) return@post
    if (finished) {
      held = id
    } else {
      held = null
      resetting = id
      player.seekTo(0)
    }
  }

  override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
    if (!playWhenReady) {
      pausedAt = System.currentTimeMillis()
      return
    }
    val away = if (pausedAt > 0) System.currentTimeMillis() - pausedAt else 0L
    pausedAt = 0L
    // Played again after a while: a little of it again first, as on coming back to it from elsewhere.
    if (away < AWAY_AT_LEAST_MS || !Tapes.isTape(context, player.currentMediaItem)) return
    val position = player.currentPosition
    if (position < LEAST_KEPT_MS) return
    val back = Tapes.rewindMsFor(context, away)
    if (back > 0) player.seekTo((position - back).coerceAtLeast(0))
  }

  override fun onIsPlayingChanged(isPlaying: Boolean) {
    handler.removeCallbacks(keep)
    handler.removeCallbacks(skipper)
    if (isPlaying && skips.isNotEmpty()) handler.post(skipper)
    if (isPlaying) handler.postDelayed(keep, EVERY_MS) else saveCurrent()
  }

  override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
    val item = oldPosition.mediaItem ?: return
    if (!Tapes.isTape(context, item)) return
    // Run out by itself: heard to the end, whatever the clock said a moment before.
    if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION) {
      val duration = durationOf(item).takeIf { it > 0 } ?: oldPosition.positionMs
      save(Tapes.idOf(item), duration, duration)
      return
    }
    // Sent to its start by being marked not begun: where it was is what the mark undid.
    if (resetting == Tapes.idOf(item) && reason == Player.DISCONTINUITY_REASON_SEEK) {
      resetting = null
      return
    }
    // Left for another track, or moved about in this one: where it was, as it was left.
    if (oldPosition.mediaItemIndex != newPosition.mediaItemIndex || reason == Player.DISCONTINUITY_REASON_SEEK) {
      keep(Tapes.idOf(item), oldPosition.positionMs, durationOf(item))
    }
  }

  override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
    // Another track: a pause before it is nothing to go back over in this one, which keeps its own place.
    pausedAt = 0L
    if (mediaItem == null || Tapes.idOf(mediaItem) != held) held = null
    if (mediaItem != null) Tapes.applySpeed(context, player, mediaItem)
    Tapes.applyListening(context, player, mediaItem)
    readSkips()
    // Round again on repeat is from the top, as it is for anything on repeat.
    if (mediaItem == null || reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT) return
    if (!Tapes.isTape(context, mediaItem)) return
    val place = TapeStore.get(context, Tapes.idOf(mediaItem)) ?: return
    if (place.finished || place.positionMs < LEAST_KEPT_MS) return
    if (place.durationMs > 0 && place.durationMs - place.positionMs < LEFT_AT_END_MS) return
    val to = (place.positionMs - Tapes.rewindMsFor(context, System.currentTimeMillis() - place.at)).coerceAtLeast(0)
    // After the transition has settled, and only from the top: a queue put back with its own place, or a seek
    // already asked for, is not to be overruled.
    handler.post {
      if (player.currentMediaItem?.mediaId != mediaItem.mediaId) return@post
      if (player.currentPosition > FROM_THE_TOP_MS) return@post
      player.seekTo(to)
    }
  }

  /** The place of what is playing now, if it is a tape. Also for the service to call as it stops. */
  fun saveCurrent() {
    val item = player.currentMediaItem ?: return
    if (!Tapes.isTape(context, item)) return
    keep(Tapes.idOf(item), player.currentPosition, player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: durationOf(item))
  }

  /**
   * [save], unless it would put a place back to the top: nothing heard yet,
   * as at the moment a tape is put on and before it has been sent on to its
   * place, or as that sending itself, is not to overwrite where it was.
   */
  private fun keep(id: String, positionMs: Long, durationMs: Long) {
    if (id == held) return
    if (positionMs < LEAST_KEPT_MS) {
      val before = TapeStore.get(context, id)
      if (before != null && !before.finished && before.positionMs >= LEAST_KEPT_MS) return
    }
    save(id, positionMs, durationMs)
  }

  private fun save(id: String, positionMs: Long, durationMs: Long) {
    if (id.isEmpty()) return
    val finished = durationMs > 0 && (positionMs >= durationMs - LEFT_AT_END_MS || positionMs >= durationMs * 0.97)
    TapeStore.put(context, id, TapePlace(positionMs.coerceAtLeast(0), durationMs.coerceAtLeast(0), System.currentTimeMillis(), finished))
  }

  private fun durationOf(item: MediaItem): Long {
    if (item.mediaId == player.currentMediaItem?.mediaId && player.duration != C.TIME_UNSET && player.duration > 0) return player.duration
    val seconds = item.mediaMetadata.extras?.getDouble(EXTRA_DURATION_SEC, -1.0) ?: -1.0
    return if (seconds > 0) (seconds * 1000).toLong() else 0L
  }

  fun release() {
    handler.removeCallbacksAndMessages(null)
    if (live === this) live = null
  }

  companion object {
    /** The keeper of the player running, for a mark made in the app to reach. */
    @Volatile var live: TapeKeeper? = null

    private const val EVERY_MS = 5_000L
    /** Less than this in, and there is no place worth going back to. */
    private const val LEAST_KEPT_MS = 10_000L
    /** Less than this left, and it was heard. */
    private const val LEFT_AT_END_MS = 30_000L
    /** Paused for less than this, and it is played on from where it is. */
    private const val AWAY_AT_LEAST_MS = 60_000L
    /** Further in than this, a tape put on has already been sent somewhere, and is left there. */
    private const val FROM_THE_TOP_MS = 2_500L
  }
}
