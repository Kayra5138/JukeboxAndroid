package expo.modules.jukeboxaudio.effects

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Just enough WAV to get a passage in and a rendering back out.
 *
 * Test-only, and deliberately not a general reader: it handles the one shape
 * ffmpeg writes when asked for 16-bit PCM, and says so plainly when handed
 * anything else rather than quietly returning noise.
 */
internal object Wav {
  class Audio(val rate: Int, val channels: Int, val samples: FloatArray) {
    /** Interleaved frames, so a stereo file of n frames has 2n samples. */
    val frames: Int get() = samples.size / channels

    /** One channel's worth, which is what a vocoder wants to be shown. */
    fun mono(): FloatArray =
      if (channels == 1) samples
      else FloatArray(frames) { frame ->
        var sum = 0f
        for (c in 0 until channels) sum += samples[frame * channels + c]
        sum / channels
      }
  }

  fun read(file: File): Audio {
    val bytes = ByteBuffer.wrap(file.readBytes()).order(ByteOrder.LITTLE_ENDIAN)
    require(bytes.limit() > 44) { "${file.name} is too short to be a wav." }
    require(tag(bytes, 0) == "RIFF" && tag(bytes, 8) == "WAVE") { "${file.name} is not a wav." }

    var at = 12
    var rate = 0
    var channels = 0
    var bits = 0
    var dataAt = -1
    var dataLength = 0

    // Walk the chunks rather than assuming the layout: ffmpeg writes a LIST
    // chunk of its own before the data, and a reader that assumed 44 bytes of
    // header would start decoding the words "Lavf" as audio.
    while (at + 8 <= bytes.limit()) {
      val name = tag(bytes, at)
      val length = bytes.getInt(at + 4)
      when (name) {
        "fmt " -> {
          channels = bytes.getShort(at + 10).toInt()
          rate = bytes.getInt(at + 12)
          bits = bytes.getShort(at + 22).toInt()
        }
        "data" -> {
          dataAt = at + 8
          dataLength = length
        }
      }
      if (dataAt >= 0) break
      at += 8 + length + (length and 1)
    }

    require(dataAt >= 0) { "${file.name} has no data chunk." }
    require(bits == 16) { "${file.name} is $bits-bit; this reader only does 16." }

    val count = minOf(dataLength, bytes.limit() - dataAt) / 2
    val samples = FloatArray(count) { bytes.getShort(dataAt + it * 2) / 32768f }
    return Audio(rate, channels, samples)
  }

  fun write(file: File, audio: Audio) {
    val dataLength = audio.samples.size * 2
    val out = ByteBuffer.allocate(44 + dataLength).order(ByteOrder.LITTLE_ENDIAN)
    out.put("RIFF".toByteArray()).putInt(36 + dataLength).put("WAVE".toByteArray())
    out.put("fmt ".toByteArray()).putInt(16)
      .putShort(1).putShort(audio.channels.toShort())
      .putInt(audio.rate).putInt(audio.rate * audio.channels * 2)
      .putShort((audio.channels * 2).toShort()).putShort(16)
    out.put("data".toByteArray()).putInt(dataLength)
    for (sample in audio.samples) {
      val scaled = sample * 32768f
      out.putShort(
        when {
          scaled >= 32767f -> 32767
          scaled <= -32768f -> -32768
          else -> scaled.toInt().toShort()
        }
      )
    }
    file.parentFile?.mkdirs()
    file.writeBytes(out.array())
  }

  private fun tag(bytes: ByteBuffer, at: Int) =
    String(ByteArray(4) { bytes.get(at + it) })
}
