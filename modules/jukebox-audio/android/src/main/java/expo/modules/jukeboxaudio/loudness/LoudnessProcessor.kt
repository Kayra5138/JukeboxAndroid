package expo.modules.jukeboxaudio.loudness

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import kotlin.math.roundToInt

/**
 * A gain that gets where it is going without a click.
 *
 * Multiplying a waveform by one number and then, from the next sample, by
 * another puts a step in it, and a step is a click. So a change of gain is
 * walked to over a number of frames, a straight line in amplitude: twenty
 * milliseconds of it is inaudible as a ramp and inaudible as a click, and
 * three seconds of it is how a level arrived at late is eased in.
 *
 * The arithmetic and nothing else -- no player, no settings -- so that the
 * tests can push buffers through it and look at what came out.
 */
class GainRamp {
  private var gain = 1f
  private var goal = 1f
  private var step = 0f
  private var left = 0

  /** Whether there is nothing to do, so the caller can copy and be done. */
  val idle: Boolean get() = left == 0 && gain == 1f

  /** Goes straight there. For the start of a stream, where there is nothing to click against. */
  fun snap(to: Float) {
    gain = to
    goal = to
    step = 0f
    left = 0
  }

  /**
   * Sets off for [to], arriving [frames] from now.
   *
   * Asked every buffer with wherever it should be heading, and deaf to being
   * told what it already knows: a ramp under way is not restarted by the
   * same answer, or a three second glide would never be allowed to finish.
   */
  fun head(to: Float, frames: Int) {
    if (to == goal) return
    goal = to
    left = frames.coerceAtLeast(1)
    step = (to - gain) / left
  }

  private fun next(): Float {
    if (left > 0) {
      gain += step
      // Landed on exactly, rather than wherever the additions drifted to.
      if (--left == 0) gain = goal
    }
    return gain
  }

  /** Sixteen-bit frames from [input] to [output], every channel of a frame alike. */
  fun apply16(input: ByteBuffer, output: ByteBuffer, channels: Int) {
    while (input.remaining() >= 2 * channels) {
      val now = next()
      for (channel in 0 until channels) {
        /*
          Held at full scale and not allowed to wrap. With the ceiling in
          [appliedDb] nothing should reach here that needs it -- but that
          ceiling trusts a peak somebody wrote in a tag, and a sample that
          wraps round is the loudest noise a sixteen-bit stream can make.
        */
        val scaled = (input.short * now).roundToInt().coerceIn(-32768, 32767)
        output.putShort(scaled.toShort())
      }
    }
  }

  /** The same for float samples, which have room above full scale and are left it. */
  fun applyFloat(input: ByteBuffer, output: ByteBuffer, channels: Int) {
    while (input.remaining() >= 4 * channels) {
      val now = next()
      for (channel in 0 until channels) output.putFloat(input.float * now)
    }
  }
}

/**
 * Turns each track up or down to the level they are all brought to.
 *
 * In the chain after Media3's own processors and before the equalizer, the
 * fader and the effects. Before the fader, because a fade is a shape laid
 * over the music and the level is part of the music. Before the effects, because that is
 * where the user's own preamp is: this evens the records out and the preamp
 * then moves all of them together, which is what somebody reaching for a
 * preamp expects of it. A preamp turned up can still clip, exactly as it
 * could before -- the effects processor holds the result at full scale -- and
 * the equalizer, which is the next stage after this one, makes its own room
 * for what its bands add; the room left here ([HEADROOM_DB]) is for the
 * record, not for what is piled on top of it.
 *
 * One of these per player, sharing nothing but the table of levels. Which
 * entry of that table is this player's is the business of [stream].
 */
@UnstableApi
class LoudnessProcessor(private val stream: PlayingStream) : BaseAudioProcessor() {
  /** A change that has to be made without a click, and no slower than that. */
  private val RAMP_MS = 20

  /** A level that turned up after its track had started; see [Loudness.Applied.late]. */
  private val GLIDE_MS = 3_000

  private val ramp = GainRamp()
  private var fresh = true
  private var playing: String? = null

  /**
   * Always in the pipeline, switched on or not.
   *
   * The pipeline decides what is active once, when it is configured, and a
   * processor that said it had nothing to do is not there to be switched on
   * when the setting changes mid-song. Off, this is a straight copy, which is
   * what the sink would have done with the buffer anyway.
   */
  override fun isActive(): Boolean = true

  /*
    Sixteen-bit is all this chain ever carries: float output is off, for the
    reasons at the top of FadingRenderersFactory, and the sink converts
    everything else down before the processors see it. Float is taken as well
    so that turning it back on one day does not start here with an exception.
  */
  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT && inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT) {
      throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    }
    return inputAudioFormat
  }

  /** After a flush the next sample follows nothing, so there is nothing to ramp from. */
  override fun onFlush() {
    fresh = true
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    if (!inputBuffer.hasRemaining()) return

    val id = stream.id
    val level = Loudness.level(id)
    /*
      A new track in an unbroken stream -- one song running into the next --
      changes gain on the join itself and all at once. Either the two are a
      record being played through, and the gain is the same on both sides, or
      they are two songs, and the join is already a discontinuity that a ramp
      across it would only smear the wrong gain over the first notes of.
    */
    if (fresh || id != playing) {
      ramp.snap(level.gain)
    } else {
      val milliseconds = if (level.late) GLIDE_MS else RAMP_MS
      ramp.head(level.gain, inputAudioFormat.sampleRate * milliseconds / 1000)
    }
    fresh = false
    playing = id

    val out = replaceOutputBuffer(inputBuffer.remaining())
    when {
      ramp.idle -> out.put(inputBuffer)
      inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT ->
        ramp.applyFloat(inputBuffer, out, inputAudioFormat.channelCount)
      else -> ramp.apply16(inputBuffer, out, inputAudioFormat.channelCount)
    }
    // Whatever is left is less than a frame, which a sink does not send.
    inputBuffer.position(inputBuffer.limit())
    out.flip()
  }
}
