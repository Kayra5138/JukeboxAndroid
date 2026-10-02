package expo.modules.jukeboxaudio.game

import android.content.ContentUris
import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.provider.MediaStore
import java.nio.ByteOrder

/**
 * A song, as numbers.
 *
 * The analysis needs the sound itself, and everything else in the app deals in
 * files and players. This is the one place that turns one into the other.
 *
 * Mono, because every question the chart maker asks is about when something
 * happened rather than about where it was; and downsampled, because an onset is
 * a thing that takes milliseconds and nothing above a few kilohertz helps to
 * find one. Both make the analysis several times quicker on a phone, which
 * matters when it runs over a whole track.
 */
internal object Decode {
  /**
   * What the analysis is given, whatever the recording happened to be.
   *
   * Low enough to be quick, high enough to leave the top lane something to
   * hear: the highest band the chart divides at is 3 kHz, and this keeps
   * everything up to eleven.
   */
  const val RATE = 22_050

  /** Longer than any song, and a guard against a file that never ends. */
  private const val MOST_SECONDS = 15 * 60

  /**
   * [by] is which decoder made it, for the one line in the log that says how
   * long a chart took -- a figure that means nothing without knowing which of
   * two very differently priced routes it was measured on.
   */
  class Song(val samples: FloatArray, val rate: Int, val durationMs: Long, val by: String)

  /**
   * The largest file handed to the decoder in this process.
   *
   * It is read into memory whole, and what comes out is held beside it, so
   * there has to be a line somewhere. This is past any song -- a quarter of an
   * hour at the highest bitrate MP3 has is thirty-six megabytes -- and short of
   * the point where a phone with little memory to spare would notice. Anything
   * bigger goes the old way, which streams.
   */
  private const val MOST_BYTES = 48L * 1024 * 1024

  /**
   * Somewhere to put the samples as they arrive.
   *
   * It was an `ArrayList<Float>`, which is the one thing it must not be: every
   * sample became a boxed `java.lang.Float` on the heap, so a two and a half
   * minute song cost three and a half million objects to decode and another
   * three and a half million unboxings to read back out. The list was also
   * sized for sixty seconds, so anything longer was copied wholesale each time
   * it doubled.
   *
   * None of that was the codec's fault, which is why it was worth finding:
   * decoding is ninety per cent of the time it takes to chart a song, and a
   * good deal of that ninety was this.
   */
  private class Samples(expected: Int) {
    private var values = FloatArray(expected.coerceIn(RATE, RATE * MOST_SECONDS))
    var size = 0
      private set

    fun add(value: Float) {
      if (size == values.size) values = values.copyOf(values.size * 2)
      values[size++] = value
    }

    /**
     * The samples, and no more than that.
     *
     * A copy rather than the buffer itself, because the buffer is as long as
     * the last doubling made it and the analysis would otherwise read up to
     * twice the song in silence -- which is not a crash, just a chart with a
     * long empty tail nobody ordered.
     */
    fun taken(): FloatArray = values.copyOf(size)
  }

  /**
   * How many samples the track says it will produce.
   *
   * A hint, not a contract: a container can be wrong or silent about its own
   * length, so the buffer still grows if it has to. Getting it right merely
   * means it usually does not have to.
   */
  private fun expected(format: MediaFormat): Int {
    if (!format.containsKey(MediaFormat.KEY_DURATION)) return RATE * 60
    val micros = format.getLong(MediaFormat.KEY_DURATION)
    if (micros <= 0) return RATE * 60
    // A second of slack, so a track that reports itself a hair short does not
    // double its whole buffer to hold the last few hundred samples.
    return ((micros / 1_000_000.0) * RATE).toInt() + RATE
  }

  /**
   * Decodes [trackId] from the media store.
   *
   * By one of two routes. An MP3 is decoded in this process, which takes a
   * fifth of a second for a four-minute song. Anything else goes through the
   * platform's decoder, which can read every format the phone can play and
   * takes several seconds to do it, because each frame is a round trip to
   * another process.
   *
   * Either way it is synchronous and blocking, and belongs on a background
   * thread, which is the caller's business rather than this object's.
   */
  fun song(context: Context, trackId: String): Song? {
    val id = trackId.toLongOrNull() ?: return null
    val uri = ContentUris.withAppendedId(
      MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), id
    )

    inProcess(context, uri)?.let { return it }

