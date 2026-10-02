package expo.modules.jukeboxaudio.effects

import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * One processor for every effect, on the end of the chain.
 *
 * One rather than several, and last rather than anywhere else, and both for
 * the same reason. [androidx.media3.common.audio.AudioProcessingPipeline]
 * tells whichever processor follows a finished one that the stream has ended
 * — on every pass of its drain loop, not once — and Sonic answers that by
 * padding its input with silence. Put anything in front of Sonic and it is fed
 * silence faster than the sink can play the result out, and the playback
 * thread never comes back. On the end, this processor takes that repeated
 * telling itself, and [BaseAudioProcessor] answers it by setting a flag it
 * already holds.
 *
 * Everything here is a handful of multiplies per frame, which is why it is
 * worth having them share one pass over the buffer.
 */
@UnstableApi
class EffectsProcessor : BaseAudioProcessor() {
  /**
   * Always in the pipeline, even with every effect off.
   *
   * The pipeline decides what is active once, when it is configured, and a
   * processor that said it had nothing to do is not there to be switched on
   * later. So this one is always there and does a straight copy when there is
   * nothing to do — which is the same work the sink would have done anyway.
   */
  override fun isActive(): Boolean = true

  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != androidx.media3.common.C.ENCODING_PCM_16BIT) {
      throw AudioProcessor.UnhandledAudioFormatException(inputAudioFormat)
    }
    return inputAudioFormat
  }

  /*
    The delay either ear's copy of the other reaches it by, and how dull it
    arrives. A head is about two thirds of a millisecond across and shadows
    everything above a few hundred hertz, which is what these two numbers are.
  */
  private var crossDelay = 0
  private var crossLeft = FloatArray(0)
  private var crossRight = FloatArray(0)
  private var crossAt = 0
  private var duckedLeft = 0f
  private var duckedRight = 0f

  /*
    One chain per ear, never one shared between them.

    Three of the four voices have memory — a delay line, a held sample, a
    filter's last output — and two channels taking turns over one line would
    hear each other's sound a sample late. Two copies cost two lines and keep
    the stereo image; see [VoiceChain]. Always two of them, even for a mono
    stream, so that nothing in [queueInput] can index past the end of the
    array whatever the format turns out to be.

    Built here and not in [queueInput], which is the whole point: everything a
    voice remembers has to carry over a buffer boundary, and a chain rebuilt
    per buffer would put a click on every one of them.
  */
  private val voices = Array(2) { VoiceChain(0) }
  private var voiceNow = Effects.OFF

  override fun onFlush() {
    val rate = inputAudioFormat.sampleRate
    crossDelay = ((rate * 0.00027f).toInt()).coerceAtLeast(1)
    crossLeft = FloatArray(crossDelay)
    crossRight = FloatArray(crossDelay)
    crossAt = 0
    duckedLeft = 0f
    duckedRight = 0f
    for (index in voices.indices) voices[index] = VoiceChain(rate)
    voiceNow = Effects.OFF
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    val frames = inputBuffer.remaining() / inputAudioFormat.bytesPerFrame
    if (frames == 0) return

    val out = replaceOutputBuffer(inputBuffer.remaining())
    val settings = Effects.settings()
    val channels = inputAudioFormat.channelCount

    /*
      A change of voice starts the new one from nothing. Checked before the
      quiet path below, so that switching everything off and a voice back on
      again is still a fresh start: a delay line left full of the last
      treatment's sound would be heard playing out from under the new one.
    */
    if (settings.voice != voiceNow) {
      voiceNow = settings.voice
      for (chain in voices) chain.reset()
    }

    if (settings.idle || channels !in 1..2) {
      out.put(inputBuffer)
      out.flip()
      return
    }

    val gain = if (settings.preampDb == 0f) 1f else dbToGain(settings.preampDb)
    val rate = inputAudioFormat.sampleRate.toFloat()
    val voice = VoiceKind.of(settings.voice)
    val voiceMix = settings.voiceMix

    /*
      The swing is read off the clock rather than counted in frames.

      A frame count is reset by every flush — a seek, a change of speed, a new
      track — and a rotation that jumps back to its beginning on each of those
      is heard as the image lurching. The clock does not care, and both
      players in a crossfade arrive at the same angle from it without having
      to share anything.
    */
    val turn = if (settings.rotate > 0f) {
      val period = settings.rotateSeconds.coerceAtLeast(1f)
      ((System.nanoTime() / 1_000_000L) % (period * 1000).toLong()) / (period * 1000.0)
    } else 0.0
    val swingStep = if (settings.rotate > 0f) 1.0 / (settings.rotateSeconds * rate) else 0.0
    var swing = turn

    var leftGain = 1f
    var rightGain = 1f
    if (settings.balance != 0f) {
      // Only ever turning one side down: turning the other up is the same
      // move with clipping at the end of it.
      if (settings.balance > 0f) leftGain = 1f - settings.balance
      else rightGain = 1f + settings.balance
    }

    for (frame in 0 until frames) {
      var left: Float
      var right: Float

      if (channels == 2) {
        left = inputBuffer.short / 32768f
        right = inputBuffer.short / 32768f

        if (voice != VoiceKind.NONE) {
          /*
            First, before anything else touches the sound, so that the voice
            hears the record rather than the treatment — and each ear through
            its own chain, so what was on one side of the mix stays there.
            Both chains are stepped once a frame from the same starting point,
            so their carriers and sweeps agree and the image does not wander.
          */
          left = voices[0].step(voice, left, voiceMix)
          right = voices[1].step(voice, right, voiceMix)
        }

        if (settings.swap) {
          val held = left
          left = right
          right = held
        }

        if (settings.width != 1f) {
          // Mid and side: the part both ears share and the part they differ
          // by. Scaling only the difference is what widens or folds an image
          // without touching what is in the middle of it.
          val mid = (left + right) * 0.5f
          val side = (left - right) * 0.5f * settings.width
          left = mid + side
          right = mid - side
        }

        if (settings.crossfeed > 0f) {
          val level = settings.crossfeed * 0.5f
          val fromRight = crossRight[crossAt]
          val fromLeft = crossLeft[crossAt]
          crossLeft[crossAt] = left
          crossRight[crossAt] = right
          crossAt = (crossAt + 1) % crossDelay

          // One pole of lag apiece, which is the head getting in the way.
          duckedRight += (fromRight - duckedRight) * 0.35f
          duckedLeft += (fromLeft - duckedLeft) * 0.35f

          val evenOut = 1f / (1f + level)
          left = (left + duckedRight * level) * evenOut
          right = (right + duckedLeft * level) * evenOut
        }

        if (settings.rotate > 0f) {
          // Equal power, so the sound does not sag as it passes the middle:
          // two halves at half amplitude are not half as loud together.
          val pan = sin(swing * 2.0 * PI).toFloat() * settings.rotate
          val angle = (PI / 4.0) * (1.0 + pan)
          left *= cos(angle).toFloat() * 1.414f
          right *= sin(angle).toFloat() * 1.414f
          swing += swingStep
        }

        left *= gain * leftGain
        right *= gain * rightGain
        out.putShort(clip(left))
        out.putShort(clip(right))
      } else {
        left = inputBuffer.short / 32768f
        if (voice != VoiceKind.NONE) left = voices[0].step(voice, left, voiceMix)
        out.putShort(clip(left * gain))
      }
    }

    out.flip()
  }

  private fun clip(value: Float): Short {
    val scaled = value * 32768f
    return when {
      scaled >= 32767f -> 32767
      scaled <= -32768f -> -32768
      else -> scaled.toInt().toShort()
    }
  }

  private fun dbToGain(db: Float): Float = Math.pow(10.0, db / 20.0).toFloat()
}
