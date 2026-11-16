package expo.modules.jukeboxaudio

import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.LoadControl

/**
 * How far ahead of what is heard a song on the phone is read.
 *
 * Media3 reads a file on the phone up to fifty seconds ahead, and by itself
 * starts reading again only once less than a second of it is left. What has
 * been read is not all heard at once: the phone's decoder, the effects and
 * the sound card each hold some of it, and on a Samsung that came to more
 * than a second. So the last second was never reached, the reading never
 * started again, and the song stood still a second short of where the
 * reading had stopped -- a minute in, every time it was played from there,
 * the bar going forward and back as [StallGuard] set it going again.
 *
 * Read again from half a minute ahead, there is always far more in hand than
 * all of them hold together.
 */
internal object Buffering {
  fun loadControl(): LoadControl =
    DefaultLoadControl.Builder()
      .setBufferDurationsMsForLocalPlayback(
        READ_AGAIN_BELOW_MS,
        READ_AHEAD_MS,
        DefaultLoadControl.DEFAULT_BUFFER_FOR_PLAYBACK_FOR_LOCAL_PLAYBACK_MS,
        DefaultLoadControl.DEFAULT_BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_FOR_LOCAL_PLAYBACK_MS,
      )
      .build()

  /** Reading starts again when less than this is left ahead. */
  const val READ_AGAIN_BELOW_MS = 30_000
  /** And goes on until this much is. */
  const val READ_AHEAD_MS = DefaultLoadControl.DEFAULT_MAX_BUFFER_FOR_LOCAL_PLAYBACK_MS
}