    val extractor = MediaExtractor()
    return try {
      extractor.setDataSource(context, uri, null)

      var track = -1
      var format: MediaFormat? = null
      for (index in 0 until extractor.trackCount) {
        val here = extractor.getTrackFormat(index)
        if (here.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
          track = index
          format = here
          break
        }
      }
      if (track < 0 || format == null) return null

      extractor.selectTrack(track)
      decode(extractor, format)
    } catch (_: Exception) {
      // A file the phone cannot open is a song without a chart, not a crash.
      null
    } finally {
      runCatching { extractor.release() }
    }
  }

  /**
   * An MP3, decoded here rather than by the platform, or null to say the
   * platform should be asked after all.
   *
   * Null is never a failure the caller sees: not an MP3, too large, a file the
   * decoder cannot make sense of, the library missing from this build, memory
   * running out half way -- every one of them ends in the slower route that
   * was the only route before, and a chart either way.
   */
  private fun inProcess(context: Context, uri: android.net.Uri): Song? {
    if (!Mp3.ready) return null
    return try {
      val resolver = context.contentResolver
      // The media store's word for it, which costs a lookup and not a read.
      if (resolver.getType(uri) != "audio/mpeg") return null
      val size = resolver.openFileDescriptor(uri, "r")?.use { it.statSize } ?: return null
      if (size <= 0 || size > MOST_BYTES) return null

      val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
      val all = Mp3.decode(bytes, RATE) ?: return null
      // The same guard the other route has against a file that never ends.
      val most = RATE * MOST_SECONDS
      val samples = if (all.size > most) all.copyOf(most) else all
      Song(
        samples = samples,
        rate = RATE,
        durationMs = samples.size.toLong() * 1000 / RATE,
        by = "minimp3"
      )
    } catch (_: Throwable) {
      // Throwable and not Exception: running out of memory is one of the
      // things that can happen here, and it is not an Exception.
      null
    }
  }

  private fun decode(extractor: MediaExtractor, format: MediaFormat): Song? {
    val mime = format.getString(MediaFormat.KEY_MIME) ?: return null
    val codec = MediaCodec.createDecoderByType(mime)
    val out = Samples(expected(format))

    return try {
      codec.configure(format, null, null, 0)
      codec.start()

      val info = MediaCodec.BufferInfo()
      var sourceRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      // Fractional, and carried between buffers: rounding it down per buffer
      // would drop a sample every few thousand and slide the whole chart
      // gradually later, which is exactly the fault a player would blame on
      // their own timing rather than on the chart.
      var carry = 0.0
      val step = sourceRate.toDouble() / RATE

      var done = false
      var fed = false
      while (!done && out.size < RATE * MOST_SECONDS) {
        if (!fed) {
          val input = codec.dequeueInputBuffer(10_000)
          if (input >= 0) {
            val buffer = codec.getInputBuffer(input)!!
            val read = extractor.readSampleData(buffer, 0)
            if (read < 0) {
              codec.queueInputBuffer(input, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              fed = true
            } else {
              codec.queueInputBuffer(input, 0, read, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        when (val output = codec.dequeueOutputBuffer(info, 10_000)) {
          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val now = codec.outputFormat
            sourceRate = now.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            channels = now.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          }
          MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
          else -> if (output >= 0) {
            val buffer = codec.getOutputBuffer(output)!!
            buffer.order(ByteOrder.nativeOrder())
            val shorts = buffer.asShortBuffer()
            val frames = shorts.remaining() / channels.coerceAtLeast(1)

            val every = sourceRate.toDouble() / RATE
            var at = carry
            var frame = 0
            val mono = FloatArray(frames)
            while (frame < frames) {
              var sum = 0f
              for (channel in 0 until channels) sum += shorts.get() / 32768f
              mono[frame] = sum / channels
              frame++
            }
            while (at < frames) {
              out.add(mono[at.toInt()])
              at += every
            }
            carry = at - frames

            codec.releaseOutputBuffer(output, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) done = true
          }
        }
      }

      if (out.size == 0) null
      else Song(
        samples = out.taken(),
        rate = RATE,
        durationMs = out.size.toLong() * 1000 / RATE,
        by = codec.name
      )
    } catch (_: Exception) {
      null
    } finally {
      runCatching { codec.stop() }
      runCatching { codec.release() }
    }
  }
}
