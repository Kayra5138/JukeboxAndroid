package expo.modules.jukeboxaudio.equalizer

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import kotlin.math.abs
import kotlin.math.pow

/**
 * One curve's filters, one after another, with what each remembers.
 *
 * A filter of this kind has memory: every output is made from the last two
 * samples in and the last two out. That memory is kept per channel -- two
 * ears taking turns over one filter would each hear the other a sample late
 * -- and in double precision, because a narrow band low down is a filter
 * whose poles sit so close to the edge of stability that the rounding of a
 * float is a noise floor of its own.
 *
 * Kept in the plain form, where what is remembered is the signal itself --
 * the samples that went in and the ones that came out -- rather than the
 * form that keeps two numbers mixed from both. It costs two more numbers a
 * filter and buys this: a memory that means the same thing whatever the
 * coefficients are, so a filter whose band has just been moved can pick up
 * from where the old one was. See [adopt].
 */
internal class Chain(curve: Parametric.Curve, rate: Int, private val channels: Int) {
  /** The preamp as a multiplier. */
  val gain: Double

  /** Five coefficients a filter, end to end; see [Response.section]. */
  private val coefficients: DoubleArray

  /** Which band of the curve each filter was made from, and what kind it was. */
  private val origin: IntArray
  private val kinds: Array<Parametric.Type>

  /** x1, x2, y1, y2 for each filter and channel. */
  private val memory: DoubleArray

  private val count: Int

  /** Whether samples come out exactly as they went in. */
  val identity: Boolean

  init {
    val made = ArrayList<DoubleArray>()
    val from = ArrayList<Int>()
    if (!curve.idle) {
      curve.bands.take(Parametric.MAX_BANDS).forEachIndexed { index, band ->
        Response.section(band, rate)?.let {
          made.add(it)
          from.add(index)
        }
      }
    }
    count = made.size
    coefficients = DoubleArray(count * 5) { made[it / 5][it % 5] }
    origin = IntArray(count) { from[it] }
    kinds = Array(count) { curve.bands[from[it]].type }
    memory = DoubleArray(count * channels * 4)

    val preampDb = when {
      curve.idle -> 0.0
      else -> (curve.preampDb ?: Response.autoPreampDb(curve.bands, rate))
        .coerceIn(Parametric.MIN_PREAMP_DB, Parametric.MAX_PREAMP_DB)
    }
    gain = if (preampDb == 0.0) 1.0 else 10.0.pow(preampDb / 20.0)
    identity = count == 0 && gain == 1.0
  }

  /**
   * Starts from what [other] remembers, wherever the two have the same band.
   *
   * A filter started from nothing takes a while to arrive -- a narrow band at
   * thirty hertz, a tenth of a second and more -- and one restarted on every
   * step of a slider being dragged would never arrive at all: the bass being
   * turned up would drop out for as long as the finger was moving. Handed the
   * old filter's memory it is already most of the way there.
   *
   * Only where the band is the same one and the same kind. Anything else --
   * a band added, a peak turned into a shelf -- starts clean.
   */
  fun adopt(other: Chain) {
    if (other.channels != channels) return
    for (mine in 0 until count) {
      for (theirs in 0 until other.count) {
        if (other.origin[theirs] != origin[mine] || other.kinds[theirs] != kinds[mine]) continue
        System.arraycopy(other.memory, theirs * channels * 4, memory, mine * channels * 4, channels * 4)
        break
      }
    }
  }

  /** One sample of one channel through every filter, and the preamp. */
  fun step(channel: Int, input: Double): Double {
    var value = input
    var at = 0
    var kept = channel * 4
    for (index in 0 until count) {
      val x1 = memory[kept]
      val x2 = memory[kept + 1]
      val y1 = memory[kept + 2]
      val y2 = memory[kept + 3]
      val out = coefficients[at] * value + coefficients[at + 1] * x1 + coefficients[at + 2] * x2 -
        coefficients[at + 3] * y1 - coefficients[at + 4] * y2
      memory[kept] = value
      memory[kept + 1] = x1
      memory[kept + 2] = out
      memory[kept + 3] = y1
      value = out
      at += 5
      kept += channels * 4
    }
    return value * gain
  }

  /**
   * Tidies the memory between buffers.
   *
   * Two things can go wrong with numbers that feed back into themselves. A
   * filter ringing down after the music stops never quite reaches nought, and
   * the vanishingly small numbers it passes through on the way are ones some
   * processors do sums on a hundred times more slowly; so anything too small
   * to be sound is called silence. And one sample that is not a number -- a
   * decoder can hand a float stream one -- would be remembered and fed back
   * for ever, every output after it not a number either; so a memory that has
   * stopped being finite is thrown away, and the worst of it is one buffer.
   *
   * Once a buffer rather than once a sample: neither gets far in a buffer's
   * length, and a test on every sample is paid for by every sample.
   */
  fun settle() {
    var broken = false
    for (index in memory.indices) {
      val value = memory[index]
      if (!value.isFinite()) broken = true
      else if (value != 0.0 && abs(value) < SILENCE) memory[index] = 0.0
    }
    if (broken) memory.fill(0.0)
  }

  private companion object {
    /**
     * Three hundred decibels under a single count of a sixteen-bit sample, and
     * as far under full scale in a float one.
     */
    const val SILENCE = 1e-15
  }
}

