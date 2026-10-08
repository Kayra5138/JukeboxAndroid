package expo.modules.jukeboxaudio.tags

import expo.modules.jukeboxaudio.R
import expo.modules.jukeboxaudio.Told
import expo.modules.jukeboxaudio.Words
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.util.zip.CRC32

/**
 * The second check on a rewritten copy, and the one that matters most: that
 * the sound in it is the sound that was in the original, byte for byte.
 *
 * Done without TagLib. A file is tags at the front, sometimes a tag at the
 * very end, and sound in between; finding where the sound starts and stops
 * takes a few dozen lines for each of the two formats, and those lines owe
 * nothing to the library whose work they are checking. If the two stretches
 * are the same bytes, then whatever was done to the tags, the music was not
 * touched. If the edges cannot be found at all the answer is no: a file this
 * cannot understand is not one to be rewriting.
 *
 * Also here, because it wants the same access to a file, is the putting back:
 * [replace] lays the finished copy over the original.
 *
 * Written against [Bytes] rather than a file, so that it runs in a unit test
 * on files in a temporary folder and on the phone on a descriptor the media
 * store handed over.
 */

/** Somewhere bytes can be read from at a position. */
internal interface Bytes {
  val size: Long

  /** Fills [into] from [at] with up to [count] bytes; answers how many, fewer only at the end. */
  fun read(at: Long, into: ByteArray, count: Int = into.size): Int
}

/** And written to. */
internal interface Writable : Bytes {
  fun write(at: Long, from: ByteArray, count: Int)
  fun truncate(size: Long)

  /** Does not return until what was written is on the disc. */
  fun sync()
}

/** A file on this side of the fence: the working copy, and everything in a test. */
internal class ChannelBytes(private val channel: FileChannel) : Writable {
  override val size get() = channel.size()

  override fun read(at: Long, into: ByteArray, count: Int): Int {
    val buffer = ByteBuffer.wrap(into, 0, count)
    while (buffer.hasRemaining()) {
      if (channel.read(buffer, at + buffer.position()) < 0) break
    }
    return buffer.position()
  }

  override fun write(at: Long, from: ByteArray, count: Int) {
    val buffer = ByteBuffer.wrap(from, 0, count)
    while (buffer.hasRemaining()) channel.write(buffer, at + buffer.position())
  }

  override fun truncate(size: Long) {
    channel.truncate(size)
  }

  override fun sync() = channel.force(true)
}

internal object Sound {
  private const val CHUNK = 256 * 1024
  private const val ID3V1 = 128

  /** Where the sound is, and for a FLAC the blocks before it that are not tags. */
  data class Layout(val start: Long, val end: Long, val blocks: List<String> = emptyList())

  private fun bytesAt(file: Bytes, at: Long, count: Int): ByteArray? {
    if (at < 0 || at + count > file.size) return null
    val bytes = ByteArray(count)
    return bytes.takeIf { file.read(at, it) == count }
  }

  private fun ByteArray.startsWith(text: String) =
    size >= text.length && text.indices.all { this[it] == text[it].code.toByte() }

  /**
   * Past every ID3v2 tag at the front. Its length is four bytes of seven bits
   * each, so that no byte of it can be mistaken for the start of sound, and
   * does not count the ten bytes of header or the ten of footer where the
   * flags say there is one.
   */
  private fun pastId3v2(file: Bytes): Long {
    var at = 0L
    while (true) {
      val header = bytesAt(file, at, 10) ?: return at
      if (!header.startsWith("ID3") || (6..9).any { header[it] < 0 }) return at
      val length = (6..9).fold(0) { sum, index -> (sum shl 7) or header[index].toInt() }
      at += 10 + length + if (header[5].toInt() and 0x10 != 0) 10 else 0
    }
  }

  /** Short of the old tag at the very end, where there is one. */
  private fun beforeId3v1(file: Bytes): Long {
    val tail = bytesAt(file, file.size - ID3V1, 3)
    return if (tail != null && tail.startsWith("TAG")) file.size - ID3V1 else file.size
  }

  private fun crc(file: Bytes, from: Long, length: Long): Long? {
    val sum = CRC32()
    val buffer = ByteArray(CHUNK)
    var done = 0L
    while (done < length) {
      val count = minOf(CHUNK.toLong(), length - done).toInt()
      if (file.read(from + done, buffer, count) != count) return null
      sum.update(buffer, 0, count)
      done += count
    }
    return sum.value
  }

