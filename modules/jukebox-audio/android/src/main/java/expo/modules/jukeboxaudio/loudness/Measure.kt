package expo.modules.jukeboxaudio.loudness

import android.content.ContentResolver
import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.SystemClock
import android.provider.MediaStore
import android.util.Log
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.MetadataRetriever
import java.io.File
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit

/**
 * Finding out a file's gain: which file it is, what its tags say, and failing
 * that, how loud it actually is.
 *
 * All of it blocks and none of it belongs on the thread the player runs on,
 * which is the caller's business; see [Normaliser].
 */
internal object Measure {
  /** `adb logcat -s JukeboxLoudness` is the whole of this feature's diagnostics. */
  const val TAG = "JukeboxLoudness"

  /**
   * How much of a file is listened to.
   *
   * Every song there is fits inside this. What does not is a DJ set or an
   * audiobook, an hour or two in one file, and decoding all of that to learn
   * what its first twelve minutes already say is battery spent on a second
   * decimal place. The cost of stopping early is that the loudest sample in
   * the rest is not known -- so such a file is recorded as having no known
   * peak, which means it can be turned down but never up.
   */
  private const val MOST_SECONDS = 12 * 60

  /** Long enough to open a file on a slow card; nothing waits on it but the measuring. */
  private const val TAGS_WAIT_SECONDS = 8L

  /**
   * A name for the bytes behind [uri] that changes when they do.
   *
   * The media store's id alone will not do: the store is rebuilt from time to
   * time -- a card taken out and put back, a system update -- and the ids are
   * dealt out again, so that track 4127 is a different song afterwards and
   * would be played at the old one's gain. Size and the time it was last
   * written go with it. Those change when the file does, which is also what
   * is wanted when somebody runs a ReplayGain scanner over a library that was
   * measured here first: the rewritten file is a new name, and its new tags
   * are read.
   *
   * Null for anything that is not a file on this phone. A stream has no
   * loudness that can be known before it has been heard.
   */
  fun fingerprint(context: Context, uri: Uri): String? = runCatching {
    when (uri.scheme) {
      ContentResolver.SCHEME_CONTENT -> context.contentResolver.query(
        uri,
        arrayOf(MediaStore.MediaColumns.SIZE, MediaStore.MediaColumns.DATE_MODIFIED),
        null, null, null
      )?.use { row ->
        if (row.moveToFirst()) "$uri|${row.getLong(0)}|${row.getLong(1)}" else null
      }
      ContentResolver.SCHEME_FILE, null -> uri.path?.let(::File)?.takeIf { it.isFile }
        ?.let { "${it.path}|${it.length()}|${it.lastModified() / 1000}" }
      else -> null
    }
  }.getOrNull()

  /**
   * What the file's own tags say, or null where they say nothing.
   *
   * Asked of Media3 rather than parsed here: its extractors already read
   * every container the player can play, and the tags they find are the ones
   * [ReplayGainTags] knows the shape of. It opens the file on a thread of its
   * own and reads as far as the headers, which is milliseconds; the wait is
   * for the file that will not open, so that it is given up on rather than
   * sat behind.
   */
  @OptIn(UnstableApi::class)
  fun tags(context: Context, uri: Uri): FileGain? = runCatching {
    MetadataRetriever.Builder(context, MediaItem.fromUri(uri)).build().use { retriever ->
      val groups = retriever.retrieveTrackGroups().get(TAGS_WAIT_SECONDS, TimeUnit.SECONDS)
      val pairs = ArrayList<Pair<String, String>>()
      for (index in 0 until groups.length) {
        val group = groups.get(index)
        for (track in 0 until group.length) pairs += ReplayGainTags.pairs(group.getFormat(track).metadata)
      }
      ReplayGainTags.read(pairs)
    }
  }.getOrNull()

