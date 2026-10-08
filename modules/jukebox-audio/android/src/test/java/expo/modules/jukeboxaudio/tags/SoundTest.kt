package expo.modules.jukeboxaudio.tags

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile

class SoundTest {
  @get:Rule
  val folder = TemporaryFolder()

  private fun file(bytes: ByteArray): File = folder.newFile().apply { writeBytes(bytes) }

  private fun <T> opened(file: File, work: (ChannelBytes) -> T): T =
    RandomAccessFile(file, "rw").use { work(ChannelBytes(it.channel)) }

  private fun noise(size: Int, seed: Int): ByteArray {
    val random = java.util.Random(seed.toLong())
    return ByteArray(size).also(random::nextBytes)
  }

  /** An ID3v2 tag of [body] bytes: the length is written seven bits to a byte. */
  private fun id3v2(body: Int, footer: Boolean = false): ByteArray {
    val header = byteArrayOf(
      'I'.code.toByte(), 'D'.code.toByte(), '3'.code.toByte(), 4, 0, if (footer) 0x10 else 0,
      (body shr 21 and 0x7f).toByte(), (body shr 14 and 0x7f).toByte(), (body shr 7 and 0x7f).toByte(), (body and 0x7f).toByte()
    )
    return header + noise(body, body) + if (footer) ByteArray(10) else ByteArray(0)
  }

  private fun id3v1() = "TAG".toByteArray() + ByteArray(125)

  private fun block(type: Int, body: ByteArray, last: Boolean = false) = byteArrayOf(
    (type or if (last) 0x80 else 0).toByte(),
    (body.size shr 16).toByte(), (body.size shr 8).toByte(), body.size.toByte()
  ) + body

  private val sound = noise(300_000, 1)
  private val streamInfo = noise(34, 2)

  @Test
  fun `the sound of an MP3 is what lies between its tags`() {
    assertEquals(Sound.Layout(0, 300_000), opened(file(sound), Sound::mp3))
    assertEquals(Sound.Layout(210, 300_210), opened(file(id3v2(200) + sound), Sound::mp3))
    assertEquals(Sound.Layout(220, 300_220), opened(file(id3v2(200, footer = true) + sound + id3v1()), Sound::mp3))
    // Two tags one after the other, which some taggers leave behind.
    assertEquals(Sound.Layout(10 + 200 + 10 + 70_000, 300_000 + 70_220), opened(file(id3v2(200) + id3v2(70_000) + sound), Sound::mp3))
    assertNull(opened(file(id3v2(200)), Sound::mp3))
  }

  @Test
  fun `new tags around the same sound are passed, whatever their size`() {
    val original = file(id3v2(100) + sound)
    val copy = file(id3v2(90_000) + sound)
    assertNull(opened(original) { was -> opened(copy) { now -> Sound.complaint("mp3", was, now) } })

    val withOldTag = file(id3v2(100) + sound + id3v1())
    val stillWithIt = file(id3v2(5_000) + sound + id3v1())
    assertNull(opened(withOldTag) { was -> opened(stillWithIt) { now -> Sound.complaint("mp3", was, now) } })
  }

  @Test
  fun `one byte of sound different is caught`() {
    val original = file(id3v2(100) + sound)
    val damaged = sound.copyOf().also { it[250_000] = (it[250_000] + 1).toByte() }
    assertNotNull(opened(original) { was -> opened(file(id3v2(100) + damaged)) { now -> Sound.complaint("mp3", was, now) } })
    // And so is sound that is merely shorter, or has something put on the end of it.
    assertNotNull(opened(original) { was -> opened(file(id3v2(100) + sound.copyOf(299_999))) { now -> Sound.complaint("mp3", was, now) } })
    assertNotNull(opened(original) { was -> opened(file(id3v2(100) + sound + ByteArray(64))) { now -> Sound.complaint("mp3", was, now) } })
  }

  private fun flac(vararg blocks: ByteArray, front: ByteArray = ByteArray(0), audio: ByteArray = sound) =
    front + "fLaC".toByteArray() + blocks.reduce(ByteArray::plus) + audio

