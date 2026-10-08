package expo.modules.jukeboxaudio.loudness

import android.content.Context
import android.os.Handler
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.Timeline
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.AudioRendererEventListener
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.MediaCodecAudioRenderer
import androidx.media3.exoplayer.mediacodec.MediaCodecAdapter
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.source.MediaSource

/**
 * Which track the samples now reaching one player's processors belong to.
 *
 * The id of the queue entry, or null where it could not be found out. Written
 * by that player's renderer and read by that player's processor, both on its
 * playback thread; volatile all the same, because nothing promises that will
 * always be one thread.
 */
class PlayingStream(
  /**
   * What to answer while the renderer has not said, or could not.
   *
   * The crossfade's second player is opened on one track and never plays
   * another, so it is simply told which; the main player is given nothing,
   * and an unnamed stream there is taken to be whatever the player is on.
   */
  private val otherwise: String? = null
) {
  @Volatile private var named: String? = null

  var id: String?
    get() = named ?: otherwise
    set(value) {
      named = value
    }
}

/**
 * The stock audio renderer, saying whose samples it is handing on.
 *
 * An audio processor is given buffers and nothing else: it cannot tell where
 * one song ends and the next begins, and when a track runs straight into the
 * one after it there is no flush, no reconfiguration and no other sign. The
 * player does announce the change -- but to the main thread, and when the new
 * track is *heard*, which is after it has been through the processors and
 * sat in the audio track's buffer for some hundreds of milliseconds. A gain
 * changed on that announcement would land that far into the new song, having
 * played its opening at the last song's level.
 *
 * The renderer is the one thing that knows exactly, because it is what feeds
 * the sink: Media3 tells it the moment the last buffer of one stream has been
 * handed over and the next buffer will be from another. So this notes, as
 * each stream is taken up, which queue entry it is, and moves [stream] on at
 * the handover. It changes nothing about how audio is rendered.
 *
 * It follows the bookkeeping in `MediaCodecRenderer` step for step, which is
 * one more reason the Media3 version is pinned: there, the first stream after
 * the renderer is enabled takes effect at once, a later one waits in a queue
 * until the output of the one before it has all been processed, and a reset
 * of position jumps to the newest. If an upgrade changes that order the
 * failure is a gain applied a track early or late, not a crash.
 */
@UnstableApi
class NamingAudioRenderer(
  context: Context,
  codecAdapterFactory: MediaCodecAdapter.Factory,
  mediaCodecSelector: MediaCodecSelector,
  enableDecoderFallback: Boolean,
  eventHandler: Handler?,
  eventListener: AudioRendererEventListener?,
  audioSink: AudioSink,
  private val stream: PlayingStream
) : MediaCodecAudioRenderer(
  context, codecAdapterFactory, mediaCodecSelector, enableDecoderFallback, eventHandler, eventListener, audioSink
) {
  /** Streams being read ahead of, whose samples have not started coming out yet. */
  private val waiting = ArrayDeque<String?>()
  private var first = true

  override fun onEnabled(joining: Boolean, mayRenderStartOfStream: Boolean) {
    first = true
    waiting.clear()
    super.onEnabled(joining, mayRenderStartOfStream)
  }

  override fun onStreamChanged(
    formats: Array<Format>,
    startPositionUs: Long,
    offsetUs: Long,
    mediaPeriodId: MediaSource.MediaPeriodId
  ) {
    val id = named(mediaPeriodId)
    if (first) {
      first = false
      stream.id = id
    } else {
      waiting.addLast(id)
    }
    // May call onProcessedStreamChange itself, where nothing of the stream
    // before is still on its way out -- hence noting the id first.
    super.onStreamChanged(formats, startPositionUs, offsetUs, mediaPeriodId)
  }

  override fun onProcessedStreamChange() {
    // Empty for the very first stream on builds of Media3 that announce that
    // one too; it was named when it was taken up.
    if (waiting.isNotEmpty()) stream.id = waiting.removeFirst()
    super.onProcessedStreamChange()
  }

  override fun onPositionReset(positionUs: Long, joining: Boolean, sampleStreamIsResetToKeyFrame: Boolean) {
    if (waiting.isNotEmpty()) {
      stream.id = waiting.last()
      waiting.clear()
    }
    super.onPositionReset(positionUs, joining, sampleStreamIsResetToKeyFrame)
  }

  override fun onDisabled() {
    waiting.clear()
    first = true
    super.onDisabled()
  }

  /**
   * The queue entry a stream is part of.
   *
   * Media3 names a stream by its period, and the timeline says which window
   * -- which queue entry -- a period is in. Null where the timeline does not
   * know the period, which is taken downstream to mean "whatever the player
   * says it is on": right for everything but the instant of a gapless join.
   */
  private fun named(period: MediaSource.MediaPeriodId): String? = runCatching {
    val timeline = timeline
    val index = timeline.getIndexOfPeriod(period.periodUid)
    if (index == C.INDEX_UNSET) return null
    val window = timeline.getPeriod(index, Timeline.Period()).windowIndex
    timeline.getWindow(window, Timeline.Window()).mediaItem.mediaId.takeIf { it.isNotEmpty() }
  }.getOrNull()
}
