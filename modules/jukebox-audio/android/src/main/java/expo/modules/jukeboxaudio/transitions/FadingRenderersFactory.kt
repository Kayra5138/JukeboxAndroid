package expo.modules.jukeboxaudio.transitions

import android.content.Context
import android.os.Handler
import androidx.annotation.OptIn
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.AudioProcessorChain
import androidx.media3.common.audio.GainProcessor
import expo.modules.jukeboxaudio.effects.EffectsProcessor
import expo.modules.jukeboxaudio.equalizer.EqualizerProcessor
import expo.modules.jukeboxaudio.loudness.LoudnessProcessor
import expo.modules.jukeboxaudio.loudness.NamingAudioRenderer
import expo.modules.jukeboxaudio.loudness.PlayingStream
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.Renderer
import androidx.media3.exoplayer.audio.AudioRendererEventListener
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector

/**
 * A player whose output passes through a fader.
 *
 * [DefaultRenderersFactory.buildAudioSink] is the sanctioned way in: the sink
 * is built here instead of by the superclass, with a [GainProcessor] in its
 * chain. That puts the fade inside the audio pipeline, applied sample by
 * sample as the buffers are written, rather than in a timer turning
 * `player.volume` down twenty times a second — which is audibly stepped and
 * drifts against the audio clock.
 *
 * One consequence worth writing down: a sink with audio processors in it cannot
 * use the platform's offload path, where compressed audio is handed to the DSP
 * and the CPU sleeps. This app never enabled offload, so nothing is lost, but
 * turning it on later and wondering why it does nothing would start here.
 */
@OptIn(UnstableApi::class)
class FadingRenderersFactory(
  context: Context,
  private val fade: FadeGainProvider,
  /**
   * The one track this player will ever play, where that is known.
   *
   * The crossfade's second player says; the main one does not, and finds out
   * from its renderer as it goes. See [PlayingStream].
   */
  only: String? = null
) : DefaultRenderersFactory(context) {
  /**
   * Which track this player's samples belong to, shared between the renderer
   * that knows and the processor that needs to: the loudness of a track is
   * corrected by a gain of its own, and two players in a crossfade are on
   * two different tracks.
   */
  private val stream = PlayingStream(only)

  /*
    Float output is deliberately left off, and why is worth keeping.

    Turning it on looked free: a 24-bit source would keep its depth instead of
    being folded down to 16-bit integer, and `GainProcessor` takes float as
    happily as it takes shorts. But `DefaultAudioSink` does not put the
    processors anywhere near a float stream. It builds its pipeline one of two
    ways and only one of them includes them:

        if (shouldUseFloatOutput(...)) pipeline.add(toFloatPcm)
        else { pipeline.add(toInt16Pcm); pipeline.add(chain.getAudioProcessors()) }

    `getAudioProcessors` is called there and nowhere else in the class, and
    `shouldUseFloatOutput` is `enableFloatOutput && isEncodingHighResolutionPcm`
    — nothing to do with what the chain holds. So on a 24-bit file, and only on
    a 24-bit file, the fader was dropped out of the pipeline without a word. So
    were Sonic, which is what speed and pitch are, and the silence skipper.

    A fade that is not applied does not merely fail to fade. The crossfade
    works by opening a second player on the *same* track a splice behind the
    first and taking one down as the other comes up; with neither gain applied
    both run at full scale, and what comes out is two copies of the same audio
    a few hundred milliseconds apart, summed. That is a comb filter, and it
    sounds like one. It was the noise on hi-res FLACs, and it was nothing else.

    Eight bits of depth nobody can hear, against a crossfade and a speed
    control that both work, is not a trade worth making. Wanting float output
    back means making the fade stop being an AudioProcessor first.
  */

  override fun buildAudioSink(
    context: Context,
    enableFloatOutput: Boolean,
    enableAudioTrackPlaybackParams: Boolean
  ): AudioSink =
    DefaultAudioSink.Builder(context)
      .setEnableFloatOutput(enableFloatOutput)
      /*
        Speed and pitch are handed to the platform's AudioTrack rather than to
        Sonic, whatever the caller asked for, and that is a bug fix rather than
        a preference. See [FadeLastChain] for what Sonic does when it is not
        the first processor in the chain, which on this sink it can never be.
        Turning this on keeps Sonic inactive -- the parameters never leave one
        as far as the processor is concerned -- so it is not in the pipeline to
        be driven into that loop. AudioTrack has taken a speed and a pitch
        separately since well below our minimum SDK.
      */
      .setEnableAudioTrackPlaybackParams(true)
      .setAudioProcessorChain(
        FadeLastChain(LoudnessProcessor(stream), EqualizerProcessor(), GainProcessor(fade))
      )
      .build()

  /**
   * The stock audio renderer, in a subclass that says which track it is on.
   *
   * Built here rather than by the superclass for that one reason; see
   * [NamingAudioRenderer]. The superclass goes on from this to look for the
   * extension decoders -- FFmpeg, libopus and the rest -- and is not asked
   * to, because it only looks when extensions are switched on, which they
   * are not and, with none of them in the build, could not usefully be.
   */
  override fun buildAudioRenderers(
    context: Context,
    extensionRendererMode: Int,
    mediaCodecSelector: MediaCodecSelector,
    enableDecoderFallback: Boolean,
    audioSink: AudioSink,
    eventHandler: Handler,
    eventListener: AudioRendererEventListener,
    out: ArrayList<Renderer>
  ) {
    out.add(
      NamingAudioRenderer(
        context, codecAdapterFactory, mediaCodecSelector, enableDecoderFallback,
        eventHandler, eventListener, audioSink, stream
      )
    )
  }
}

