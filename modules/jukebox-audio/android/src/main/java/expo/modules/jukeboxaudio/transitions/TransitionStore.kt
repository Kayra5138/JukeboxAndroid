package expo.modules.jukeboxaudio.transitions

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * The transition settings, written where the service can read them.
 *
 * Same reasoning as the queue and the equalizer beside it: a media button
 * pressed after the app has been killed starts the playback service with no
 * JavaScript in the process, and the music should behave the way it was left.
 */
object TransitionStore {
  private const val FILE = "transitions.json"

  @Volatile private var cached: TransitionSettings? = null

  private fun file(context: Context) = File(context.filesDir, FILE)

  fun read(context: Context): TransitionSettings {
    cached?.let { return it }

    val loaded = runCatching {
      val target = file(context)
      if (!target.isFile) return@runCatching TransitionSettings()
      val body = JSONObject(target.readText())
      val fallback = TransitionSettings()
      held(
        TransitionSettings(
          enabled = body.optBoolean("enabled", fallback.enabled),
          autoMs = body.optLong("autoMs", fallback.autoMs),
          manualMs = body.optLong("manualMs", fallback.manualMs),
          pauseMs = body.optLong("pauseMs", fallback.pauseMs),
          seekMs = body.optLong("seekMs", fallback.seekMs),
          skipSameAlbum = body.optBoolean("skipSameAlbum", fallback.skipSameAlbum),
          equalPower = body.optBoolean("equalPower", fallback.equalPower)
        )
      )
    }.getOrDefault(TransitionSettings())

    cached = loaded
    return loaded
  }

  fun write(context: Context, settings: TransitionSettings) {
    val clamped = held(settings)
    cached = clamped

    runCatching {
      // Through a temporary file, so a write cut short leaves the settings that
      // were there rather than half of the new ones.
      val target = file(context)
      val temporary = File(target.parentFile, "$FILE.part")
      temporary.writeText(
        JSONObject()
          .put("enabled", clamped.enabled)
          .put("autoMs", clamped.autoMs)
          .put("manualMs", clamped.manualMs)
          .put("pauseMs", clamped.pauseMs)
          .put("seekMs", clamped.seekMs)
          .put("skipSameAlbum", clamped.skipSameAlbum)
          .put("equalPower", clamped.equalPower)
          .toString()
      )
      if (!temporary.renameTo(target)) temporary.delete()
    }
  }

  fun toMap(settings: TransitionSettings): Map<String, Any?> = mapOf(
    "enabled" to settings.enabled,
    "autoMs" to settings.autoMs,
    "manualMs" to settings.manualMs,
    "pauseMs" to settings.pauseMs,
    "seekMs" to settings.seekMs,
    "skipSameAlbum" to settings.skipSameAlbum,
    "equalPower" to settings.equalPower,
    // Sent rather than written into the screen, so the sliders and the thing
    // enforcing their limits can never drift apart.
    "maxAutoMs" to TransitionSettings.MAX_AUTO_MS,
    "maxManualMs" to TransitionSettings.MAX_MANUAL_MS,
    "maxPauseMs" to TransitionSettings.MAX_PAUSE_MS,
    "maxSeekMs" to TransitionSettings.MAX_SEEK_MS,
    /*
      What a fresh install has. Sent rather than written into the screen for
      the same reason the ceilings are: a reset button holding its own copy of
      these numbers is a second place for them to be changed, and the two would
      disagree the first time one of them was.
    */
    "defaults" to mapOf(
      "autoMs" to TransitionSettings().autoMs,
      "manualMs" to TransitionSettings().manualMs,
      "pauseMs" to TransitionSettings().pauseMs,
      "seekMs" to TransitionSettings().seekMs,
      "skipSameAlbum" to TransitionSettings().skipSameAlbum,
      "equalPower" to TransitionSettings().equalPower
    )
  )

  fun fromMap(values: Map<String, Any?>): TransitionSettings {
    val fallback = TransitionSettings()
    fun duration(key: String, orElse: Long) = (values[key] as? Number)?.toLong() ?: orElse

    return held(
      TransitionSettings(
        enabled = values["enabled"] as? Boolean ?: fallback.enabled,
        autoMs = duration("autoMs", fallback.autoMs),
        manualMs = duration("manualMs", fallback.manualMs),
        pauseMs = duration("pauseMs", fallback.pauseMs),
        seekMs = duration("seekMs", fallback.seekMs),
        skipSameAlbum = values["skipSameAlbum"] as? Boolean ?: fallback.skipSameAlbum,
        equalPower = values["equalPower"] as? Boolean ?: fallback.equalPower
      )
    )
  }

  /**
   * Holds every duration inside its own limit.
   *
   * Applied on the way in and on the way out, so a settings file written by an
   * older build — when one ceiling covered all four — is brought into range on
   * first read rather than handed to the player as it stands.
   */
  private fun held(settings: TransitionSettings) = settings.copy(
    autoMs = settings.autoMs.coerceIn(0, TransitionSettings.MAX_AUTO_MS),
    manualMs = settings.manualMs.coerceIn(0, TransitionSettings.MAX_MANUAL_MS),
    pauseMs = settings.pauseMs.coerceIn(0, TransitionSettings.MAX_PAUSE_MS),
    seekMs = settings.seekMs.coerceIn(0, TransitionSettings.MAX_SEEK_MS)
  )
}