/**
 * The equalizer, as a stage of the player's audio chain.
 *
 * After the loudness correction and before the fader and the effects; why
 * there is said where the chain is put together, in FadingRenderersFactory.
 * One of these per player, like every stage: the second player of a
 * crossfade has its own, with its own memory of its own track, and both read
 * the one curve in [Parametric].
 *
 * A change of curve is never made between one sample and the next. The
 * filters of the new curve are run alongside the old ones for a fiftieth of
 * a second and the output is walked from the one to the other, which is a
 * crossfade between two versions of the same music and is heard as the tone
 * changing rather than as a click. That one mechanism is every kind of
 * change: a band dragged, a preset chosen, the preamp moved, the whole thing
 * switched on or off -- off is only a curve with no filters in it.
 */
@UnstableApi
class EqualizerProcessor : BaseAudioProcessor() {
  /**
   * Always in the pipeline, switched on or not.
   *
   * It would be tidier to step out of the chain altogether while there is
   * nothing to do, and Media3 has a way to say so. But the pipeline asks who
   * is active when it is configured and when it is flushed, not while it
   * runs, and a stage that had stepped out would not be there to hear the
   * switch being turned on in the middle of a song. So it stays, as the
   * loudness stage and the effects do, and with nothing to do it hands the
   * buffer on byte for byte -- which is the copy the sink would have made
   * anyway.
   */
  override fun isActive(): Boolean = true

  /*
    Sixteen-bit is all this chain carries today; float is taken as well so
    that turning float output back on does not start here with an exception.
    See the top of FadingRenderersFactory for why it is off.
  */
  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT && inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT) {
      throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    }
    return inputAudioFormat
  }

  /** The curve the filters in [chain] were made from, or are being walked to. */
  private var applied: Parametric.Curve? = null
  private var chain: Chain? = null

  /** The filters of a curve that is on its way in, and how far in it is. */
  private var incoming: Chain? = null
  private var fadeFrames = 0
  private var fadeDone = 0

  /**
   * After a flush -- a seek, a new format, a player starting -- the next
   * sample follows nothing.
   *
   * So the filters are made again from nothing: for whatever rate the stream
   * now has, since a filter's coefficients are only right for one, and with
   * empty memories, since what they remembered was the music before the
   * seek and would ring on into the music after it. And whatever curve is
   * current is simply in force, with no walk towards it: there is nothing on
   * the other side of a flush to click against.
   */
  override fun onFlush() {
    applied = null
    chain = null
    incoming = null
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    if (!inputBuffer.hasRemaining()) return

    val rate = inputAudioFormat.sampleRate
    val channels = inputAudioFormat.channelCount
    val float = inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT
    val wanted = Parametric.curve()

    var now = chain
    if (now == null) {
      now = Chain(wanted, rate, channels)
      chain = now
      applied = wanted
    } else if (incoming == null && wanted != applied) {
      /*
        Compared by what it says, not by which object it is: the settings are
        sent whole, so a drag of the bass slider publishes this same curve
        twenty-five times a second, and none of those is a change.

        And only looked at when no walk is under way. One arriving during a
        walk waits for the end of it and is then walked to in its turn, so a
        fast drag is a string of short crossfades, each from where the last
        one landed, and the newest setting is always the one arrived at.
      */
      incoming = Chain(wanted, rate, channels).also { it.adopt(now) }
      fadeFrames = (rate * FADE_MS / 1000).coerceAtLeast(1)
      fadeDone = 0
      applied = wanted
    }

    val out = replaceOutputBuffer(inputBuffer.remaining())
    if (incoming == null && now.identity) {
      out.put(inputBuffer)
      out.flip()
      return
    }

    val bytesPerFrame = inputAudioFormat.bytesPerFrame
    while (inputBuffer.remaining() >= bytesPerFrame) {
      val next = incoming
      // How much of the new curve is in this frame, the same for every channel.
      val share = if (next != null) (fadeDone + 1).toDouble() / fadeFrames else 0.0

      for (channel in 0 until channels) {
        val sample = if (float) inputBuffer.float.toDouble() else inputBuffer.short.toDouble()
        var value = now!!.step(channel, sample)
        if (next != null) value += (next.step(channel, sample) - value) * share

        if (float) {
          // Float has room above full scale and is left it, as the loudness
          // stage leaves it: what clips a float stream is the sink, once.
          out.putFloat(value.toFloat())
        } else {
          /*
            Held at full scale and not allowed to wrap. The automatic preamp
            keeps a steady tone under it; music is not a steady tone, and a
            preamp somebody set by hand can be anything. A sample that wraps
            round is the loudest noise a sixteen-bit stream can make.
          */
          out.putShort(Math.rint(value).coerceIn(-32768.0, 32767.0).toInt().toShort())
        }
      }

      if (next != null && ++fadeDone >= fadeFrames) {
        now = next
        chain = next
        incoming = null
      }
    }

    now!!.settle()
    incoming?.settle()

    // Whatever is left is less than a frame, which a sink does not send.
    inputBuffer.position(inputBuffer.limit())
    out.flip()
  }

  private companion object {
    /**
     * How long one curve takes to give way to another.
     *
     * Long enough that the join has no edge to it, short enough that a
     * slider still feels connected to what is coming out of the speaker: the
     * screen sends a drag every forty milliseconds, and each of those has
     * landed before the next one arrives.
     */
    const val FADE_MS = 20
  }
}