  @Test
  fun `a FLAC's comments, pictures and padding may change and nothing else`() {
    val seek = noise(180, 3)
    val original = file(flac(block(0, streamInfo), block(3, seek), block(4, noise(60, 4)), block(1, ByteArray(400), last = true)))
    val rewritten = file(flac(block(0, streamInfo), block(3, seek), block(4, noise(900, 5)), block(6, noise(40_000, 6)), block(1, ByteArray(8), last = true)))
    assertNull(opened(original) { was -> opened(rewritten) { now -> Sound.complaint("flac", was, now) } })

    val layout = opened(original, Sound::flac)!!
    assertEquals(2, layout.blocks.size)
    assertEquals(300_000, layout.end - layout.start)

    // The seek table gone.
    val lost = file(flac(block(0, streamInfo), block(4, noise(900, 5)), block(1, ByteArray(8), last = true)))
    assertNotNull(opened(original) { was -> opened(lost) { now -> Sound.complaint("flac", was, now) } })
    // The stream's description of itself altered.
    val redescribed = file(flac(block(0, noise(34, 7)), block(3, seek), block(4, noise(60, 4), last = true)))
    assertNotNull(opened(original) { was -> opened(redescribed) { now -> Sound.complaint("flac", was, now) } })
  }

  @Test
  fun `a FLAC behind an ID3 tag is still found, and a file that is not one is not`() {
    val tagged = file(flac(block(0, streamInfo, last = true), front = id3v2(300)))
    assertEquals(300_000, opened(tagged, Sound::flac)!!.let { it.end - it.start })
    assertNull(opened(file(sound), Sound::flac))
    // A block that claims to run past the end of the file.
    assertNull(opened(file("fLaC".toByteArray() + byteArrayOf(0, 0x7f, 0, 0) + noise(50, 8)), Sound::flac))
    assertNotNull(opened(file(sound)) { was -> opened(file(sound)) { now -> Sound.complaint("flac", was, now) } })
  }

  /** Counts what is written, and can be made to fail part of the way through. */
  private class Watched(private val under: Writable, private val failAfter: Int = Int.MAX_VALUE) : Writable by under {
    val written = mutableListOf<LongRange>()
    override fun write(at: Long, from: ByteArray, count: Int) {
      if (written.size >= failAfter) throw IOException("no space left")
      under.write(at, from, count)
      written += at until at + count
    }
  }

  @Test
  fun `replacing a file of the same length writes only where it differs`() {
    val megabyte = 1024 * 1024
    val was = noise(3 * megabyte + 500, 9)
    val now = was.copyOf().also { it[10] = 1; it[11] = 2 }
    val original = file(was)
    val writes = opened(file(now)) { from ->
      opened(original) { into -> Watched(into).also { Sound.replace(from, it) }.written }
    }
    assertEquals(listOf(0L until megabyte), writes)
    assertArrayEquals(now, original.readBytes())
  }

  @Test
  fun `replacing with a longer or a shorter file leaves exactly the new one`() {
    val longer = id3v2(90_000) + sound
    val original = file(id3v2(100) + sound)
    opened(file(longer)) { from -> opened(original) { into -> Sound.replace(from, into) } }
    assertArrayEquals(longer, original.readBytes())

    val shorter = id3v2(40) + sound
    opened(file(shorter)) { from -> opened(original) { into -> Sound.replace(from, into) } }
    assertArrayEquals(shorter, original.readBytes())
  }

  @Test
  fun `a replace cut short can be run again to the end`() {
    val megabyte = 1024 * 1024
    val now = noise(3 * megabyte, 10)
    val original = file(noise(2 * megabyte + 77, 11))
    val copy = file(now)
    opened(copy) { from ->
      opened(original) { into ->
        assertThrows(IOException::class.java) { Sound.replace(from, Watched(into, failAfter = 1)) }
      }
    }
    assertTrue(!now.contentEquals(original.readBytes()))
    val second = opened(copy) { from -> opened(original) { into -> Watched(into).also { Sound.replace(from, it) }.written } }
    // The megabyte that got there the first time is not written twice.
    assertEquals(2, second.size)
    assertArrayEquals(now, original.readBytes())
  }
}
