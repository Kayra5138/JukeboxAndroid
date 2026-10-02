package expo.modules.jukeboxaudio.game

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp

/**
 * The sound of the glass being touched. Not of anything being played.
 *
 * The distinction is the whole design, and it took three wrong goes to find.
 * The game answered a key with a piano chord, which had a key the record did
 * not share; then with drums, which had no key but were still a second drummer
 * over a mix that already had one; then by moving the record's own level, which
 * was heard as a fault rather than as a reply. All three were music, and music
 * has to agree with music.
 *
 * These do not. They are knocks — filtered noise, quiet, a few hundredths of a
 * second — and they carry no pitch, no rhythm and no lane. They say a finger
 * landed and whether it landed on anything, and nothing at all about the song.
 *
 * Three of them, because those are three different facts and a player should
 * not have to read the screen to tell them apart: a key was struck, the glass
 * was struck where there was nothing, or a key went past without being struck
 * at all. The last two are both mistakes and are deliberately not the same
 * mistake -- one is something the player did, the other something they failed
 * to do, and a run is lost by the second far more often than the first.
 *
 * Told apart by their shape rather than by pitch, because none of them has one.
 * The hit is soft and dull. The empty tap is the opposite of it -- short, dry
 * and brittle, the sound of striking something that was not there. The lapse
 * falls: its brightness slides away over a quarter of a second, which is the
 * one of the three that is heard as something escaping rather than as contact.
 *
 * A held key adds three more, and they are a small story rather than three
 * facts: a breath that goes on for as long as the finger stays down, and then
 * one of two endings. Kept to the finish, it rises -- the lapse turned over,
 * and the only sound here meant to be enjoyed. Let go of early, it is a plain
 * soft knock: nothing was lost but the bonus, so nothing is made of it.
 */
internal object Tap {
  private const val RATE = 44_100

  /**
   * Index into [sounds]: struck a key, struck nothing, let one past -- and the
   * two ways a held key can end, kept to the finish or let go of early.
   */
  const val HIT = 0
  const val EMPTY = 1
  const val LAPSE = 2
  const val KEPT = 3
  const val LET_GO = 4

  /** The name each is asked for by, which is what crosses from JavaScript. */
  fun of(kind: String): Int = when (kind) {
    "empty" -> EMPTY
    "lapse" -> LAPSE
    "kept" -> KEPT
    "letgo" -> LET_GO
    else -> HIT
  }

  private var sounds: Array<ShortArray>? = null
  private var tracks: Array<AudioTrack>? = null

  /*
    The one sound here that goes on: what is heard while a key is being held.

    Kept apart from the knocks because it is a different kind of thing. They
    are played once and forgotten; this one is switched on and off, loops for
    as long as a finger is down, and has to be able to stop without a click.
  */
  private var humming: ShortArray? = null
  private var hum: AudioTrack? = null

  /**
   * Both sounds made and both tracks opened, before the first key.
   *
   * Opening an `AudioTrack` talks to the mixer, which is another process. Left
   * until the first press it was being paid in the middle of a song, a few
   * notes in -- exactly where a stutter was being felt.
   */
  @Synchronized
  fun ready() {
    val made = sounds
      ?: arrayOf(knock(HIT), knock(EMPTY), knock(LAPSE), rise(), knock(LET_GO)).also { sounds = it }
    if (tracks == null) tracks = Array(made.size) { build(made[it]) }
    val loop = humming ?: breath().also { humming = it }
    if (hum == null) hum = build(loop)
  }

