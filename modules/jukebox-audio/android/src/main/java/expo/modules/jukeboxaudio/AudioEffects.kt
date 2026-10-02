package expo.modules.jukeboxaudio

import android.content.Context
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer

/**
 * The equalizer and the three tone controls beside it.
 *
 * These are Android's own effects, running in the audio framework rather than
 * in this process. That is the whole reason to use them: the filtering happens
 * below the player, on the mix, and moving a slider costs one call — no audio
 * ever passes through JavaScript, so a drag across five bands cannot make a
 * song stutter.
 *
 * An effect is bound to an audio session, which belongs to the player, which
 * belongs to [PlaybackService]. So this is a singleton the service hands a
 * session to when it starts and takes back when it stops, and the settings it
 * applies are read from disk rather than passed in — a media button pressed
 * after the app has been killed starts the service with no JavaScript anywhere,
 * and the music should still sound the way it was left.
 *
 * Every construction here is guarded. Which effects a device actually has is up
 * to the device: the equalizer is near universal, the other three are not, and
 * a phone that refuses one of them must still play music.
 */
object AudioEffects {
  /**
   * Zero is the documented value for an application with no particular claim on
   * the effect. Asking for more would let this app's settings displace another
   * one's, which is not a fight worth picking over a personal music player.
   */
  private const val PRIORITY = 0

  /** Loudness above this stops being a boost and starts being distortion. */
  private const val MAX_LOUDNESS_MB = 2_000

  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private var virtualizer: Virtualizer? = null
  private var loudness: LoudnessEnhancer? = null

  /**
   * Binds every effect to [sessionId] and puts the stored settings back.
   *
   * Called on the player being built. Anything already attached is let go
   * first, because effects hold a native handle per session and leaking one
   * leaves the old filtering in place over the new sound.
   */
  @Synchronized
  fun attach(context: Context, sessionId: Int) {
    release()
    if (sessionId == 0) return

    equalizer = runCatching { Equalizer(PRIORITY, sessionId) }.getOrNull()
    bassBoost = runCatching { BassBoost(PRIORITY, sessionId) }.getOrNull()
    virtualizer = runCatching { Virtualizer(PRIORITY, sessionId) }.getOrNull()
    loudness = runCatching { LoudnessEnhancer(sessionId) }.getOrNull()

    // Written down as soon as they are known, so the settings screen can draw
    // the right number of sliders at the right frequencies even when nothing
    // is playing and there is no session to ask.
    capabilities()?.let { EffectsStore.saveBands(context, it) }
    apply(EffectsStore.read(context))
  }

  @Synchronized
  fun release() {
    runCatching { equalizer?.release() }
    runCatching { bassBoost?.release() }
    runCatching { virtualizer?.release() }
    runCatching { loudness?.release() }
    equalizer = null
    bassBoost = null
    virtualizer = null
    loudness = null
  }

  /** What this device's equalizer can actually do, or null while unattached. */
  @Synchronized
  fun capabilities(): EffectsStore.Bands? {
    val eq = equalizer ?: return null
    return runCatching {
      val range = eq.bandLevelRange
      EffectsStore.Bands(
        count = eq.numberOfBands.toInt(),
        minMb = range[0].toInt(),
        maxMb = range[1].toInt(),
        // Reported in millihertz, which is a unit nobody thinks in. Hertz is
        // what the labels say, so hertz is what is stored.
        centresHz = (0 until eq.numberOfBands).map { eq.getCenterFreq(it.toShort()) / 1000 },
        presets = (0 until eq.numberOfPresets).map { eq.getPresetName(it.toShort()) }
      )
    }.getOrNull()
  }