  /** Everything between the tags of an MP3, or null when there is nothing there. */
  fun mp3(file: Bytes): Layout? {
    val start = pastId3v2(file)
    val end = beforeId3v1(file)
    return if (end > start) Layout(start, end) else null
  }

  /**
   * A FLAC is the four letters `fLaC`, a run of blocks each saying what it is
   * and how long, and then sound to the end.
   *
   * The comments (4), the pictures (6) and the padding (1) are what a write is
   * allowed to change. Every other block -- the stream's description of
   * itself, a seek table, a cue sheet, some application's own -- is noted with
   * a checksum, and has to turn up again exactly as it was.
   */
  fun flac(file: Bytes): Layout? {
    var at = pastId3v2(file)
    if (bytesAt(file, at, 4)?.startsWith("fLaC") != true) return null
    at += 4
    val blocks = mutableListOf<String>()
    while (true) {
      val header = bytesAt(file, at, 4) ?: return null
      val type = header[0].toInt() and 0x7f
      val length = ((header[1].toInt() and 0xff) shl 16) or
        ((header[2].toInt() and 0xff) shl 8) or (header[3].toInt() and 0xff)
      at += 4
      if (at + length > file.size) return null
      if (type != 1 && type != 4 && type != 6) {
        blocks += "$type:$length:${crc(file, at, length.toLong()) ?: return null}"
      }
      at += length
      if (header[0].toInt() and 0x80 != 0) break
    }
    val end = beforeId3v1(file)
    return if (end > at) Layout(at, end, blocks.sorted()) else null
  }

  /** Whether two stretches are the same bytes. */
  fun same(a: Bytes, aFrom: Long, b: Bytes, bFrom: Long, length: Long): Boolean {
    val one = ByteArray(CHUNK)
    val other = ByteArray(CHUNK)
    var done = 0L
    while (done < length) {
      val count = minOf(CHUNK.toLong(), length - done).toInt()
      if (a.read(aFrom + done, one, count) != count) return false
      if (b.read(bFrom + done, other, count) != count) return false
      if (!one.contentEquals(other, count)) return false
      done += count
    }
    return true
  }

  private fun ByteArray.contentEquals(other: ByteArray, count: Int): Boolean {
    for (index in 0 until count) if (this[index] != other[index]) return false
    return true
  }

  /**
   * What is wrong with the sound in [copy] set against [original], or null
   * when it is the same sound.
   */
  fun complaint(format: String, original: Bytes, copy: Bytes): Words? {
    val was = (if (format == "flac") flac(original) else mp3(original))
      ?: return Words(R.string.jukebox_tags_sound_original_unknown)
    val now = (if (format == "flac") flac(copy) else mp3(copy))
      ?: return Words(R.string.jukebox_tags_sound_copy_unknown)
    if (now.blocks != was.blocks) return Words(R.string.jukebox_tags_sound_described)
    val length = was.end - was.start
    if (now.end - now.start != length) return Words(R.string.jukebox_tags_sound_length)
    if (!same(original, was.start, copy, now.start, length)) return Words(R.string.jukebox_tags_sound_differs)
    return null
  }

  /**
   * Makes [into] hold exactly what [from] holds.
   *
   * A megabyte at a time, and a megabyte that is already right is not written
   * again. When TagLib found room for the new details in the padding a tag
   * keeps for the purpose -- which is what the padding is for, and is the
   * usual case -- the file is the length it was and only its first megabyte or
   * so is any different, so the sound, which is nearly all of the file, is
   * never written at all and cannot be harmed by a write that is cut short.
   *
   * When the file did have to grow, everything after the tag has moved and
   * all of it is written; there is no way round that through the media
   * store, which will not swap one file for another. That is the window in
   * which a phone switched off leaves a broken file, and why the caller keeps
   * the copy until this has returned and been checked.
   *
   * Throws where it stops, an [IOException] or a [Told]. May be called again from the start:
   * it only ever moves [into] towards [from].
   */
  fun replace(from: Bytes, into: Writable) {
    val size = from.size
    val wanted = ByteArray(1024 * 1024)
    val there = ByteArray(wanted.size)
    var at = 0L
    while (at < size) {
      val count = minOf(wanted.size.toLong(), size - at).toInt()
      if (from.read(at, wanted, count) != count) throw Told(R.string.jukebox_tags_copy_not_read_back)
      val already = if (at + count <= into.size) into.read(at, there, count) else -1
      if (already != count || !wanted.contentEquals(there, count)) into.write(at, wanted, count)
      at += count
    }
    if (into.size != size) into.truncate(size)
    into.sync()
  }
}
