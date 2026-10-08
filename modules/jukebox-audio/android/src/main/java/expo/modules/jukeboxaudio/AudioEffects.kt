package expo.modules.jukeboxaudio

import android.content.Context
import android.media.audiofx.BassBoost
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer
import expo.modules.jukeboxaudio.equalizer.Parametric
import expo.modules.jukeboxaudio.equalizer.ParametricSettings

/**
 * The equalizer's switch, and the three tone controls beside it.
 *
 * Two kinds of thing answer to that switch. The equalizer itself is the
 * app's own, a stage in the player's audio chain ([Parametric]); what this
 * does for it is read its settings off the disk and put them in force. The
 * bass boost, the surround and the loudness are Android's effects, running
 * in the audio framework rather than in this process, below the player, on
 * the mix -- and the rest of this file is about those.
 *
 * It used to drive Android's equalizer as well. That one is whatever the
 * phone makes of it -- five bands on most, at frequencies nobody chose --
 * and it is no longer touched: no [android.media.audiofx.Equalizer] is
 * built, so none is in the way of the app's own. What had been set on it is
 * carried over once; see [EffectsStore.parametric].
 *
 * An effect is bound to an audio session, which belongs to the player, which
 * belongs to [PlaybackService]. So this is a singleton the service hands a
 * session to when it starts and takes back when it stops, and the settings it
 * applies are read from disk rather than passed in — a media button pressed
 * after the app has been killed starts the service with no JavaScript anywhere,
 * and the music should still sound the way it was left.
 *
 * Every construction here is guarded. Which effects a device actually has is up
 * to the device, and a phone that refuses one of them must still play music.
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

  /** The session the effects are on, or zero while there is none. */
  private var session = 0
  private var bassBoost: BassBoost? = null
  private var virtualizer: Virtualizer? = null
  private var loudness: LoudnessEnhancer? = null

  /**
   * Puts the app's own equalizer the way it was left.
   *
   * Apart from [attach], and before it: this needs no session, and it has to
   * have happened before the player's audio chain is built, so that the
   * first buffer through it is already shaped.
   */
  @Synchronized
  fun load(context: Context) {
    Parametric.publish(EffectsStore.parametric(context).curve(EffectsStore.read(context).enabled))
  }

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
    session = sessionId

    bassBoost = runCatching { BassBoost(PRIORITY, sessionId) }.getOrNull()
    virtualizer = runCatching { Virtualizer(PRIORITY, sessionId) }.getOrNull()
    loudness = runCatching { LoudnessEnhancer(sessionId) }.getOrNull()

    apply(EffectsStore.read(context))
  }

  @Synchronized
  fun release() {
    runCatching { bassBoost?.release() }
    runCatching { virtualizer?.release() }
    runCatching { loudness?.release() }
    session = 0
    bassBoost = null
    virtualizer = null
    loudness = null
  }

  /**
   * Puts [settings] into effect.
   *
   * The enabled flag is the master switch for all of it: turning the
   * equalizer off has to turn off the bass boost with it, or half the
   * colouring stays behind and the switch looks broken.
   *
   * Each effect is set on its own and failures are swallowed one at a time,
   * so a device that refuses the virtualizer still gets its bass boost.
   */
  @Synchronized
  fun apply(settings: EffectsStore.Settings) {
    // Each is switched off at zero rather than left enabled with
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
   * Stores [settings] and puts them in force, and says what resulted.
   *
   * [parametric] is the app's own equalizer, or null to leave it as it is --
   * which is what a caller that knows nothing of it sends, a backup from
   * before it existed among them.
   *
   * Stored first: the service that plays the next song may be one that has
   * not started yet. The running players need telling nothing more than the
   * publish below; their processors read the curve on their next buffer.
   *
   * What comes back is the whole state, so the screen that called this can
   * take the answer as its new truth rather than guessing at one.
   */
  @Synchronized
  fun update(
    context: Context,
    settings: EffectsStore.Settings,
    parametric: ParametricSettings?
  ): Map<String, Any?> {
    EffectsStore.write(context, settings)
    // A note about the old equalizer has been seen by the time anything is
    // changed from the screen that shows it, and is not shown again.
    parametric?.let { EffectsStore.writeParametric(context, it.copy(notice = null)) }
    load(context)
    apply(settings)
    return describe(context)
  }

  /**
   * Everything the settings screen needs, in one read.
   *
   * The same with nothing playing as with something: the equalizer is the
   * app's own and is always there to be set, and the three effects that are
   * the phone's are taken to be there until a session says otherwise. The
   * note about nothing playing is the only difference the user sees.
   */
  @Synchronized
  fun describe(context: Context): Map<String, Any?> {
    val settings = EffectsStore.read(context)
    return mapOf(
      "attached" to (session != 0),
      "enabled" to settings.enabled,
      "parametric" to EffectsStore.parametric(context).toMap(),
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