  /**
   * Decodes the file and measures it, or null if that could not be done or
   * [cancelled] said to stop.
   *
   * Through the platform's decoder, for every format alike. The chart maker's
   * in-process MP3 decoder is many times quicker, and is not used: it hands
   * back one channel at half the sample rate, which is what finding a beat
   * wants and not what this does. Two channels folded into one read anything
   * from nought to three decibels low depending on how alike they were, and
   * that is the size of the differences being corrected. A few seconds per
   * song, once per song, on a thread nothing is waiting for, is the better
   * trade; teaching the C decoder to keep its channels would win them back.
   *
   * The file is read through as it is decoded and never held: what the meter
   * keeps is ten numbers a second.
   */
  fun file(context: Context, uri: Uri, cancelled: () -> Boolean): FileGain? {
    val startedAt = SystemClock.elapsedRealtime()
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(context, uri, null)
      var format: MediaFormat? = null
      for (index in 0 until extractor.trackCount) {
        val here = extractor.getTrackFormat(index)
        if (here.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
          extractor.selectTrack(index)
          format = here
          break
        }
      }
      val mime = format?.getString(MediaFormat.KEY_MIME) ?: return null

      codec = MediaCodec.createDecoderByType(mime)
      codec.configure(format, null, null, 0)
      codec.start()

      val info = MediaCodec.BufferInfo()
      var meter: LoudnessMeter? = null
      var float = false
      var shorts = ShortArray(0)
      var floats = FloatArray(0)
      var fed = false
      var done = false
      var cut = false

      while (!done) {
        if (cancelled()) return null

        if (!fed) {
          val input = codec.dequeueInputBuffer(10_000)
          if (input >= 0) {
            val read = extractor.readSampleData(codec.getInputBuffer(input)!!, 0)
            if (read < 0) {
              codec.queueInputBuffer(input, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              fed = true
            } else {
              codec.queueInputBuffer(input, 0, read, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        val output = codec.dequeueOutputBuffer(info, 10_000)
        if (output < 0) continue

        /*
          The format is asked of the decoder and not of the file. A file can
          be wrong about itself -- HE-AAC famously says half its real sample
          rate -- and what matters to a filter is the rate of the samples
          actually arriving.
        */
        if (meter == null) {
          val out = codec.outputFormat
          meter = LoudnessMeter(
            out.getInteger(MediaFormat.KEY_SAMPLE_RATE),
            out.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          )
          float = out.containsKey(MediaFormat.KEY_PCM_ENCODING) &&
            out.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
        }

        val buffer = codec.getOutputBuffer(output)!!
        buffer.position(info.offset).limit(info.offset + info.size)
        buffer.order(ByteOrder.nativeOrder())
        if (float) {
          val view = buffer.asFloatBuffer()
          val count = view.remaining()
          if (floats.size < count) floats = FloatArray(count)
          view.get(floats, 0, count)
          meter.add(floats, count)
        } else {
          val view = buffer.asShortBuffer()
          val count = view.remaining()
          if (shorts.size < count) shorts = ShortArray(count)
          view.get(shorts, 0, count)
          meter.add(shorts, count)
        }
        codec.releaseOutputBuffer(output, false)

        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) done = true
        if (meter.frames >= meter.rate.toLong() * MOST_SECONDS) {
          cut = true
          done = true
        }
      }

      val measured = meter ?: return null
      /*
        A one-channel file comes out of both speakers, so it is heard as loud
        as a two-channel file with the same thing on each side -- which the
        standard reads three decibels higher than one channel alone. Measured
        as it will be played, not as it is stored.
      */
      val lufs = measured.loudness() + if (measured.channels == 1) 3.01 else 0.0
      // Silence all the way through has no loudness to correct. Remembered as
      // a gain of nothing, so that it is not decoded again to learn the same.
      val gain = if (lufs.isInfinite() || lufs.isNaN()) 0f else (REFERENCE_LUFS - lufs).toFloat()

      Log.i(
        TAG,
        "measured $uri: ${"%.1f".format(lufs)} LUFS, gain ${"%+.1f".format(gain)} dB, " +
          "peak ${"%.3f".format(measured.peak)}${if (cut) " (first $MOST_SECONDS s only)" else ""}, " +
          "${measured.frames / measured.rate} s of ${measured.rate} Hz x${measured.channels} " +
          "in ${SystemClock.elapsedRealtime() - startedAt} ms by ${codec.name}"
      )
      return FileGain(trackDb = gain, trackPeak = if (cut) null else measured.peak, measured = true)
    } catch (trouble: Exception) {
      // A file the phone cannot decode is a song left at its own level.
      Log.w(TAG, "could not measure $uri: $trouble")
      return null
    } finally {
      runCatching { codec?.stop() }
      runCatching { codec?.release() }
      runCatching { extractor.release() }
    }
  }
}
