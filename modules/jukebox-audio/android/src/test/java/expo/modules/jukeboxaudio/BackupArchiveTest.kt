package expo.modules.jukeboxaudio

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class BackupArchiveTest {
  @get:Rule val folder = TemporaryFolder()

  /** An archive made by hand, the way a file from somewhere else would be. */
  private fun archive(vararg entries: Pair<String, ByteArray>): ByteArray {
    val out = ByteArrayOutputStream()
    ZipOutputStream(out).use { zip ->
      for ((name, bytes) in entries) {
        zip.putNextEntry(ZipEntry(name))
        zip.write(bytes)
        zip.closeEntry()
      }
    }
    return out.toByteArray()
  }

  private fun read(bytes: ByteArray, into: File = folder.newFolder()): String =
    BackupArchive.read(ByteArrayInputStream(bytes), into)

  @Test
  fun `what is packed is what is unpacked`() {
    val home = folder.newFolder("home")
    val cover = File(home, "ab12.jpg").apply { writeBytes(byteArrayOf(1, 2, 3, 4)) }
    val other = File(home, "cd34.jpg").apply { writeBytes(ByteArray(100_000) { it.toByte() }) }
    val document = """{"format":1,"said":"şarkı — ünlü"}"""

    val out = ByteArrayOutputStream()
    BackupArchive.write(out, document, listOf(cover, other, File(home, "never-existed.jpg")))

    val into = folder.newFolder("into")
    assertEquals(document, read(out.toByteArray(), into))
    assertEquals(setOf("ab12.jpg", "cd34.jpg"), into.list()!!.toSet())
    assertArrayEquals(cover.readBytes(), File(into, "ab12.jpg").readBytes())
    assertArrayEquals(other.readBytes(), File(into, "cd34.jpg").readBytes())
  }

  @Test
  fun `a zip that is not a backup is refused, in words`() {
    // Which words, not the words themselves: those are the phone's to find,
    // in whichever language the app is in.
    val trouble = assertThrows(Told::class.java) {
      read(archive("holiday.jpg" to byteArrayOf(1)))
    }
    assertEquals(R.string.jukebox_backup_not_one, trouble.words.id)
  }

  @Test
  fun `a file that is not a zip at all is refused the same way`() {
    assertThrows(IllegalStateException::class.java) { read("just some text".toByteArray()) }
  }

  @Test
  fun `nothing is written outside the folder it was told to use`() {
    val into = folder.newFolder("into")
    val outside = File(into.parentFile, "escaped.txt")
    read(
      archive(
        BackupArchive.DOCUMENT to "{}".toByteArray(),
        "artwork/../escaped.txt" to byteArrayOf(1),
        "artwork/../../escaped.txt" to byteArrayOf(1),
        "artwork/sub/inner.jpg" to byteArrayOf(1),
        "artwork/.hidden" to byteArrayOf(1),
        "../escaped.txt" to byteArrayOf(1),
        "/absolute.txt" to byteArrayOf(1),
        "artwork/fine.jpg" to byteArrayOf(9)
      ),
      into
    )
    assertFalse("an entry climbed out of the folder", outside.exists())
    assertEquals(listOf("fine.jpg"), into.list()!!.toList())
  }

  @Test
  fun `things in the archive that a backup does not contain are passed over`() {
    val into = folder.newFolder("into")
    val document = read(
      archive(
        "readme.txt" to "hello".toByteArray(),
        BackupArchive.DOCUMENT to """{"a":1}""".toByteArray(),
        "databases/jukebox.db" to byteArrayOf(1, 2, 3)
      ),
      into
    )
    assertEquals("""{"a":1}""", document)
    assertTrue(into.list()!!.isEmpty())
  }

  @Test
  fun `a picture past the limit is left out and the rest is still read`() {
    val into = folder.newFolder("into")
    val document = read(
      archive(
        "artwork/huge.jpg" to ByteArray(17 * 1024 * 1024),
        BackupArchive.DOCUMENT to "{}".toByteArray(),
        "artwork/small.jpg" to byteArrayOf(5)
      ),
      into
    )
    assertEquals("{}", document)
    assertEquals(listOf("small.jpg"), into.list()!!.toList())
  }

  @Test
  fun `only a bare file name counts as safe`() {
    for (good in listOf("ab12.jpg", "a", "A-b_c.d.png")) assertTrue(good, BackupArchive.safeName(good))
    for (bad in listOf("", ".", "..", ".hidden", "a/b.jpg", "a\\b.jpg", "../x", "a b.jpg", "x".repeat(161))) {
      assertFalse(bad, BackupArchive.safeName(bad))
    }
  }

  @Test
  fun `a name that is not safe is not packed either`() {
    val home = folder.newFolder("home")
    val odd = File(home, "has space.jpg").apply { writeBytes(byteArrayOf(1)) }
    val out = ByteArrayOutputStream()
    BackupArchive.write(out, "{}", listOf(odd))
    val into = folder.newFolder("into")
    read(out.toByteArray(), into)
    assertTrue(into.list()!!.isEmpty())
  }
}
