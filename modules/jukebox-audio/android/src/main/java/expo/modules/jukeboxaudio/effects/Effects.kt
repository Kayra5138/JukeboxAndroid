package expo.modules.jukeboxaudio.effects

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * What the effects are set to, for every player in the process at once.
 *
 * Held here rather than handed to each sink because there is more than one
 * sink: the crossfade opens a second player for the outgoing track, and an
 * effect applied to one and not the other would be heard as the sound
 * changing across the join. Both read the same record.
 *
 * Swapped as one immutable object. The audio thread reads it without a lock —
 * a half-written setting would be a click — and a volatile reference is
 * exactly the guarantee needed: whichever record it sees, it sees all of it.
 */
object Effects {
  private const val FILE = "audio-effects.json"

  data class Settings(
    /** Level trim before anything else, in decibels. */
    val preampDb: Float = 0f,
    /**
     * How wide the stereo image is. Zero folds it to mono, one leaves the
     * recording alone, and above one pushes the sides out.
     */
    val width: Float = 1f,
    /** Negative is left, positive is right. */
    val balance: Float = 0f,
    /** Left and right the other way round. */
    val swap: Boolean = false,
    /**
     * How much of each channel is fed to the far ear, delayed and dulled.
     *
     * What speakers do and headphones do not: a hard-panned sixties mix that
     * sits inside the skull comes back out in front of it.
     */
    val crossfeed: Float = 0f,
    /** How far the image swings from side to side, and how long a turn takes. */
    val rotate: Float = 0f,
    val rotateSeconds: Float = 12f,
    /**
     * Which of the four treatments the record is played through, if any.
     *
     * Named rather than given as a set of numbers because these are
     * characters, not settings: what makes the vintage one is the bit depth
     * and the hold rate and the roll-off after it together, and exposing the
     * three separately would be three ways to arrive at none of them. What
     * each name means is in [VoiceChain].
     */
    val voice: String = OFF,
    /**
     * How much of the treated sound is heard against the record it was made
     * from. Nought is the record untouched; the amount each voice was actually
     * judged at is [judgedMix], which is what the screen offers when one is
     * picked.
     */
    val voiceMix: Float = DEFAULT_VOICE_MIX
  ) {
    /** Whether anything at all is being done, so the quiet path can be taken. */
    val idle: Boolean
      get() = preampDb == 0f && width == 1f && balance == 0f && !swap &&
        crossfeed == 0f && rotate == 0f && voice == OFF
  }

  const val OFF = "off"
  const val ROBOT = "robot"
  const val VINTAGE = "vintage"
  const val SWIRL = "swirl"
  const val CHIPMUNK = "chipmunk"
  const val SQUEAK = "squeak"

  /**
   * Everything that is a voice. Anything else is no voice at all.
   *
   * The name crosses from JavaScript as a bare string and is read back out of
   * a file, so it is the one field that can arrive as anything — including the
   * names of the vocoder's characters, which this version no longer has.
   */
  val VOICES = setOf(OFF, ROBOT, VINTAGE, SWIRL, CHIPMUNK, SQUEAK)

  /** Wholly wet, which is what three of the four were chosen at. */
  const val DEFAULT_VOICE_MIX = 1f

  /**
   * How much of each voice was actually heard when it was chosen.
   *
   * Only the robot wanted any of the record left under it: ring modulation
   * takes the music somewhere inharmonic, and a little of the original
   * underneath is what keeps it a song rather than a noise. The swirl is a
   * flanger, which is already a mix of the sound with itself.
   */
  fun judgedMix(voice: String): Float = when (voice) {
    ROBOT -> 0.85f
    SWIRL -> 0.9f
    else -> DEFAULT_VOICE_MIX
  }

  @Volatile
  private var current = Settings()

  private var storage: File? = null

  @Synchronized
  fun load(context: Context) {
    if (storage != null) return
    val file = File(context.noBackupFilesDir, FILE)
    storage = file
    if (!file.isFile) return
    runCatching { current = read(JSONObject(file.readText())) }
  }

  fun settings(): Settings = current

  @Synchronized
  fun apply(context: Context, settings: Settings) {
    current = settings
    load(context)
    runCatching { storage?.writeText(write(settings).toString()) }
  }

  private fun read(json: JSONObject): Settings {
    /*
      A file written by an older version names one of the vocoder's characters,
      which no longer exists. It is dropped rather than guessed at, and its
      amount goes with it: a number left behind from a setting that is gone
      would leave the screen showing nobody's settings.
    */
    val voice = json.optString("voice", OFF).takeIf { it in VOICES } ?: OFF
    return Settings(
      preampDb = json.optDouble("preampDb", 0.0).toFloat(),
      width = json.optDouble("width", 1.0).toFloat(),
      balance = json.optDouble("balance", 0.0).toFloat(),
      swap = json.optBoolean("swap", false),
      crossfeed = json.optDouble("crossfeed", 0.0).toFloat(),
      rotate = json.optDouble("rotate", 0.0).toFloat(),
      rotateSeconds = json.optDouble("rotateSeconds", 12.0).toFloat(),
      voice = voice,
      voiceMix = if (voice == OFF) DEFAULT_VOICE_MIX
      else json.optDouble("voiceMix", judgedMix(voice).toDouble()).toFloat().coerceIn(0f, 1f)
    )
  }

  private fun write(s: Settings) = JSONObject()
    .put("preampDb", s.preampDb.toDouble())
    .put("width", s.width.toDouble())
    .put("balance", s.balance.toDouble())
    .put("swap", s.swap)
    .put("crossfeed", s.crossfeed.toDouble())
    .put("rotate", s.rotate.toDouble())
    .put("rotateSeconds", s.rotateSeconds.toDouble())
    .put("voice", s.voice)
    .put("voiceMix", s.voiceMix.toDouble())

  fun asMap(s: Settings): Map<String, Any?> = mapOf(
    "preampDb" to s.preampDb,
    "width" to s.width,
    "balance" to s.balance,
    "swap" to s.swap,
    "crossfeed" to s.crossfeed,
    "rotate" to s.rotate,
    "rotateSeconds" to s.rotateSeconds,
    "voice" to s.voice,
    "voiceMix" to s.voiceMix
  )

  fun fromMap(m: Map<String, Any?>): Settings {
    fun number(key: String, fallback: Float): Float =
      (m[key] as? Number)?.toFloat() ?: fallback
    val voice = (m["voice"] as? String)?.takeIf { it in VOICES } ?: OFF
    return Settings(
      preampDb = number("preampDb", 0f).coerceIn(-12f, 6f),
      width = number("width", 1f).coerceIn(0f, 2f),
      balance = number("balance", 0f).coerceIn(-1f, 1f),
      swap = (m["swap"] as? Boolean) ?: false,
      crossfeed = number("crossfeed", 0f).coerceIn(0f, 1f),
      rotate = number("rotate", 0f).coerceIn(0f, 1f),
      rotateSeconds = number("rotateSeconds", 12f).coerceIn(2f, 40f),
      voice = voice,
      // Asking for a voice and saying nothing about how much of it gets the
      // amount it was chosen at, rather than whatever the last one used.
      voiceMix = number("voiceMix", judgedMix(voice)).coerceIn(0f, 1f)
    )
  }
}