  /**
   * Puts [settings] into effect.
   *
   * The enabled flag is the master switch for all four: turning the equalizer
   * off has to turn off the bass boost with it, or half the colouring stays
   * behind and the switch looks broken.
   *
   * Each effect is set on its own and failures are swallowed one at a time,
   * so a device that refuses the virtualizer still gets its equalizer.
   */
  @Synchronized
  fun apply(settings: EffectsStore.Settings) {
    equalizer?.let { eq ->
      runCatching {
        eq.enabled = settings.enabled
        if (settings.preset >= 0 && settings.preset < eq.numberOfPresets) {
          eq.usePreset(settings.preset.toShort())
        } else {
          val range = eq.bandLevelRange
          for (band in 0 until eq.numberOfBands) {
            val level = settings.bands.getOrElse(band.toInt()) { 0 }
            eq.setBandLevel(
              band.toShort(),
              level.coerceIn(range[0].toInt(), range[1].toInt()).toShort()
            )
          }
        }
      }
    }

    // The three below are switched off at zero rather than left enabled with
    // nothing to do: an effect in the chain still costs a pass over the audio,
    // and a strength of zero is the user saying they do not want it.
    bassBoost?.let { effect ->
      runCatching {
        effect.enabled = settings.enabled && settings.bass > 0
        if (effect.strengthSupported) effect.setStrength(settings.bass.coerceIn(0, 1000).toShort())
      }
    }

    virtualizer?.let { effect ->
      runCatching {
        effect.enabled = settings.enabled && settings.virtualizer > 0
        if (effect.strengthSupported) {
          effect.setStrength(settings.virtualizer.coerceIn(0, 1000).toShort())
        }
      }
    }

    loudness?.let { effect ->
      runCatching {
        effect.enabled = settings.enabled && settings.loudness > 0
        effect.setTargetGain(settings.loudness.coerceIn(0, MAX_LOUDNESS_MB))
      }
    }
  }

  /**
   * Applies [settings], stores what they actually came to, and says so.
   *
   * The distinction matters for presets. Choosing one hands the curve to the
   * device, which knows what "Classical" means here and this app does not; the
   * band levels are then read back out so the faders can show it. Storing what
   * was asked for instead would leave them sitting wherever they were before,
   * describing a curve that is no longer in force.
   *
   * What comes back is the whole state, so the screen that called this can
   * take the answer as its new truth rather than guessing at one.
   */
  @Synchronized
  fun update(context: Context, settings: EffectsStore.Settings): Map<String, Any?> {
    apply(settings)

    val effective =
      if (settings.preset >= 0) levels() ?: settings.bands else settings.bands
    EffectsStore.write(context, settings.copy(bands = effective))
    return describe(context)
  }

  /** Where the bands actually sit, which after a preset is not what was sent. */
  private fun levels(): List<Int>? {
    val eq = equalizer ?: return null
    return runCatching {
      (0 until eq.numberOfBands).map { eq.getBandLevel(it.toShort()).toInt() }
    }.getOrNull()
  }

  /**
   * Everything the settings screen needs, in one read.
   *
   * The capabilities come from the live equalizer when there is one and from
   * what was written down last time when there is not, so the sliders are drawn
   * the same either way — and the note about nothing playing is the only
   * difference the user sees.
   */
  @Synchronized
  fun describe(context: Context): Map<String, Any?> {
    val bands = capabilities() ?: EffectsStore.readBands(context)
    val settings = EffectsStore.read(context)
    return mapOf(
      "attached" to (equalizer != null),
      "bandCount" to bands.count,
      "minMb" to bands.minMb,
      "maxMb" to bands.maxMb,
      "centresHz" to bands.centresHz,
      "presets" to bands.presets,
      "enabled" to settings.enabled,
      "preset" to settings.preset,
      "bands" to List(bands.count) { settings.bands.getOrElse(it) { 0 } },
      "bass" to settings.bass,
      "virtualizer" to settings.virtualizer,
      "loudness" to settings.loudness,
      "bassSupported" to (bassBoost?.let { runCatching { it.strengthSupported }.getOrDefault(false) } ?: true),
      "virtualizerSupported" to
        (virtualizer?.let { runCatching { it.strengthSupported }.getOrDefault(false) } ?: true),
      "maxLoudnessMb" to MAX_LOUDNESS_MB
    )
  }
}