/**
 * The stock chain with the fader on the end of it rather than the front.
 *
 * `setAudioProcessors` would be the short way in, but it puts what it is given
 * *before* Media3's own processors, and the fader must not come before Sonic.
 *
 * [AudioProcessingPipeline] ends a stream by walking the chain, and where a
 * processor has ended and been drained it tells the one after it that the
 * stream is over — on every pass of the loop, not once. `SonicAudioProcessor`
 * cannot be told that twice: each telling pads its input with silence to flush
 * the pitch buffer and then processes it, so being told repeatedly feeds it
 * silence faster than the sink can play the result out. Its output never
 * empties, the pipeline is never finished, the track never ends, and the
 * playback thread spends the rest of the process's life inside Sonic at a
 * hundred percent of a core. No exception, no error — just a player buffering
 * at nought forever, which preparing again cannot clear, because preparing
 * does not interrupt the thread that is stuck.
 *
 * Moving the fader to the end does not on its own put Sonic first, and cannot:
 * the sink builds its pipeline with a resampler, a channel mapper and the
 * gapless trimmer ahead of whatever the chain returns, and any of those being
 * active is enough. That is why the speed and the pitch are given to the
 * AudioTrack instead, above — with Sonic left at one it is never active, and an
 * inactive processor is not in the pipeline to be driven anywhere.
 *
 * The fader stays on the end regardless, because it is the honest place for it:
 * it takes the repeated telling in Sonic's stead, which for a plain
 * [androidx.media3.common.audio.BaseAudioProcessor] is a flag being set to the
 * value it already had, and a fade applied after any stretching is measured in
 * what the listener hears rather than in source time.
 */
@OptIn(UnstableApi::class)
private class FadeLastChain(
  private val loudness: AudioProcessor,
  private val equalizer: AudioProcessor,
  private val fade: AudioProcessor
) : AudioProcessorChain {
  private val stock = DefaultAudioSink.DefaultAudioProcessorChain()

  /*
    The fader, then the effects, both after everything Media3 brought. The
    order between those two barely matters — a gain and a stereo treatment
    commute closely enough — but being last is what matters for the pair of
    them, and the effects processor is the one that takes the repeated
    end-of-stream telling on the chain's behalf.

    The loudness correction goes in front of both: it is the record's level
    being put right, and the fade and the preamp are things done to the
    record afterwards. Like them it is a plain processor that never ends
    early, so it changes nothing about who is told what when a stream does.

    The equalizer goes between the loudness correction and the fader, and
    each side of that is a choice.

    After the loudness correction, because of headroom. That stage turns a
    quiet record up to within a decibel of full scale and no further; the
    equalizer then comes with a preamp of its own that takes off whatever its
    bands add. In that order each stage hands on something that fits in
    sixteen bits, which between stages is all there is. The other way round,
    the record's level would be corrected after the equalizer's preamp had
    already turned it down and rounded it, and the correction would turn the
    rounding up with the music.

    Before the fader, because the tone is part of what is being faded. A
    filter remembers what went through it, and one placed after the fader
    would still be ringing with the music when the fader had reached silence
    -- a tail under a pause, and under the end of a crossfade.

    And before the effects, where the user's preamp and the last clip are:
    the equalizer corrects the headphones, and the width, the balance and
    that preamp are then what is done with the corrected sound. The effects
    processor is still the last thing in the chain, which is what the chain
    needs of it.
  */
  override fun getAudioProcessors(): Array<AudioProcessor> =
    stock.audioProcessors + loudness + equalizer + fade + EffectsProcessor()

  override fun applyPlaybackParameters(parameters: PlaybackParameters): PlaybackParameters =
    stock.applyPlaybackParameters(parameters)

  override fun applySkipSilenceEnabled(skipSilenceEnabled: Boolean): Boolean =
    stock.applySkipSilenceEnabled(skipSilenceEnabled)

  override fun getMediaDuration(playoutDuration: Long): Long = stock.getMediaDuration(playoutDuration)

  override fun getSkippedOutputFrameCount(): Long = stock.skippedOutputFrameCount
}