  /**
   * A key is being held, or has stopped being.
   *
   * Started from the top each time and stopped by being turned down first:
   * the mixer ramps a change of volume over its next buffer, so a loop that is
   * silenced and then paused ends on a fade a few milliseconds long, where one
   * that is simply stopped ends on whatever sample it happened to be at.
   */
  @Synchronized
  fun hold(on: Boolean) {
    val track = hum ?: return
    val length = humming?.size ?: return
    try {
      if (on) {
        if (track.playState != AudioTrack.PLAYSTATE_STOPPED) track.stop()
        track.setPlaybackHeadPosition(0)
        // Round and round until told otherwise. Set again on every start,
        // because a stop is allowed to forget it.
        track.setLoopPoints(0, length, -1)
        track.setVolume(1f)
        track.play()
      } else if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
        track.setVolume(0f)
        track.pause()
      }
    } catch (trouble: Exception) {
      android.util.Log.w("JukeboxTap", "could not ${if (on) "start" else "stop"} the hold", trouble)
    }
  }

  @Synchronized
  fun play(which: Int) {
    val open = tracks ?: return
    if (which !in open.indices) return
    val track = open[which]
    try {
      if (track.playState != AudioTrack.PLAYSTATE_STOPPED) track.stop()
      track.setPlaybackHeadPosition(0)
      track.play()
    } catch (trouble: Exception) {
      android.util.Log.w("JukeboxTap", "could not play $which", trouble)
    }
  }

  @Synchronized
  fun close() {
    tracks?.forEach { runCatching { it.stop() }; runCatching { it.release() } }
    tracks = null
    hum?.let { runCatching { it.stop() }; runCatching { it.release() } }
    hum = null
  }

  /**
   * Noise with its quick part taken off, under a decay with no edges in it.
   *
   * It was the other way round at first -- the fast part kept and the slow part
   * subtracted -- which is the sound of two hard things meeting. Correct for a
   * keyboard and far too sharp for this: struck a few times a second under a
   * record it was the brightest thing in the room. Keeping the slow part leaves
   * a soft knock with no edge to catch the ear, and because it is still noise
   * there is nothing in it that repeats and so nothing that could be a note.
   *
   * The fade at each end matters as much as the material between them. A burst
   * that begins or ends on a step has a click built into it whatever it is
   * made of.
   *
   * The cut-off is given as a pair, from and to, which is what makes the lapse
   * a different kind of thing rather than a louder one. The other two hold
   * still: a contact does not change colour while it happens. The lapse slides
   * from bright to dull across its whole length, and a falling sound is the one
   * thing here that is heard as going away.
   */
  private fun knock(which: Int): ShortArray {
    // Where the noise is cut off, at the start and at the end. Higher is
    // brighter; a tap on nothing is the brightest and thinnest of the three.
    val cornerFrom = when (which) {
      EMPTY -> 0.085
      LAPSE -> 0.075
      // Letting go of a hold before it was kept: the plainest sound here. Not
      // a mistake, so nothing brittle or falling about it -- only a finger
      // coming off the glass, duller and smaller than the tap that put it on.
      LET_GO -> 0.020
      else -> 0.030
    }
    val cornerTo = when (which) {
      LAPSE -> 0.006
      else -> cornerFrom
    }
    val decay = when (which) {
      EMPTY -> 120.0
      LAPSE -> 14.0
      LET_GO -> 60.0
      else -> 45.0
    }
    val seconds = when (which) {
      EMPTY -> 0.05
      LAPSE -> 0.28
      LET_GO -> 0.07
      else -> 0.09
    }
    val level = when (which) {
      EMPTY -> 0.105
      LAPSE -> 0.135
      LET_GO -> 0.065
      else -> 0.085
    }
    val attack = when (which) {
      EMPTY -> 0.0015
      LAPSE -> 0.006
      else -> 0.004
    }
    val gain = when (which) {
      EMPTY -> 4.5
      LAPSE -> 7.5
      else -> 6.5
    }

    val length = (RATE * seconds).toInt()
    val out = ShortArray(length)
    var mean = 0.0

    for (index in 0 until length) {
      val t = index.toDouble() / RATE
      val noise = Math.random() * 2.0 - 1.0
      // Swept across the length, so the lapse darkens as it dies. The other
      // two were given the same figure twice and so stand still.
      val corner = cornerFrom + (cornerTo - cornerFrom) * (index.toDouble() / length)
      mean += corner * (noise - mean)
      var value = mean * gain * exp(-decay * t)

      // Raised rather than switched on, which takes the edge off the front
      // without making it feel late.
      if (t < attack) value *= 0.5 - 0.5 * cos(PI * t / attack)
      // And closed again over the last tenth, so the end is not a step either.
      val left = 1.0 - index.toDouble() / length
      if (left < 0.1) value *= left / 0.1

      val scaled = value * level * 32767
      out[index] = when {
        scaled >= 32767 -> 32767
        scaled <= -32768 -> -32768
        else -> scaled.toInt().toShort()
      }
    }
    return out
  }

  /**
   * A hold kept to the end: the one sound here that is a reward.
   *
   * It rises, which is the whole of what makes it one. The lapse falls, and is
   * heard as something getting away; this is the same idea turned over -- a
   * narrow band of noise swept upward through four octaves in a quarter of a
   * second, so what is heard is something arriving, with a bright edge on it
   * where the lapse has a dull one.
   *
   * Still not a note. The band is always moving, so it never sits on a pitch
   * long enough to have one, and so it cannot be in the wrong key for the
   * record underneath it -- which is the rule everything in this file keeps.
   */
  private fun rise(): ShortArray {
    val seconds = 0.26
    val fromHz = 700.0
    val toHz = 6_200.0
    val level = 0.20
    val length = (RATE * seconds).toInt()
    val out = ShortArray(length)

    // A resonance two poles wide, retuned every sample as it climbs.
    var y1 = 0.0
    var y2 = 0.0
    for (index in 0 until length) {
      val through = index.toDouble() / length
      // Climbing by ratio rather than by hertz, so it rises evenly to the ear
      // instead of rushing the bottom and crawling at the top.
      val hz = fromHz * Math.pow(toHz / fromHz, through)
      val width = hz * 0.16
      val radius = exp(-PI * width / RATE)
      val a1 = 2.0 * radius * cos(2.0 * PI * hz / RATE)
      val a2 = -radius * radius
      val noise = Math.random() * 2.0 - 1.0
      // Scaled by the gap from the unit circle, which keeps the loudness even
      // as the band narrows in hertz on the way up.
      val y = noise * (1.0 - radius) * 2.4 + a1 * y1 + a2 * y2
      y2 = y1
      y1 = y

      // Up at once, then a long ease out: struck, and left to ring.
      val attack = 0.006
      val t = index.toDouble() / RATE
      var gain = if (t < attack) 0.5 - 0.5 * cos(PI * t / attack) else 1.0
      gain *= Math.pow(1.0 - through, 1.6)

      val scaled = y * gain * level * 32767
      out[index] = when {
        scaled >= 32767 -> 32767
        scaled <= -32768 -> -32768
        else -> scaled.toInt().toShort()
      }
    }
    return out
  }

  /**
   * What is heard while a key is held: a soft breath that goes on.
   *
   * Air rather than tone, for the same reason as everything else here, and
   * pulsing gently so it is heard as something being kept going rather than as
   * hiss that has appeared under the record. Quiet enough to sit beneath the
   * music; present enough that taking a finger off is heard as it stopping.
   *
   * Made to loop without a seam. The end is not cut to meet the beginning but
   * faded into it -- a quarter second more is made than is kept, and that extra
   * is laid over the start as the start fades in -- and the pulse runs a whole
   * number of times across the length, so neither the noise nor its swell has
   * a join for an ear to find going round.
   */
  private fun breath(): ShortArray {
    val seconds = 1.0
    val overlap = 0.25
    val pulses = 5
    val level = 0.075
    val length = (RATE * seconds).toInt()
    val lap = (RATE * overlap).toInt()
    val raw = DoubleArray(length + lap)

    // A band out of the middle: the top taken off, then the bottom, which
    // leaves air without rumble under it or hiss on top.
    var low = 0.0
    var floor = 0.0
    for (index in raw.indices) {
      val noise = Math.random() * 2.0 - 1.0
      low += 0.16 * (noise - low)
      floor += 0.012 * (low - floor)
      raw[index] = (low - floor) * 3.2
    }

    val out = ShortArray(length)
    for (index in 0 until length) {
      var value = raw[index]
      if (index < lap) {
        val fade = index.toDouble() / lap
        value = value * fade + raw[length + index] * (1.0 - fade)
      }
      // Beginning each turn at its quietest, so the loop also starts there.
      val swell = 0.45 + 0.55 * (0.5 - 0.5 * cos(2.0 * PI * pulses * index / length))
      val scaled = value * swell * level * 32767
      out[index] = when {
        scaled >= 32767 -> 32767
        scaled <= -32768 -> -32768
        else -> scaled.toInt().toShort()
      }
    }
    return out
  }

  private fun build(tone: ShortArray): AudioTrack =
    AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          // On the stream the record is on, not the one the phone silences:
          // the game is played with the music audible, and a response the ring
          // switch can turn off is a response that is sometimes missing.
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build()
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(RATE)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build()
      )
      .setBufferSizeInBytes(tone.size * 2)
      .setTransferMode(AudioTrack.MODE_STATIC)
      .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
      .build()
      .apply { write(tone, 0, tone.size) }
}
